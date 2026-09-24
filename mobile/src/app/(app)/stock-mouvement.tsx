import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { type Pesticide, listPesticides } from '@/lib/referentiel-db';
import { type SiteStock, creerMouvement, listSitesActifs } from '@/lib/stock-db';
import { envoyerStockSiEnLigne } from '@/lib/stock-envoi';
import { type TypeMouvementSaisi, type UniteStock, validerMouvement } from '@/lib/stock-regles';

const UNITES: UniteStock[] = ['L', 'kg'];
const libelleSite = (s: SiteStock) => `${s.localite} · n°${s.numero}`;

/**
 * Saisie d'un approvisionnement ou d'un transfert (#645). Le site de destination n'existe que pour
 * le transfert. Enregistré sur l'appareil, envoyé ensuite (idempotent par id client, #639) : marche
 * hors-ligne. La consommation n'est jamais saisie ici, le serveur la génère (#609).
 */
export default function StockMouvementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; siteId?: string }>();
  const type: TypeMouvementSaisi = params.type === 'transfert' ? 'transfert' : 'approvisionnement';
  const signalerChargement = useSignalerChargement('stock-mouvement');
  const token = useAuthStore((s) => s.token);
  const { run, isRunning } = useAsyncAction();

  const [sites, setSites] = useState<SiteStock[]>([]);
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [pesticideId, setPesticideId] = useState<string | null>(null);
  const [unite, setUnite] = useState<UniteStock>('L');
  const [quantite, setQuantite] = useState('');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);

  const siteId = params.siteId || null;
  const transfert = type === 'transfert';

  useEffect(() => {
    Promise.all([listSitesActifs(), listPesticides()])
      .then(([tousSites, produits]) => {
        setSites(tousSites);
        setPesticides(produits);
      })
      .catch((error) => signalerChargement(error, { source: 'stock-mouvement' }));
  }, [signalerChargement]);

  const source = sites.find((s) => s.id === siteId);

  const enregistrer = () => {
    const saisie = { type, pesticideId, siteId, siteDestinationId: destinationId, quantite, unite };
    const trouvees = validerMouvement(saisie);
    setErreurs(trouvees);
    if (trouvees.length > 0) return;

    void run(
      async () => {
        await creerMouvement(saisie);
        if (token) void envoyerStockSiEnLigne(token);
        router.back();
      },
      { screen: 'stock-mouvement' }
    );
  };

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={transfert ? 'Transférer du stock' : 'Approvisionner'}
        sousTitre={source ? libelleSite(source) : undefined}
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

        <ThemedText style={styles.etiquette}>Produit *</ThemedText>
        <View style={styles.choix}>
          {pesticides.map((p) => {
            const actif = p.id === pesticideId;
            return (
              <TouchableOpacity
                key={p.id}
                testID={`stock-produit-${p.id}`}
                style={[styles.chip, actif && styles.chipActif]}
                onPress={() => setPesticideId(p.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
              >
                <ThemedText style={[styles.chipTexte, actif && styles.chipTexteActif]}>{p.nom}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <ThemedText style={styles.etiquette}>Unité *</ThemedText>
        <View style={styles.choix}>
          {UNITES.map((u) => {
            const actif = u === unite;
            return (
              <TouchableOpacity
                key={u}
                testID={`stock-unite-${u}`}
                style={[styles.chip, styles.chipUnite, actif && styles.chipActif]}
                onPress={() => setUnite(u)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
              >
                <ThemedText style={[styles.chipTexte, actif && styles.chipTexteActif]}>{u}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <ThemedText style={styles.etiquette}>Quantité *</ThemedText>
        <TextInput
          testID="stock-quantite"
          style={[styles.champ, styles.champTexte]}
          value={quantite}
          onChangeText={setQuantite}
          keyboardType="decimal-pad"
          placeholder={`0 ${unite}`}
          placeholderTextColor={EQ.etiquette}
        />

        {transfert && (
          <>
            <ThemedText style={styles.etiquette}>Site de destination *</ThemedText>
            <View style={styles.choix}>
              {sites
                .filter((s) => s.id !== siteId)
                .map((s) => {
                  const actif = s.id === destinationId;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      testID={`stock-destination-${s.id}`}
                      style={[styles.chip, actif && styles.chipActif]}
                      onPress={() => setDestinationId(s.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: actif }}
                    >
                      <ThemedText style={[styles.chipTexte, actif && styles.chipTexteActif]}>{libelleSite(s)}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.pied}>
        <TouchableOpacity
          style={[styles.cta, isRunning && { opacity: 0.6 }]}
          onPress={enregistrer}
          disabled={isRunning}
          accessibilityRole="button"
          testID="stock-enregistrer"
        >
          <ThemedText style={styles.ctaTexte}>Enregistrer</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 6 },
  etiquette: { fontSize: 10, lineHeight: 12, fontWeight: '600', color: EQ.attenue, marginTop: 4 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  chipUnite: { minWidth: 56, alignItems: 'center' },
  chipActif: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  chipTexte: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: EQ.attenue },
  chipTexteActif: { color: EQ.surMarque },
  champ: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, paddingHorizontal: 11 },
  champTexte: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: EQ.encre },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, lineHeight: 14, fontWeight: '500', color: EQ.ambre },
  pied: { padding: 16 },
  cta: { height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaTexte: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: EQ.surMarque },
});
