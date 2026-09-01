/**
 * Mises à jour OTA — transparence pour l'agent et le support.
 *
 * `expo-updates` était installé et configuré (`app.json` : runtime
 * `fingerprint` + URL Expo) mais **jamais appelé** : l'app subissait le
 * téléchargement silencieux au lancement sans que rien ne le dise. Deux
 * conséquences pour le support : impossible de faire lire à l'agent quel
 * bundle tourne, impossible de lui faire forcer une vérification.
 *
 * Ce module est du **câblage** au sens de `signalement-natif.ts` : il touche
 * `expo-updates` et `storage`, ne décide rien de métier, et la seule chose
 * qu'il journalise passe par `runTask` (frontière best-effort — un check OTA
 * raté ne mérite pas d'interrompre l'agent, mais laisse sa trace, cf. #150).
 *
 * Tout ce qui se teste sans appareil — dérivation d'état, formatage,
 * sérialisation du dernier check — est en fonctions pures plus bas.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { logger } from './logger';
import { runTask, type TaskOutcome } from './run-task';
import { storage } from './storage';

// ─────────────────────────────────────────────────────────────────────────────
// Lecture de l'identité du build (fonctions pures — aucun état d'appareil)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le numéro de build natif, là où chaque plateforme le range.
 *
 * Dupliqué depuis `signalement-natif.ts` plutôt qu'importé : ce dernier tire
 * `expo-device` / `expo-file-system` / `expo-sharing` dans sa chaîne de
 * dépendances, que ce module n'a aucune raison de charger (même motif que le
 * jumeau `referentiel-auto-sync`). Trois lignes valent mieux que ce couplage.
 */
export function buildNatif(): string | null {
  const config = Constants.expoConfig;
  const brut = Platform.select<string | number | undefined>({
    android: config?.android?.versionCode,
    ios: config?.ios?.buildNumber,
  });
  return brut === undefined || brut === null ? null : String(brut);
}

export function versionApp(): string | null {
  return Constants.expoConfig?.version ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dernier check — persisté, car `lastCheckForUpdateTimeSinceRestart` d'Expo
// est perdu à chaque redémarrage de l'app
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatCheck = 'a-jour' | 'maj-trouvee' | 'echec';

export interface DernierCheck {
  /** ISO 8601. */
  at: string;
  resultat: ResultatCheck;
}

const DERNIER_CHECK_KEY = 'ota_dernier_check';

/** Tolérant : un JSON illisible ou une forme inattendue rend `null`. */
export function parseDernierCheck(brut: string | null): DernierCheck | null {
  if (!brut) return null;
  try {
    const obj = JSON.parse(brut) as Partial<DernierCheck>;
    if (
      typeof obj?.at === 'string' &&
      (obj.resultat === 'a-jour' || obj.resultat === 'maj-trouvee' || obj.resultat === 'echec')
    ) {
      return { at: obj.at, resultat: obj.resultat };
    }
    return null;
  } catch (error) {
    // Silence délibéré : le dernier check n'est qu'un affichage de confort. Une
    // valeur illisible se traduit par « jamais vérifié » — jamais un blocage —
    // mais la corruption va au journal.
    logger.ignore(error, 'dernier check OTA illisible dans le stockage');
    return null;
  }
}

export async function lireDernierCheck(): Promise<DernierCheck | null> {
  return parseDernierCheck(await storage.getItem(DERNIER_CHECK_KEY));
}

async function enregistrerDernierCheck(resultat: ResultatCheck): Promise<DernierCheck> {
  const dc: DernierCheck = { at: new Date().toISOString(), resultat };
  await storage.setItem(DERNIER_CHECK_KEY, JSON.stringify(dc));
  return dc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Câblage expo-updates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `false` en Expo Go, en dev client, ou si la config OTA est invalide —
 * `checkForUpdateAsync` / `fetchUpdateAsync` lèvent alors immédiatement.
 */
export function otaActif(): boolean {
  return Updates.isEnabled;
}

/**
 * Vérifie, et télécharge si une mise à jour est disponible.
 *
 * Derrière `runTask:best-effort` : ne rejette jamais, journalise l'échec sous
 * `ota.check.failed`. Le résultat du check (y compris `echec`) est persisté
 * pour alimenter la ligne « Dernière vérification » du profil.
 */
export async function verifierMaintenant(): Promise<TaskOutcome<DernierCheck>> {
  return runTask(
    async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          return await enregistrerDernierCheck('maj-trouvee');
        }
        return await enregistrerDernierCheck('a-jour');
      } catch (error) {
        // On persiste l'échec AVANT de laisser `runTask` le journaliser : la
        // ligne passive du profil doit pouvoir dire « échec il y a 2 j ».
        await enregistrerDernierCheck('echec').catch((e) =>
          logger.ignore(e, "persistance de l'échec du check OTA impossible")
        );
        throw error;
      }
    },
    { name: 'ota.check', criticality: 'best-effort' }
  );
}

/** Applique le bundle téléchargé. Toujours déclenché par un geste de l'agent. */
export async function appliquerMaintenant(): Promise<void> {
  await Updates.reloadAsync();
}

export interface InfosCourantes {
  updateId: string | null;
  runtimeVersion: string | null;
  channel: string | null;
  createdAt: Date | undefined;
  isEmbeddedLaunch: boolean;
}

/**
 * Consolide l'identité du bundle courant à partir de `useUpdates().currentlyRunning`,
 * avec repli sur les constantes `Updates.*`. Un seul endroit fait ce `?? ` —
 * l'écran et le presse-papier le consomment sans le recopier.
 */
export function infosCourantes(cr: {
  updateId?: string;
  runtimeVersion?: string;
  channel?: string;
  createdAt?: Date;
  isEmbeddedLaunch: boolean;
}): InfosCourantes {
  return {
    updateId: cr.updateId ?? Updates.updateId,
    runtimeVersion: cr.runtimeVersion ?? Updates.runtimeVersion,
    channel: cr.channel ?? Updates.channel,
    createdAt: cr.createdAt,
    isEmbeddedLaunch: cr.isEmbeddedLaunch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dérivation d'état et formatage (fonctions pures)
// ─────────────────────────────────────────────────────────────────────────────

export type EtatOta = 'indisponible' | 'a-jour' | 'disponible' | 'telechargement' | 'prete';

export interface DrapeauxUpdates {
  isEnabled: boolean;
  isUpdateAvailable: boolean;
  isDownloading: boolean;
  isUpdatePending: boolean;
}

export function deriverEtat(d: DrapeauxUpdates): EtatOta {
  if (!d.isEnabled) return 'indisponible';
  if (d.isUpdatePending) return 'prete';
  if (d.isDownloading) return 'telechargement';
  if (d.isUpdateAvailable) return 'disponible';
  return 'a-jour';
}

export function libelleEtat(etat: EtatOta): string {
  switch (etat) {
    case 'indisponible':
      return 'Indisponible (mode développement)';
    case 'a-jour':
      return 'À jour';
    case 'disponible':
      return 'Mise à jour disponible';
    case 'telechargement':
      return 'Téléchargement en cours…';
    case 'prete':
      return 'Mise à jour prête — redémarrez';
  }
}

export function formatVersionBuild(version: string | null, build: string | null): string {
  if (!version) return 'Version inconnue';
  return build ? `Version ${version} (build ${build})` : `Version ${version}`;
}

export function formatDateMaj(createdAt: Date | undefined, isEmbeddedLaunch: boolean): string {
  if (isEmbeddedLaunch || !createdAt) {
    return "Version d'origine (aucune mise à jour reçue)";
  }
  return `Mise à jour du ${createdAt.toLocaleDateString('fr-FR')}`;
}

export interface InfosTechniquesEntree {
  version: string | null;
  build: string | null;
  updateId: string | null | undefined;
  runtimeVersion: string | null | undefined;
  channel: string | null | undefined;
}

/** Bloc copiable, que l'agent lit ou colle au support. */
export function infosTechniques(e: InfosTechniquesEntree): string {
  return [
    `Version : ${e.version ?? '—'}`,
    `Build : ${e.build ?? '—'}`,
    `Update ID : ${e.updateId ?? '(bundle embarqué)'}`,
    `Runtime : ${e.runtimeVersion ?? '—'}`,
    `Canal : ${e.channel ?? '—'}`,
  ].join('\n');
}

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

function ilYA(deltaMs: number): string {
  if (deltaMs < HEURE) {
    const min = Math.max(1, Math.round(deltaMs / MINUTE));
    return `il y a ${min} min`;
  }
  if (deltaMs < JOUR) {
    const h = Math.round(deltaMs / HEURE);
    return `il y a ${h} h`;
  }
  const j = Math.round(deltaMs / JOUR);
  return `il y a ${j} j`;
}

export function formatDernierCheck(dc: DernierCheck | null, maintenant: Date): string {
  if (!dc) return 'Dernière vérification : jamais';
  const delta = maintenant.getTime() - new Date(dc.at).getTime();
  const quand = ilYA(Math.max(0, delta));
  return dc.resultat === 'echec'
    ? `Dernière vérification : échec ${quand}`
    : `Dernière vérification : ${quand}`;
}

/**
 * Le check auto (lancement + retour au premier plan) ne se rejoue pas plus
 * d'une fois par `intervalleMinMs` : inutile de rappeler le serveur Expo à
 * chaque bascule d'app, et le bouton du profil reste là pour forcer.
 */
export function doitVerifierAuto(
  dc: DernierCheck | null,
  maintenant: Date,
  intervalleMinMs: number
): boolean {
  if (!dc) return true;
  return maintenant.getTime() - new Date(dc.at).getTime() >= intervalleMinMs;
}
