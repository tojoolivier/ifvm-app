import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { Fonts } from '@/constants/theme';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { aujourdhuiIso, listAeronefsEquipe, listEquipesAvecChef } from '@/lib/equipe-db';
import { jourMois, libelleSite } from '@/lib/equipe-regles';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import {
  type PositionLocale,
  type SiteAerienLocal,
  listPositionsSite,
  listSitesAeriensEquipe,
} from '@/lib/site-aerien-db';
import { dureeImplantationJours } from '@/lib/site-aerien-regles';

const coordonnees = (site: { latitude: number | null; longitude: number | null }) =>
  site.latitude !== null && site.longitude !== null ? `${site.latitude}, ${site.longitude}` : 'Position à capturer';

const heureLocale = () => {
  const maintenant = new Date();
  return `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`;
};

/** Ce que l'agent lit d'un site pas encore parti ou refusé — l'état survit à l'écran, il est en base. */
const ETAT_SYNC: Record<string, string | undefined> = { local: 'À envoyer', echec: 'Refusé' };

/**
 * Sites aériens d'une équipe (#643, Figma « Sites aériens · Équipe Sud ») : le site principal avec
 * ses dépendants (stand, base secondaire), la position active, la durée d'implantation dérivée et
 * l'historique des positions. Tout se lit sur l'appareil ; les sites créés ou déplacés hors-ligne y
 * apparaissent aussitôt, marqués « À envoyer ».
 */
export default function SitesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const equipeTravail = useEquipeTravailStore((s) => s.equipeId);
  const equipeId = id ?? equipeTravail;
  const signalerChargement = useSignalerChargement('sites');

  const [nomEquipe, setNomEquipe] = useState('');
  const [immatriculation, setImmatriculation] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteAerienLocal[]>([]);
  const [historique, setHistorique] = useState<PositionLocale[]>([]);
  const [recherche, setRecherche] = useState('');
  const [chargeA, setChargeA] = useState(heureLocale());

  const charger = useCallback(() => {
    if (!equipeId) return Promise.resolve();
    return Promise.all([listEquipesAvecChef(), listSitesAeriensEquipe(equipeId), listAeronefsEquipe(equipeId, aujourdhuiIso())])
      .then(async ([equipes, liste, aeronefs]) => {
        setNomEquipe(equipes.find((e) => e.id === equipeId)?.nom ?? '');
        setImmatriculation(aeronefs[0]?.immatriculation ?? null);
        setSites(liste);
        const principal = liste.find((s) => s.parent_site_id === null);
        setHistorique(principal ? await listPositionsSite(principal.id) : []);
        setChargeA(heureLocale());
      })
      .catch((error) => signalerChargement(error, { equipeId }));
  }, [equipeId, signalerChargement]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger])
  );

  // La recherche cherche dans le numéro et la localité. Le principal reste affiché tant que lui ou
  // l'un de ses dépendants correspond : c'est lui qui porte le bouton « Déplacer » et l'historique.
  const filtre = recherche.trim().toLowerCase();
  const correspond = (s: SiteAerienLocal) => `${s.numero} ${s.localite}`.toLowerCase().includes(filtre);
  const principalBrut = sites.find((s) => s.parent_site_id === null) ?? null;
  const dependantsBruts = sites.filter((s) => s.parent_site_id !== null);
  const principalCorrespond = !filtre || (principalBrut !== null && correspond(principalBrut));
  const dependants = principalCorrespond ? dependantsBruts : dependantsBruts.filter(correspond);
  const principal = principalCorrespond || dependants.length > 0 ? principalBrut : null;
  const aujourdhui = aujourdhuiIso();
  const positionActive = historique.find((p) => p.date_fin === null) ?? null;

  const vers = (chemin: string, siteId?: string) =>
    router.push(`${chemin}?equipeId=${equipeId}${siteId ? `&siteId=${siteId}` : ''}` as any);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={nomEquipe || 'Sites aériens'}
        sousTitre="Sites aériens"
        onRetour={() => router.back()}
        action={{ libelle: '+ Site', onPress: () => vers('/(app)/site-nouveau') }}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.recherche}>
          <ThemedText style={styles.loupe}>⌕</ThemedText>
          <TextInput
            style={styles.rechercheSaisie}
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Rechercher un site…"
            placeholderTextColor={EQ.etiquette}
            accessibilityLabel="Rechercher un site"
          />
          <EquipeBadge texte={`Local · ${chargeA}`} />
        </View>

        {!equipeId && (
          <ThemedText style={styles.vide}>Choisissez d’abord votre équipe de travail pour voir ses sites.</ThemedText>
        )}
        {equipeId && sites.length === 0 && (
          <ThemedText style={styles.vide}>Aucun site pour cette équipe. Créez le premier avec « + Site ».</ThemedText>
        )}

        {principal && (
          <View style={styles.principal} testID="site-principal">
            <View style={styles.tete}>
              <EquipeBadge texte="PRINCIPALE" ton="vertPlein" />
              {ETAT_SYNC[principal.statut_sync] && (
                <EquipeBadge texte={ETAT_SYNC[principal.statut_sync] as string} ton="neutre" />
              )}
              {immatriculation && <ThemedText style={styles.immat}>{immatriculation}</ThemedText>}
            </View>
            <ThemedText style={styles.nom}>
              {principal.localite} · n°{principal.numero}
            </ThemedText>
            <ThemedText style={styles.coord}>{coordonnees(principal)}</ThemedText>
            {principal.date_debut_position && (
              <ThemedText style={styles.depuis}>
                Depuis le {jourMois(principal.date_debut_position)} ·{' '}
                {dureeImplantationJours(principal.date_debut_position, null, aujourdhui)} jours
              </ThemedText>
            )}

            {dependants.map((d) => (
              <View key={d.id} style={styles.dependant} testID={`site-dependant-${d.id}`}>
                <ThemedText style={styles.branche}>└</ThemedText>
                <View style={styles.dependantTexte}>
                  <ThemedText style={styles.dependantNom}>{libelleSite(d)}</ThemedText>
                  <ThemedText style={styles.dependantCoord}>{coordonnees(d)}</ThemedText>
                </View>
                <View style={styles.dependantDroite}>
                  <EquipeBadge texte={ETAT_SYNC[d.statut_sync] ?? 'SECONDAIRE'} ton="neutre" />
                  <TouchableOpacity
                    onPress={() => vers('/(app)/site-deplacer', d.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Déplacer ${libelleSite(d)}`}
                    hitSlop={8}
                  >
                    <ThemedText style={styles.deplacer}>Déplacer</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {historique.length > 0 && (
              <View style={styles.historique}>
                <ThemedText style={styles.historiqueTitre}>HISTORIQUE</ThemedText>
                {historique.map((p) => (
                  <View key={p.id} style={styles.historiqueLigne}>
                    <View style={[styles.puce, p.date_fin !== null && { backgroundColor: EQ.etiquette }]} />
                    <ThemedText style={[styles.historiqueTexte, p.date_fin !== null && { color: EQ.etiquette }]}>
                      {p.localite} · {jourMois(p.date_debut)} → {p.date_fin ? jourMois(p.date_fin) : 'actuel'}
                      {p.date_fin ? ` (${dureeImplantationJours(p.date_debut, p.date_fin, aujourdhui)} j)` : ''}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {filtre && sites.length > 0 && !principal && (
          <ThemedText style={styles.vide}>Aucun site ne correspond à « {recherche.trim()} ».</ThemedText>
        )}

        {principal && (
          <TouchableOpacity
            style={styles.deplacerBouton}
            onPress={() => vers('/(app)/site-deplacer', principal.id)}
            accessibilityRole="button"
            testID="deplacer-principal"
          >
            <ThemedText style={styles.deplacerBoutonTexte}>Déplacer : installer à ma position</ThemedText>
          </TouchableOpacity>
        )}
        {positionActive === null && principal && historique.length === 0 && (
          <ThemedText style={styles.vide}>Ce site n’a pas encore de position enregistrée.</ThemedText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 10 },
  recherche: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  loupe: { fontSize: 13, color: EQ.etiquette },
  rechercheSaisie: { flex: 1, fontSize: 12.5, fontWeight: '500', color: EQ.encre, padding: 0 },
  vide: { padding: 12, fontSize: 12, fontWeight: '500', color: EQ.etiquette },
  principal: { gap: 4, padding: 8.5, borderRadius: 13, borderWidth: 1.5, borderColor: EQ.vert, backgroundColor: EQ.carte },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  immat: { marginLeft: 'auto', fontSize: 10.5, fontWeight: '600', fontFamily: Fonts.mono, color: EQ.etiquette },
  nom: { marginTop: 3, fontSize: 15, fontWeight: '700', color: EQ.encre },
  coord: { marginTop: -3, fontSize: 11.5, fontWeight: '500', fontFamily: Fonts.mono, color: EQ.attenue },
  depuis: { marginTop: -2, fontSize: 11.5, fontWeight: '500', color: EQ.attenue },
  dependant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: EQ.separateur,
  },
  branche: { fontSize: 12, color: EQ.etiquette },
  dependantTexte: { flex: 1, gap: 1 },
  dependantNom: { fontSize: 12.5, fontWeight: '600', color: EQ.encre },
  dependantCoord: { fontSize: 10.5, fontWeight: '500', fontFamily: Fonts.mono, color: EQ.etiquette },
  dependantDroite: { alignItems: 'flex-end', gap: 4 },
  deplacer: { fontSize: 11.5, fontWeight: '700', color: EQ.vert },
  historique: { gap: 4, marginTop: 6, paddingTop: 7, borderTopWidth: 1, borderTopColor: EQ.separateur },
  historiqueTitre: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  historiqueLigne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  puce: { width: 7, height: 7, borderRadius: 4, backgroundColor: EQ.vert },
  historiqueTexte: { fontSize: 11.5, fontWeight: '500', color: EQ.attenue },
  deplacerBouton: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: EQ.vert,
    backgroundColor: EQ.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deplacerBoutonTexte: { fontSize: 12.5, fontWeight: '700', color: EQ.vert },
});
