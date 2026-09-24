import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/TimeField';
import { ChoixField } from '@/components/equipe/ChoixField';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { CaseALigne, ChampsSite } from '@/components/site/ChampsSite';
import { PositionGps } from '@/components/site/PositionGps';
import { Fonts } from '@/constants/theme';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { aujourdhuiIso, listAeronefsEquipe } from '@/lib/equipe-db';
import { libelleSite } from '@/lib/equipe-regles';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { type SiteAerienLocal, deplacerSites, listSitesAeriensEquipe } from '@/lib/site-aerien-db';
import { envoyerSitesSiEnLigne } from '@/lib/site-aerien-envoi';
import { type PositionSaisie, validerDeplacement, validerVolMiseEnPlace } from '@/lib/site-aerien-regles';

const SANS_POSITION: PositionSaisie = { latitude: null, longitude: null, altitude: null };

/**
 * Déplacer un site (#643, Figma « Déplacer · Site principal »). Le principal se déplace avec ses
 * dépendants — cochés par défaut, ils prennent la même position, « à affiner ensuite » ; un
 * secondaire se déplace seul. Le vol de mise en place, facultatif, ne concerne que le principal et
 * exige un stand parmi ses dépendants.
 *
 * Tout s'enregistre sur l'appareil (position clôturée à J-1, nouvelle ouverte à J) puis part dans la
 * file d'envoi : on ne bloque jamais l'agent sur le réseau.
 */
export default function SiteDeplacerScreen() {
  const router = useRouter();
  const { siteId, equipeId: equipeParam } = useLocalSearchParams<{ siteId: string; equipeId?: string }>();
  const signalerChargement = useSignalerChargement('site-deplacer');
  const token = useAuthStore((s) => s.token);
  const equipeTravail = useEquipeTravailStore((s) => s.equipeId);
  const equipeId = equipeParam ?? equipeTravail;
  const { run, isRunning } = useAsyncAction();

  const [site, setSite] = useState<SiteAerienLocal | null>(null);
  const [dependants, setDependants] = useState<SiteAerienLocal[]>([]);
  const [aeronefId, setAeronefId] = useState<string | null>(null);
  const [numero, setNumero] = useState('');
  const [localite, setLocalite] = useState('');
  const [position, setPosition] = useState<PositionSaisie>(SANS_POSITION);
  const [coches, setCoches] = useState<Record<string, boolean>>({});
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [standId, setStandId] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);

  useEffect(() => {
    if (!equipeId || !siteId) return;
    Promise.all([listSitesAeriensEquipe(equipeId), listAeronefsEquipe(equipeId, aujourdhuiIso())])
      .then(([sites, aeronefs]) => {
        const courant = sites.find((s) => s.id === siteId) ?? null;
        const deps = sites.filter((s) => s.parent_site_id === siteId);
        setSite(courant);
        setDependants(deps);
        setNumero(courant?.numero ?? '');
        setLocalite(courant?.localite ?? '');
        // « Déplacer aussi » : tous cochés par défaut, l'agent décoche ceux qui restent en place.
        setCoches(Object.fromEntries(deps.map((d) => [d.id, true])));
        setAeronefId(aeronefs[0]?.id ?? null);
      })
      .catch((error) => signalerChargement(error, { source: 'site-deplacer' }));
  }, [equipeId, siteId, signalerChargement]);

  const estPrincipal = site?.parent_site_id === null;
  const volRenseigne = estPrincipal && (debut !== '' || fin !== '' || standId !== null);

  const confirmer = () => {
    const trouvees = validerDeplacement({ numero, localite, position });
    if (volRenseigne) {
      trouvees.push(
        ...validerVolMiseEnPlace({ debut, fin, standId, aeronefId }, { nbStands: dependants.length })
      );
    }
    setErreurs(trouvees);
    if (trouvees.length > 0) return;

    void run(
      async () => {
        await deplacerSites({
          siteId: siteId as string,
          numero,
          localite,
          position,
          dependantIds: dependants.filter((d) => coches[d.id]).map((d) => d.id),
          vol: volRenseigne ? { debut, fin, standId, aeronefId, equipeId: equipeId as string } : null,
        });
        if (token) void envoyerSitesSiEnLigne(token);
        router.back();
      },
      { screen: 'site-deplacer', precondition: !!equipeId && !!siteId && !!site }
    );
  };

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={estPrincipal === false ? 'Déplacer un site secondaire' : 'Déplacer un site'}
        variante="formulaire"
        onRetour={() => router.back()}
      />
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

        {site && (
          <View style={styles.actuel}>
            <ThemedText style={styles.actuelEtiquette}>SITE ACTUEL</ThemedText>
            <ThemedText style={styles.actuelNom}>{libelleSiteAffiche(site)}</ThemedText>
            {site.latitude !== null && site.longitude !== null && (
              <ThemedText style={styles.actuelCoord}>
                {site.latitude}, {site.longitude}
              </ThemedText>
            )}
          </View>
        )}

        <ThemedText style={styles.section}>NOUVELLE POSITION *</ThemedText>
        <ChampsSite
          id="deplacement"
          numeroObligatoire={false}
          numero={numero}
          localite={localite}
          onNumero={setNumero}
          onLocalite={setLocalite}
        />
        <PositionGps id="deplacement" position={position} onChange={setPosition} libelleCapture="Capturer ma position" />

        {estPrincipal && dependants.length > 0 && (
          <>
            <ThemedText style={styles.section}>DÉPLACER AUSSI</ThemedText>
            {dependants.map((d) => (
              <CaseALigne
                key={d.id}
                testID={`deplacer-${d.id}`}
                coche={!!coches[d.id]}
                onChange={(coche) => setCoches({ ...coches, [d.id]: coche })}
                libelle={libelleSite(d)}
                detail="Même position que le principal"
              />
            ))}
          </>
        )}

        {estPrincipal && (
          <View style={styles.vol}>
            <ThemedText style={styles.volTitre}>VOL DE MISE EN PLACE (FACULTATIF)</ThemedText>
            <View style={styles.volHeures}>
              <View style={styles.volHeure} testID="vol-debut">
                <ThemedText style={styles.volEtiquette}>Début</ThemedText>
                <TimeField value={debut || null} onChange={setDebut} />
              </View>
              <View style={styles.volHeure} testID="vol-fin">
                <ThemedText style={styles.volEtiquette}>Fin</ThemedText>
                <TimeField value={fin || null} onChange={setFin} />
              </View>
            </View>
            <ThemedText style={styles.volEtiquette}>Stand *</ThemedText>
            <ChoixField
              etiquette="Stand"
              valeur={standId}
              options={dependants.map((d) => ({ valeur: d.id, libelle: libelleSite(d) }))}
              onChoisir={setStandId}
              placeholder={dependants.length === 0 ? 'Aucun stand pour ce site' : '— choisir —'}
            />
          </View>
        )}
      </ScrollView>

      <View style={styles.pied}>
        <TouchableOpacity
          style={[styles.cta, isRunning && { opacity: 0.6 }]}
          onPress={confirmer}
          disabled={isRunning}
          accessibilityRole="button"
          testID="deplacement-confirmer"
        >
          <ThemedText style={styles.ctaTexte}>Confirmer le déplacement</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const libelleSiteAffiche = (site: SiteAerienLocal) => libelleSite(site).replace(' · ', ' · n°');

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 10 },
  section: { marginTop: 6, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  actuel: { gap: 3, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  actuelEtiquette: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  actuelNom: { fontSize: 13, fontWeight: '700', color: EQ.encre },
  actuelCoord: { fontSize: 10, fontWeight: '500', fontFamily: Fonts.mono, color: EQ.etiquette },
  vol: { gap: 6, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  volTitre: { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.4, color: EQ.ambre },
  volHeures: { flexDirection: 'row', gap: 12 },
  volHeure: { flex: 1, gap: 3 },
  volEtiquette: { fontSize: 9, fontWeight: '600', color: EQ.attenue },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, fontWeight: '500', color: EQ.ambre },
  pied: { padding: 16 },
  cta: { height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaTexte: { fontSize: 15, fontWeight: '800', color: EQ.surMarque },
});
