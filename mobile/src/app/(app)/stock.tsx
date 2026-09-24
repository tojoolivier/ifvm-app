import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { peutSaisirStock } from '@/lib/equipe-aerienne-access';
import { listSitesEquipe } from '@/lib/equipe-db';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { type Pesticide, listPesticides } from '@/lib/referentiel-db';
import {
  type MouvementLocal,
  type SiteStock,
  listMouvementsPourSolde,
  listMouvementsSite,
  listSitesPrincipaux,
  listSoldesServeur,
} from '@/lib/stock-db';
import { envoyerStockSiEnLigne } from '@/lib/stock-envoi';
import {
  type LigneSolde,
  calculerSoldes,
  formaterQuantite,
  formaterVariation,
} from '@/lib/stock-regles';

const jourMois = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const libelleSite = (s: SiteStock) => `${s.localite} · n°${s.numero}`;

/** Variation d'un mouvement vu depuis le site affiché : un transfert y est sortant ou entrant. */
function variationDe(m: MouvementLocal, siteId: string): number {
  if (m.type === 'approvisionnement') return m.quantite;
  return m.site_id === siteId ? -m.quantite : m.quantite;
}

function libelleMouvement(m: MouvementLocal, siteId: string): string {
  if (m.type === 'approvisionnement') return 'Approvisionnement';
  return m.site_id === siteId ? 'Transfert sortant' : 'Transfert entrant';
}

/**
 * Stock de pesticides (#645, Figma 81:588) : le solde du site par produit et **par unité** — L et kg
 * ne s'additionnent jamais, chaque (produit, unité) a sa ligne. Le solde affiché est le dernier solde
 * synchronisé plus les mouvements saisis ici et pas encore partis ; ces derniers sont étiquetés
 * « en attente » pour ne pas passer pour du solde serveur.
 */
export default function StockScreen() {
  const router = useRouter();
  const signalerChargement = useSignalerChargement('stock');
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const equipeId = useEquipeTravailStore((s) => s.equipeId);

  const [sites, setSites] = useState<SiteStock[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [choixSite, setChoixSite] = useState(false);
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [lignes, setLignes] = useState<LigneSolde[]>([]);
  const [mouvements, setMouvements] = useState<MouvementLocal[]>([]);

  const charger = useCallback(
    async (siteCourant: string | null) => {
      const [tous, principaux, produits] = await Promise.all([
        listSitesPrincipaux(),
        equipeId ? listSitesEquipe(equipeId) : Promise.resolve([]),
        listPesticides(),
      ]);
      const choisi = siteCourant ?? principaux.find((s) => !s.parent_site_id)?.id ?? tous[0]?.id ?? null;
      setSites(tous);
      setPesticides(produits);
      setSiteId(choisi);
      if (!choisi) return;
      const [soldes, enAttente, derniers] = await Promise.all([
        listSoldesServeur(),
        listMouvementsPourSolde(),
        listMouvementsSite(choisi),
      ]);
      setLignes(calculerSoldes(soldes, enAttente, choisi));
      setMouvements(derniers);
    },
    [equipeId]
  );

  useFocusEffect(
    useCallback(() => {
      charger(siteId).catch((error) => signalerChargement(error, { source: 'stock' }));
      // Envoi puis rechargement : le solde serveur peut avoir bougé pendant qu'on était hors-ligne.
      if (token) {
        void envoyerStockSiEnLigne(token).then(() =>
          charger(siteId).catch((error) => signalerChargement(error, { source: 'stock' }))
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- rejoué au focus, pas à chaque choix de site
    }, [charger, token, signalerChargement])
  );

  const site = sites.find((s) => s.id === siteId) ?? null;
  const nomProduit = (id: string) => pesticides.find((p) => p.id === id)?.nom ?? 'Produit inconnu';

  const choisirSite = (id: string) => {
    setChoixSite(false);
    setSiteId(id);
    charger(id).catch((error) => signalerChargement(error, { source: 'stock' }));
  };

  const ouvrir = (type: 'approvisionnement' | 'transfert') =>
    router.push({ pathname: '/(app)/stock-mouvement', params: { type, siteId: siteId ?? '' } });

  return (
    <View style={styles.racine}>
      <EquipeHeader titre="Stock pesticides" sousTitre={site ? libelleSite(site) : undefined} onRetour={() => router.back()} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <TouchableOpacity
          testID="stock-site"
          style={styles.siteSel}
          onPress={() => setChoixSite((ouvert) => !ouvert)}
          accessibilityRole="button"
          accessibilityLabel="Changer de site"
        >
          <ThemedText style={styles.siteTexte}>Site : {site ? libelleSite(site) : 'aucun site'}</ThemedText>
          <ThemedText style={styles.chevron}>▼</ThemedText>
        </TouchableOpacity>
        {choixSite &&
          sites.map((s) => (
            <TouchableOpacity
              key={s.id}
              testID={`stock-site-${s.id}`}
              style={styles.siteOption}
              onPress={() => choisirSite(s.id)}
              accessibilityRole="button"
            >
              <ThemedText style={styles.siteTexte}>{libelleSite(s)}</ThemedText>
            </TouchableOpacity>
          ))}

        <ThemedText style={styles.section}>SOLDES</ThemedText>
        {lignes.length === 0 && <ThemedText style={styles.vide}>Aucun stock enregistré pour ce site.</ThemedText>}
        {lignes.map((l) => (
          <View key={`${l.pesticideId}|${l.unite}`} style={styles.solde} testID={`stock-solde-${l.pesticideId}-${l.unite}`}>
            <View style={styles.icone}>
              <ThemedText style={styles.iconeTexte}>⬡</ThemedText>
            </View>
            <View style={styles.produit}>
              <ThemedText style={styles.produitNom} numberOfLines={1}>
                {nomProduit(l.pesticideId)}
              </ThemedText>
              {l.enAttente !== 0 && (
                <ThemedText style={styles.enAttente} testID={`stock-en-attente-${l.pesticideId}-${l.unite}`}>
                  ⏳ {formaterVariation(l.enAttente, l.unite)} en attente · serveur {formaterQuantite(l.serveur)}
                </ThemedText>
              )}
            </View>
            <View style={styles.quantite}>
              <ThemedText style={styles.quantiteValeur}>{formaterQuantite(l.affiche)}</ThemedText>
              <ThemedText style={styles.quantiteUnite}>{l.unite}</ThemedText>
            </View>
          </View>
        ))}

        {mouvements.length > 0 && <ThemedText style={styles.section}>DERNIERS MOUVEMENTS</ThemedText>}
        {siteId &&
          mouvements.map((m) => {
            const variation = variationDe(m, siteId);
            const enAttente = m.statut_sync === 'local';
            const refuse = m.statut_sync === 'echec';
            return (
              <View key={m.id} style={styles.mouvement} testID={`stock-mouvement-${m.id}`}>
                <View>
                  <ThemedText style={styles.mouvementTitre}>{libelleMouvement(m, siteId)}</ThemedText>
                  <ThemedText style={styles.mouvementSous}>
                    {nomProduit(m.pesticide_id)} · {jourMois(m.date_mouvement)}
                    {refuse ? ' · Refusé' : enAttente ? ' · ⏳ Local' : ''}
                  </ThemedText>
                </View>
                <View style={[styles.badge, variation > 0 ? styles.badgeEntree : styles.badgeSortie]}>
                  <ThemedText style={[styles.badgeTexte, { color: variation > 0 ? EQ.vert : EQ.ambre }]}>
                    {formaterVariation(variation, m.unite)}
                  </ThemedText>
                </View>
              </View>
            );
          })}

        {peutSaisirStock(role) && (
          <View style={styles.actions}>
            <TouchableOpacity
              testID="stock-approvisionner"
              style={[styles.bouton, styles.boutonPlein, !siteId && styles.desactive]}
              disabled={!siteId}
              onPress={() => ouvrir('approvisionnement')}
              accessibilityRole="button"
            >
              <ThemedText style={styles.boutonPleinTexte}>+ Approvisionner</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              testID="stock-transferer"
              style={[styles.bouton, styles.boutonContour, !siteId && styles.desactive]}
              disabled={!siteId}
              onPress={() => ouvrir('transfert')}
              accessibilityRole="button"
            >
              <ThemedText style={styles.boutonContourTexte}>↔ Transférer</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 8 },
  siteSel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  siteOption: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  siteTexte: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: EQ.encre },
  chevron: { fontSize: 10, lineHeight: 13, color: EQ.etiquette },
  section: { marginTop: 4, fontSize: 9, lineHeight: 11, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  vide: { fontSize: 11, lineHeight: 14, fontWeight: '500', color: EQ.attenue },
  solde: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  icone: { width: 32, height: 32, borderRadius: 9, backgroundColor: EQ.vertLeger, alignItems: 'center', justifyContent: 'center' },
  iconeTexte: { fontSize: 14, lineHeight: 18, color: EQ.encre },
  produit: { flex: 1, gap: 2 },
  produitNom: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: EQ.encre },
  enAttente: { fontSize: 9, lineHeight: 12, fontWeight: '600', color: EQ.ambre },
  quantite: { alignItems: 'flex-end', minWidth: 44 },
  quantiteValeur: { fontSize: 16, lineHeight: 20, fontWeight: '700', color: EQ.encre },
  quantiteUnite: { fontSize: 10, lineHeight: 13, fontWeight: '500', color: EQ.attenue },
  mouvement: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  mouvementTitre: { fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: EQ.encre },
  mouvementSous: { fontSize: 9, lineHeight: 12, fontWeight: '500', color: EQ.etiquette },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeEntree: { backgroundColor: EQ.vertDoux },
  badgeSortie: { backgroundColor: EQ.ambreFond },
  badgeTexte: { fontSize: 9, lineHeight: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  bouton: { flex: 1, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  boutonPlein: { backgroundColor: EQ.vert },
  boutonContour: { backgroundColor: EQ.carte, borderWidth: 1, borderColor: EQ.vert },
  boutonPleinTexte: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: EQ.surMarque },
  boutonContourTexte: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: EQ.vert },
  desactive: { opacity: 0.5 },
});
