import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { CaseALigne, ChampsSite } from '@/components/site/ChampsSite';
import { PositionGps } from '@/components/site/PositionGps';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { listEquipesAvecChef } from '@/lib/equipe-db';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { creerSiteSecondaire, creerSitesGroupes, listSitesAeriensEquipe } from '@/lib/site-aerien-db';
import { envoyerSitesSiEnLigne } from '@/lib/site-aerien-envoi';
import {
  type SiteSaisi,
  validerCreationGroupee,
  validerSiteSecondaire,
} from '@/lib/site-aerien-regles';

const SANS_POSITION = { latitude: null, longitude: null, altitude: null };

const vierge = (extra: Partial<SiteSaisi> = {}): SiteSaisi => ({
  actif: true,
  numero: '',
  localite: '',
  memePositionQuePrincipal: false,
  position: SANS_POSITION,
  ...extra,
});

type TypeSite = 'principal' | 'secondaire';

/**
 * Nouveau site aérien (#643, Figma « Nouveau site aérien »). Deux gestes, décidés à l'écran :
 *
 * - **Principal** : en une saisie, le principal (obligatoire) + un stand de remplissage et une base
 *   secondaire (facultatifs). Le principal reçoit l'équipe de travail, les dépendants pointent vers lui.
 * - **Secondaire seul**, rattaché au principal de l'équipe.
 *
 * Tout s'écrit sur l'appareil puis part dans la file d'envoi : l'agent n'est jamais bloqué parce que
 * le site voulu n'existe pas encore (#605). Une équipe n'a qu'un principal — le déplacer, pas en créer un autre.
 */
export default function SiteNouveauScreen() {
  const router = useRouter();
  const signalerChargement = useSignalerChargement('site-nouveau');
  const token = useAuthStore((s) => s.token);
  // L'équipe consultée (depuis son détail) prime sur l'équipe de travail : on ne rattache jamais un
  // site à une autre équipe que celle dont on regarde les sites.
  const { equipeId: equipeParam } = useLocalSearchParams<{ equipeId?: string }>();
  const equipeTravail = useEquipeTravailStore((s) => s.equipeId);
  const equipeId = equipeParam ?? equipeTravail;
  const { run, isRunning } = useAsyncAction();

  const [nomEquipe, setNomEquipe] = useState<string | null>(null);
  const [principalExistant, setPrincipalExistant] = useState<{ id: string } | null>(null);
  const [type, setType] = useState<TypeSite>('principal');
  const [principal, setPrincipal] = useState<SiteSaisi>(vierge());
  const [stand, setStand] = useState<SiteSaisi>(vierge({ actif: false, memePositionQuePrincipal: true }));
  const [base, setBase] = useState<SiteSaisi>(vierge({ actif: false, memePositionQuePrincipal: true }));
  const [secondaire, setSecondaire] = useState<SiteSaisi>(vierge({ memePositionQuePrincipal: true }));
  const [erreurs, setErreurs] = useState<string[]>([]);

  useEffect(() => {
    if (!equipeId) return;
    Promise.all([listEquipesAvecChef(), listSitesAeriensEquipe(equipeId)])
      .then(([equipes, sites]) => {
        setNomEquipe(equipes.find((e) => e.id === equipeId)?.nom ?? null);
        const existant = sites.find((s) => s.parent_site_id === null) ?? null;
        setPrincipalExistant(existant ? { id: existant.id } : null);
        // Une équipe n'a qu'un principal : s'il existe, on ne propose que le rattachement.
        if (existant) setType('secondaire');
      })
      .catch((error) => signalerChargement(error, { source: 'site-nouveau' }));
  }, [equipeId, signalerChargement]);

  const enregistrer = () => {
    const trouvees =
      type === 'principal'
        ? validerCreationGroupee({ principal, stand, baseSecondaire: base })
        : validerSiteSecondaire(secondaire);
    setErreurs(trouvees);
    if (trouvees.length > 0) return;

    void run(
      async () => {
        if (type === 'principal') {
          await creerSitesGroupes({ equipeId: equipeId as string, principal, stand, baseSecondaire: base });
        } else {
          await creerSiteSecondaire({ parentId: (principalExistant as { id: string }).id, site: secondaire });
        }
        // Départ immédiat si le réseau est là ; sinon la file attend le retour de la connectivité.
        if (token) void envoyerSitesSiEnLigne(token);
        router.back();
      },
      {
        screen: 'site-nouveau',
        precondition: !!equipeId && (type === 'principal' || !!principalExistant),
        preconditionMessage: !equipeId
          ? 'Choisissez d’abord votre équipe de travail.'
          : 'Cette équipe n’a pas encore de site principal : créez-le d’abord.',
      }
    );
  };

  return (
    <View style={styles.racine}>
      <EquipeHeader titre="Nouveau site aérien" variante="formulaire" onRetour={() => router.back()} />
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {erreurs.length > 0 && (
          <View style={styles.erreurs} accessibilityRole="alert">
            {erreurs.map((e) => (
              <ThemedText key={e} style={styles.erreur}>
                • {e}
              </ThemedText>
            ))}
          </View>
        )}

        <ThemedText style={styles.section}>TYPE DE SITE *</ThemedText>
        <View style={styles.types}>
          <ChoixType
            actif={type === 'principal'}
            desactive={!!principalExistant}
            titre="Principal"
            detail={principalExistant ? 'Déjà créé pour l’équipe' : 'Rattaché à l’équipe'}
            onPress={() => setType('principal')}
            testID="type-principal"
          />
          <ChoixType
            actif={type === 'secondaire'}
            titre="Secondaire"
            detail="Rattaché à un principal"
            onPress={() => setType('secondaire')}
            testID="type-secondaire"
          />
        </View>

        {type === 'principal' ? (
          <>
            <ChampsSite
              id="principal"
              numero={principal.numero}
              localite={principal.localite}
              onNumero={(numero) => setPrincipal({ ...principal, numero })}
              onLocalite={(localite) => setPrincipal({ ...principal, localite })}
            />
            <View style={styles.equipe}>
              <ThemedText style={styles.equipeEtiquette}>Équipe de travail</ThemedText>
              <ThemedText style={styles.equipeNom}>{nomEquipe ?? '—'}</ThemedText>
            </View>

            <ThemedText style={styles.section}>POSITION *</ThemedText>
            <PositionGps
              id="principal"
              position={principal.position}
              libelleCapture="Capturer ma position"
              onChange={(position) => setPrincipal({ ...principal, position })}
            />

            <ThemedText style={styles.section}>SITES DÉPENDANTS (FACULTATIF)</ThemedText>
            <Dependant
              id="stand"
              titre="Stand de remplissage"
              site={stand}
              onChange={setStand}
            />
            <Dependant
              id="base"
              titre="Base secondaire"
              site={base}
              onChange={setBase}
            />
          </>
        ) : (
          <>
            <ChampsSite
              id="secondaire"
              numero={secondaire.numero}
              localite={secondaire.localite}
              onNumero={(numero) => setSecondaire({ ...secondaire, numero })}
              onLocalite={(localite) => setSecondaire({ ...secondaire, localite })}
            />
            {!principalExistant && (
              <ThemedText style={styles.note}>
                Cette équipe n’a pas encore de site principal : créez-le d’abord (type « Principal »).
              </ThemedText>
            )}
            <ThemedText style={styles.section}>POSITION *</ThemedText>
            <CaseALigne
              testID="secondaire-meme-position"
              coche={secondaire.memePositionQuePrincipal}
              onChange={(coche) => setSecondaire({ ...secondaire, memePositionQuePrincipal: coche })}
              libelle="Même position que le principal"
            />
            {!secondaire.memePositionQuePrincipal && (
              <PositionGps
                id="secondaire"
                position={secondaire.position}
                onChange={(position) => setSecondaire({ ...secondaire, position })}
              />
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.pied}>
        <TouchableOpacity
          style={[styles.cta, isRunning && { opacity: 0.6 }]}
          onPress={enregistrer}
          disabled={isRunning}
          accessibilityRole="button"
          testID="site-enregistrer"
        >
          <ThemedText style={styles.ctaTexte}>Enregistrer le site</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChoixType(props: {
  actif: boolean;
  desactive?: boolean;
  titre: string;
  detail: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.type, props.actif && styles.typeActif, props.desactive && { opacity: 0.5 }]}
      onPress={props.onPress}
      disabled={props.desactive}
      accessibilityRole="button"
      accessibilityState={{ selected: props.actif, disabled: !!props.desactive }}
      testID={props.testID}
    >
      <ThemedText style={[styles.typeTitre, props.actif && { color: EQ.surMarque }]}>{props.titre}</ThemedText>
      <ThemedText style={[styles.typeDetail, props.actif && { color: EQ.surMarque }]}>{props.detail}</ThemedText>
    </TouchableOpacity>
  );
}

/** Un dépendant facultatif : interrupteur, numéro/localité, « même position » ou sa propre capture. */
function Dependant(props: {
  id: string;
  titre: string;
  site: SiteSaisi;
  onChange: (site: SiteSaisi) => void;
}) {
  const { id, titre, site, onChange } = props;
  return (
    <View style={styles.dependant}>
      <View style={styles.dependantTete}>
        <ThemedText style={styles.dependantTitre}>{titre}</ThemedText>
        <Switch
          value={site.actif}
          onValueChange={(actif) => onChange({ ...site, actif })}
          trackColor={{ true: EQ.vert, false: EQ.bordure }}
          accessibilityLabel={`Ajouter : ${titre}`}
          testID={`${id}-actif`}
        />
      </View>
      {site.actif && (
        <View style={styles.dependantCorps}>
          <ChampsSite
            id={id}
            numero={site.numero}
            localite={site.localite}
            onNumero={(numero) => onChange({ ...site, numero })}
            onLocalite={(localite) => onChange({ ...site, localite })}
          />
          <CaseALigne
            testID={`${id}-meme-position`}
            coche={site.memePositionQuePrincipal}
            onChange={(coche) => onChange({ ...site, memePositionQuePrincipal: coche })}
            libelle="Même position que le principal"
          />
          {!site.memePositionQuePrincipal && (
            <PositionGps id={id} position={site.position} onChange={(position) => onChange({ ...site, position })} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 10 },
  // Figma : 10 px entre blocs, libellé → champ 6 px (le `gap` de 10 s'y ajoute, d'où −4).
  section: { marginBottom: -4, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  types: { flexDirection: 'row', gap: 6 },
  type: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeActif: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  typeTitre: { fontSize: 12, fontWeight: '700', color: EQ.attenue },
  typeDetail: { fontSize: 9, fontWeight: '500', color: EQ.etiquette },
  equipe: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 42,
    paddingHorizontal: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.vertBordure,
    backgroundColor: EQ.vertLeger,
  },
  equipeEtiquette: { fontSize: 10, fontWeight: '600', color: EQ.vert },
  equipeNom: { fontSize: 12, fontWeight: '700', color: EQ.encre },
  dependant: { borderRadius: 13, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  dependantTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  dependantTitre: { fontSize: 12, fontWeight: '700', color: EQ.encre },
  dependantCorps: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  note: { padding: 8, borderRadius: 9, fontSize: 10, fontWeight: '500', color: EQ.etiquette, backgroundColor: EQ.fond },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, fontWeight: '500', color: EQ.ambre },
  pied: { padding: 16 },
  cta: { height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaTexte: { fontSize: 15, fontWeight: '800', color: EQ.surMarque },
});
