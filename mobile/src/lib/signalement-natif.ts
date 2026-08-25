/**
 * Les dépendances réelles du signalement — ADR-012 décision 7 (#176).
 *
 * `signalement.ts` porte la logique et reste pur ; ce module-ci porte tout ce
 * qui ne peut pas s'exécuter hors d'un appareil : `expo-constants`,
 * `expo-device`, `expo-file-system`, `expo-sharing`. La frontière est la même
 * qu'entre `app-startup.ts` et `_layout.tsx`.
 *
 * **Il ne doit contenir aucune décision.** Tout ce qui se teste appartient à
 * `signalement.ts` ; ici, il n'y a que du câblage — et c'est ce qui rend
 * acceptable qu'il ne soit pas couvert.
 *
 * `expo-constants` et `expo-device` étaient déjà installés et **jamais
 * appelés** : le rapport ne portait donc ni version d'app, ni appareil, ni OS.
 * C'est la moitié de ce que le support demande au téléphone.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { useAuthStore } from './auth-store';
import { lireSession } from './journal-db';
import { flush, getCorrelationId } from './logger';
import type { ContexteApp, ContexteAppareil, IdentiteAgent, SignalementDeps } from './signalement';

/**
 * Le numéro de build, là où chaque plateforme le range.
 *
 * C'est **la** valeur que le support croise avec un tag de release : la
 * `version` d'`app.json` bouge une fois par mois, le build à chaque envoi EAS.
 */
function buildNatif(): string | null {
  const config = Constants.expoConfig;
  const brut = Platform.select<string | number | undefined>({
    android: config?.android?.versionCode,
    ios: config?.ios?.buildNumber,
  });
  return brut === undefined || brut === null ? null : String(brut);
}

function contexteApp(): ContexteApp {
  return {
    version: Constants.expoConfig?.version ?? null,
    build: buildNatif(),
    // Le canal OTA compte autant que la version : deux appareils sur la même
    // `version` peuvent porter deux bundles différents.
    runtime: Constants.expoRuntimeVersion ?? null,
  };
}

function contexteAppareil(): ContexteAppareil {
  return {
    marque: Device.brand,
    modele: Device.modelName,
    os: Device.osName ?? Platform.OS,
    osVersion: Device.osVersion ?? null,
  };
}

function identiteAgent(): IdentiteAgent | null {
  const user = useAuthStore.getState().user;
  if (!user) return null;
  // L'e-mail n'est pas repris : le support identifie l'agent par son nom et son
  // rôle, et le rapport voyage par WhatsApp. Le strict nécessaire pour rappeler.
  return { id: user.id, nom: user.nom, prenom: user.prenom, role: user.role };
}

/**
 * Le fichier est écrit dans le **cache**, pas dans le stockage durable : une
 * fois partagé, il n'a plus de lecteur, et l'OS peut le reprendre quand la
 * place manque. Le journal, lui, reste en base.
 */
async function ecrire(nom: string, contenu: string): Promise<string> {
  const fichier = new File(Paths.cache, nom);
  await fichier.write(contenu);
  return fichier.uri;
}

/** Les dépendances réelles, à passer à `envoyerSignalement`. */
export function depsSignalement(): SignalementDeps {
  return {
    flush,
    lireSession,
    correlationId: getCorrelationId,
    app: contexteApp,
    appareil: contexteAppareil,
    agent: identiteAgent,
    maintenant: () => new Date(),
    ecrire,
    partager: (uri) =>
      shareAsync(uri, {
        // `application/json` plutôt qu'un type `jsonl` inconnu des applis :
        // WhatsApp refuse de joindre ce qu'il ne sait pas nommer, et un
        // signalement qui ne part pas est un signalement perdu.
        mimeType: 'application/json',
        dialogTitle: 'Envoyer le signalement au support',
      }),
  };
}
