/**
 * Règles métier des sites aériens sous l'équipe (#643) : création groupée « principal +
 * dépendants », déplacement, vol de mise en place. Vérifiées côté mobile pour donner à l'agent
 * une liste d'erreurs lisible avant l'enregistrement hors-ligne ; le serveur reste juge
 * (`SiteAeriennePositionInstaller`, `VolCreate`, ck_site_aerienne_equipe_coherente).
 */

export interface PositionSaisie {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
}

/** Un site du lot de création. `actif` ne vaut que pour les dépendants (le principal est obligatoire). */
export interface SiteSaisi {
  actif: boolean;
  numero: string;
  localite: string;
  /** Dépendant seulement : reprend la position du principal au lieu de sa propre capture. */
  memePositionQuePrincipal: boolean;
  position: PositionSaisie;
}

export interface CreationGroupee {
  principal: SiteSaisi;
  stand: SiteSaisi;
  baseSecondaire: SiteSaisi;
}

const estFini = (valeur: number | null): valeur is number => valeur !== null && Number.isFinite(valeur);

/** Latitude ∈ [−90, 90], longitude ∈ [−180, 180] — mêmes bornes que `SiteAeriennePositionInstaller`. */
export function validerPosition(position: PositionSaisie): string[] {
  const { latitude, longitude } = position;
  if (latitude === null && longitude === null) return ['La position GPS est obligatoire.'];
  const erreurs: string[] = [];
  if (!estFini(latitude) || latitude < -90 || latitude > 90) {
    erreurs.push('La latitude doit être comprise entre −90 et 90.');
  }
  if (!estFini(longitude) || longitude < -180 || longitude > 180) {
    erreurs.push('La longitude doit être comprise entre −180 et 180.');
  }
  return erreurs;
}

function validerSite(site: SiteSaisi, libelle: string, estPrincipal: boolean): string[] {
  const erreurs: string[] = [];
  if (!site.numero.trim()) erreurs.push(`${libelle} : le numéro est obligatoire.`);
  if (!site.localite.trim()) erreurs.push(`${libelle} : la localité est obligatoire.`);
  // Un dépendant « même position » n'a pas de capture à valider : il reprend celle du principal.
  if (estPrincipal || !site.memePositionQuePrincipal) {
    erreurs.push(...validerPosition(site.position).map((message) => `${libelle} : ${message}`));
  }
  return erreurs;
}

/** Un secondaire créé seul, rattaché à un principal existant (#643). */
export function validerSiteSecondaire(site: SiteSaisi): string[] {
  return validerSite(site, 'Site secondaire', false);
}

export function validerCreationGroupee({ principal, stand, baseSecondaire }: CreationGroupee): string[] {
  const erreurs = validerSite(principal, 'Site principal', true);
  const dependants: [SiteSaisi, string][] = [
    [stand, 'Stand'],
    [baseSecondaire, 'Base secondaire'],
  ];
  const numeros: string[] = [principal.numero.trim()];
  for (const [site, libelle] of dependants) {
    if (!site.actif) continue;
    erreurs.push(...validerSite(site, libelle, false));
    numeros.push(site.numero.trim());
  }
  const doublon = numeros.find((numero, i) => numero !== '' && numeros.indexOf(numero) !== i);
  if (doublon) erreurs.push(`Deux sites du même lot ne peuvent pas porter le même numéro (${doublon}).`);
  return erreurs;
}

export interface DeplacementSaisi {
  numero: string;
  localite: string;
  position: PositionSaisie;
}

export function validerDeplacement({ localite, position }: DeplacementSaisi): string[] {
  const erreurs: string[] = [];
  if (!localite.trim()) erreurs.push('La localité est obligatoire.');
  erreurs.push(...validerPosition(position));
  return erreurs;
}

export interface VolMiseEnPlaceSaisi {
  debut: string;
  fin: string;
  standId: string | null;
  aeronefId: string | null;
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Le serveur refuse `heure_fin <= heure_debut` (`VolCreate`) : même règle, en local. */
export function validerVolMiseEnPlace(vol: VolMiseEnPlaceSaisi, contexte: { nbStands: number }): string[] {
  if (contexte.nbStands === 0) {
    return ['Ce site n’a aucun stand : impossible de saisir un vol de mise en place.'];
  }
  const erreurs: string[] = [];
  if (!vol.standId) erreurs.push('Choisissez le stand du vol de mise en place.');
  const debutOk = HEURE.test(vol.debut);
  const finOk = HEURE.test(vol.fin);
  if (!debutOk) erreurs.push('L’heure de début est obligatoire (HH:MM).');
  if (!finOk) erreurs.push('L’heure de fin est obligatoire (HH:MM).');
  // « HH:MM » se compare lexicographiquement.
  if (debutOk && finOk && vol.fin <= vol.debut) {
    erreurs.push('L’heure de fin doit être postérieure à l’heure de début.');
  }
  if (!vol.aeronefId) erreurs.push('L’équipe n’a aucun aéronef en service : impossible de saisir un vol.');
  return erreurs;
}

/**
 * Relit `site_aerien_deplacement.dependants_json`. Une colonne corrompue lève au lieu d'envoyer au
 * serveur une liste que personne n'a saisie : un cast `as string[]` aurait tout laissé passer.
 */
export function lireDependants(json: string): string[] {
  const valeur: unknown = JSON.parse(json);
  if (!Array.isArray(valeur) || !valeur.every((id) => typeof id === 'string')) {
    throw new Error('dependants_json corrompu : liste d’identifiants attendue.');
  }
  return valeur;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** La veille d'une date `YYYY-MM-DD` : le déplacement clôt l'ancienne position à J-1 (comme le serveur). */
export function jourPrecedent(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - JOUR_MS).toISOString().slice(0, 10);
}

/**
 * Durée d'implantation, dérivée à la lecture comme `SiteAeriennePositionRead.duree_jours` :
 * `date_fin - date_debut`, ou l'écart à aujourd'hui si la position est encore active.
 * Dates au format `YYYY-MM-DD` (comparées en UTC : pas de dérive d'heure d'été).
 */
export function dureeImplantationJours(debut: string, fin: string | null, aujourdhui: string): number {
  const jour = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  return Math.round((jour(fin ?? aujourdhui) - jour(debut)) / JOUR_MS);
}
