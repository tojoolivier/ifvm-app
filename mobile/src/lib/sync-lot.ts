/**
 * La convention unique de synchronisation — ADR-012 décision 9, issue #177.
 *
 * Trois conventions coexistaient pour la même question « cette fiche est-elle
 * partie ? » : `retrySyncProspection` levait, `enregistrerEtSynchroniser`
 * rendait `{ synced, syncError }`, et `enregistrerEtSynchroniserTraitement`
 * rendait `{ synced: false }` sans motif. Une seule subsiste :
 *
 * - **l'unitaire lève** (`syncOne`) — une fiche a une seule issue, l'échec est
 *   une exception typée ;
 * - **le lot résume** (`syncAll`) — un lot a nativement plusieurs issues par
 *   fiche, et les énumérer n'est pas remplacer le canal d'erreur : c'est typer
 *   un résultat métier.
 *
 * Le résumé n'est **pas** le type `Result` écarté du périmètre d'ADR-012 : il
 * ne s'interpose pas entre `syncOne` et son appelant, il agrège N issues.
 */
import { statutHttpDe, versionServeurDe } from './api-client';
import { AuthError, NetworkError } from './errors';
import { classeDe, logger } from './logger';
import { toFriendlyError, type ActionErreur } from './friendly-error';

/**
 * Le sort réservé à une fiche dont l'envoi a échoué.
 *
 * - `'file'` — elle **reste dans la file** : la cause est transitoire, la
 *   prochaine synchronisation la reprendra sans que l'agent ait rien à faire.
 *   C'est le cas nominal du terrain, pas une anomalie.
 * - `'echec'` — elle **sort de la file** : le serveur l'a refusée, réessayer à
 *   l'identique produirait le même refus. Elle demande une action humaine.
 *
 * Pas de compteur de tentatives, délibérément : une semaine hors réseau produit
 * une dizaine d'échecs parfaitement normaux, et un seuil les transformerait en
 * fiches mortes.
 */
export type SortEchec = 'file' | 'echec';

export interface FicheEchouee {
  id: string;
  /** Ce que l'agent lit — `n_fiche` ou, à défaut, la date. */
  label: string;
  /**
   * Nom de la classe typée, ou `(bug)`. C'est lui qui permet à l'écran de
   * proposer l'action de `friendly-error` **par classe** au lieu d'un
   * « Réessayer » universel.
   */
  classe: string;
  /**
   * Ce que l'agent lit, et ce qu'on lui propose — la traduction par classe de
   * #172, faite une fois ici plutôt que redérivée par chaque écran. L'erreur
   * elle-même ne survit pas au résumé : elle est déjà au journal.
   */
  message: string;
  action: ActionErreur | null;
  /** Statut HTTP quand le serveur a répondu — c'est lui qui décide du sort. */
  statutHttp: number | null;
  sort: SortEchec;
}

export interface FicheEnConflit {
  id: string;
  label: string;
  /**
   * La version que le serveur oppose. **Conservée**, jamais aplatie : elle a
   * déjà coûté un aller-retour réseau, et l'arbitrage du conflit (hors
   * périmètre de #177) n'existera jamais sans elle.
   */
  serverVersion: unknown;
}

export interface ResumeSync {
  /** Identifiants des fiches parties. */
  reussies: string[];
  echouees: FicheEchouee[];
  conflits: FicheEnConflit[];
}

/** Ce qu'un domaine (prospection, traitement) fournit pour être synchronisé en lot. */
export interface LotSync<D> {
  /** Préfixe des lignes de journal : `<nom>.sync.failed`. */
  nom: string;
  /** L'unitaire. Il **lève** — c'est toute la convention. */
  syncOne: (draft: D, token: string) => Promise<void>;
  idDe: (draft: D) => string;
  labelDe: (draft: D) => string;
  /** Fait passer la fiche à `statut_sync = 'echec'`. */
  marquerEchec: (id: string) => Promise<void>;
  /**
   * Fait passer la fiche à `statut_sync = 'conflict'` en gardant la version
   * serveur. Absent pour les domaines dont l'API ne rend jamais de 409 : un
   * conflit y est alors compté comme échec plutôt que rangé nulle part.
   */
  marquerConflit?: (id: string, serverVersion: unknown) => Promise<void>;
}

/**
 * Le tableau de décision de #177, corrigé par #190 — `ApiError` a disparu avec
 * #173, donc la distinction 4xx/5xx ne se lit plus sur la classe mais sur le
 * statut joint.
 *
 * | condition | sort |
 * |---|---|
 * | `AuthError` (401) | `'file'` — c'est la session à refaire, pas la fiche |
 * | pas de statut HTTP (transport) | `'file'` |
 * | statut ≥ 500 | `'file'` |
 * | statut 4xx | `'echec'` |
 * | tout le reste | `'file'` |
 *
 * La dernière ligne est le choix prudent : un bug de construction du payload
 * disparaîtra avec son correctif, alors qu'une fiche sortie de la file n'y
 * revient que si quelqu'un la remarque.
 */
export function sortDeLEchec(error: unknown): SortEchec {
  if (error instanceof AuthError) return 'file';

  const statut = statutHttpDe(error);
  if (statut === null) return 'file';
  if (statut >= 500) return 'file';
  if (statut >= 400) return 'echec';

  return 'file';
}

function estConflit(error: unknown): boolean {
  return statutHttpDe(error) === 409;
}

/**
 * Un rejet de validation (4xx hors 401/409) : le serveur a compris la requête
 * et refusé le **contenu** de la fiche — pas un problème de connexion.
 * `extractErrorMessage` (api-client.ts) a déjà mis le motif exact du serveur
 * (souvent en français, ex. « densite_groupee: La densité groupée (ind./m²) est
 * obligatoire. ») dans `error.message` ; il ne reste qu'à ne pas le jeter.
 */
function estRejetValidation(error: unknown): boolean {
  const statut = statutHttpDe(error);
  return statut !== null && statut >= 400 && statut < 500 && statut !== 401 && statut !== 409;
}

/**
 * Ce que l'agent lit, et ce qu'on lui propose.
 *
 * Le conflit est traité **avant** `toFriendlyError` : il voyage en
 * `NetworkError` — pour ne pas ouvrir le jeu fermé des sept classes (décision 2)
 * — et hériterait sinon du « Connexion impossible · Réessayer » de cette classe.
 * Or réessayer à l'identique est exactement ce qui ne peut pas marcher : le
 * serveur a une version plus récente. Le statut joint le distingue, comme il
 * distingue déjà 4xx de 5xx.
 *
 * Un rejet de validation (422 typiquement) voyage pour la même raison en
 * `NetworkError` et hériterait du même « Connexion impossible » — un mensonge
 * cette fois : la connexion a réussi, c'est la fiche que le serveur refuse, et
 * réessayer sans la corriger reproduira le refus à l'identique. D'où le même
 * traitement qu'`estConflit` : montrer le motif réel (déjà en `error.message`,
 * cf. `extractErrorMessage`) plutôt que le message générique de la classe.
 */
function affichageDe(error: unknown): { message: string; action: ActionErreur | null } {
  if (estConflit(error)) {
    return {
      message:
        'Cette fiche a été modifiée sur le serveur. Votre version est conservée sur l’appareil.',
      action: 'signaler-support',
    };
  }

  if (estRejetValidation(error)) {
    const motif = error instanceof Error ? error.message : null;
    return {
      message: motif || 'Cette fiche a été refusée par le serveur — corrigez-la avant de réessayer.',
      action: null,
    };
  }

  const affichable = toFriendlyError(error);
  return { message: affichable.message, action: affichable.action };
}

/**
 * Enveloppe un lot pour qu'il **refuse d'envoyer hors ligne** — en levant, pas
 * en rendant un faux calme.
 *
 * `return { synced: false }` était indiscernable d'un succès pour qui ne lisait
 * pas le champ. Une `NetworkError` traverse la même classification que
 * n'importe quelle coupure et laisse la fiche dans la file.
 */
export function avecConnexion<D>(
  lot: LotSync<D>,
  estEnLigne: () => Promise<boolean>
): LotSync<D> {
  return {
    ...lot,
    syncOne: async (draft, token) => {
      if (!(await estEnLigne())) {
        throw new NetworkError(
          'Appareil hors ligne — la fiche partira à la prochaine synchronisation.'
        );
      }
      await lot.syncOne(draft, token);
    },
  };
}

/**
 * Synchronise un lot et **résume**. Ne lève jamais : un lot partiellement parti
 * est un état, pas une erreur — c'est ce qui a fait disparaître l'`Alert`
 * modale de `sync.tsx`.
 *
 * @example
 * const resume = await syncAll(fiches, token, lotProspection);
 * if (resume.echouees.length) montrerResume(resume);
 */
export async function syncAll<D>(
  drafts: D[],
  token: string,
  lot: LotSync<D>
): Promise<ResumeSync> {
  const log = logger.child({ module: 'sync-lot', lot: lot.nom });
  const resume: ResumeSync = { reussies: [], echouees: [], conflits: [] };

  for (const draft of drafts) {
    const id = lot.idDe(draft);
    const label = lot.labelDe(draft);

    try {
      await lot.syncOne(draft, token);
      resume.reussies.push(id);
      continue;
    } catch (error) {
      log.failure(`${lot.nom}.sync.failed`, error, { ficheId: id });

      if (estConflit(error) && lot.marquerConflit) {
        const serverVersion = versionServeurDe(error);
        await persister(() => lot.marquerConflit!(id, serverVersion), log);
        resume.conflits.push({ id, label, serverVersion });
        continue;
      }

      // `sortDeLEchec` rend déjà `'echec'` pour un 409 : c'est un 4xx.
      const sort = sortDeLEchec(error);
      if (sort === 'echec') {
        await persister(() => lot.marquerEchec(id), log);
      }

      resume.echouees.push({
        id,
        label,
        classe: classeDe(error),
        ...affichageDe(error),
        statutHttp: statutHttpDe(error),
        sort,
      });
    }
  }

  return resume;
}

/**
 * L'écriture du statut est un effet de bord du résumé, pas sa condition : si la
 * base refuse l'UPDATE, la fiche doit quand même apparaître dans le résumé —
 * la faire disparaître serait le silence exact que ce ticket supprime.
 */
async function persister(
  ecrire: () => Promise<void>,
  log: ReturnType<typeof logger.child>
): Promise<void> {
  try {
    await ecrire();
  } catch (error) {
    log.failure('sync.statut.failed', error);
  }
}

// ==========================================
// AFFICHAGE — le badge se lit en base, pas dans le résumé
// ==========================================

/**
 * L'état d'une fiche **tel qu'il survit au départ de l'écran**.
 *
 * C'est délibérément `statut_sync` qui le porte, et non le résumé de la
 * dernière synchronisation : un badge tenu en `useState` disparaît au premier
 * changement d'onglet, et l'agent qui revient ne voit plus rien.
 */
export type StatutFiche = 'en-attente' | 'echec' | 'conflit' | 'synchronisee';

const PAR_STATUT_SYNC: Record<string, StatutFiche> = {
  synced: 'synchronisee',
  echec: 'echec',
  conflict: 'conflit',
};

/**
 * Traduit la colonne `statut_sync` en état affichable.
 *
 * Le vocabulaire de la base est `'local' | 'synced' | 'conflict' | 'echec'` —
 * celui du ticket (`'a_synchro'`, `'conflit'`) n'a jamais existé en base, et
 * l'introduire aurait créé le troisième vocabulaire que #177 supprime.
 *
 * Une valeur inconnue retombe sur « en attente » : mieux vaut proposer un envoi
 * inutile qu'escamoter une fiche dont personne ne sait plus quoi penser.
 */
export function statutFicheDe(statutSync: string): StatutFiche {
  return PAR_STATUT_SYNC[statutSync] ?? 'en-attente';
}

/**
 * Cette fiche part-elle au prochain envoi de lot ?
 *
 * Non pour une fiche déjà partie, et non pour une fiche en `'echec'` : le
 * serveur l'a refusée, la renvoyer à l'identique produirait le même refus.
 * C'est ici que « sortir de la file » se décide — dans le modèle, pour que les
 * deux écrans qui composent un lot ne puissent pas en juger différemment.
 */
export function estDansLaFile(statutSync: string): boolean {
  // #traitement-brouillon-distinct-fiche-creee : un brouillon (jamais enregistré) n'est
  // pas dans la file — sinon la valeur inconnue retomberait sur « en attente ».
  if (statutSync === 'brouillon') return false;
  const statut = statutFicheDe(statutSync);
  return statut === 'en-attente' || statut === 'conflit';
}

/** Libellés, au même endroit que le jeu — l'écran ne les réécrit pas. */
export const LIBELLE_STATUT_FICHE: Record<StatutFiche, string> = {
  'en-attente': 'En attente',
  echec: 'Échec',
  conflit: 'Conflit',
  synchronisee: 'Synchronisée',
};

/** Le lot est-il intégralement parti ? Un conflit compte comme non parti. */
export function estToutParti(resume: ResumeSync): boolean {
  return resume.echouees.length === 0 && resume.conflits.length === 0;
}

const pluriel = (n: number, mot: string) => (n > 1 ? `${mot}s` : mot);

/**
 * Le résumé, en une phrase non bloquante.
 *
 * Elle remplace l'`Alert` modale « Synchronisation partielle · Veuillez
 * réessayer » : la modale interrompait l'agent pour lui annoncer un état
 * normal du terrain, sans lui dire **quoi** réessayer.
 *
 * « à réessayer » et « en échec » sont distingués parce que le sort l'est :
 * les premières repartiront seules, les secondes demandent une action.
 */
export function resumerEnPhrase(resume: ResumeSync): string {
  const enFile = resume.echouees.filter((f) => f.sort === 'file').length;
  const enEchec = resume.echouees.filter((f) => f.sort === 'echec').length;
  const reussies = resume.reussies.length;

  const parts: string[] = [];
  if (reussies > 0) parts.push(`${reussies} ${pluriel(reussies, 'synchronisée')}`);
  if (enFile > 0) parts.push(`${enFile} à réessayer`);
  if (enEchec > 0) parts.push(`${enEchec} en échec`);
  if (resume.conflits.length > 0) parts.push(`${resume.conflits.length} en conflit`);

  if (parts.length === 0) return 'Aucune fiche à synchroniser';
  if (parts.length === 1 && reussies > 0) {
    return `${reussies} ${pluriel(reussies, 'fiche')} ${pluriel(reussies, 'synchronisée')}`;
  }

  return parts.join(' · ');
}
