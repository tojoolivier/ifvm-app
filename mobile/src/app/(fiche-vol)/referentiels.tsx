import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { getCurrentPosition } from '@/lib/location';
import { useAsyncAction } from '@/hooks/use-async-action';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

interface Chef {
  id: string;
  nom: string;
  prenom: string;
}

interface Equipe {
  id: string;
  nom: string;
  chef_de_base_id: string;
}

interface Base {
  id: string;
  numero: string;
  localite: string;
  parent_base_id: string | null;
  equipe_id: string | null;
}

interface Stand {
  id: string;
  numero: string;
  localite: string;
}

/**
 * Écran de gestion des référentiels de la fiche de vol (#equipe-aerienne) :
 * équipes aériennes, bases principales, bases secondaires, stands de
 * remplissage. Cardinalités (confirmées avec l'utilisateur le 2026-09-16) :
 * 1 équipe = 1 chef de base = 1 base principale ; une base secondaire hérite
 * de l'équipe de sa principale. En ligne uniquement, comme tous les
 * référentiels de la fiche de vol (pas de synchronisation hors-ligne).
 */
export default function ReferentielsAeriensScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [chefs, setChefs] = useState<Chef[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { run: runChargement, isRunning: isChargement } = useAsyncAction();

  const charger = () =>
    runChargement(
      async () => {
        const [chefsRes, equipesRes, basesRes, standsRes] = await Promise.all([
          apiClient.listChefsDeBase(token!),
          apiClient.listEquipesAeriennes(token!),
          apiClient.listBasesAeriennes(token!),
          apiClient.listStandsRemplissage(token!),
        ]);
        setChefs(chefsRes);
        setEquipes(equipesRes);
        setBases(basesRes);
        setStands(standsRes);
        setLoaded(true);
      },
      { screen: 'referentiels-aeriens', precondition: !!token }
    );

  if (!loaded) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Référentiels aériens</Text>
          </View>
          <View style={styles.centre}>
            {isChargement ? (
              <ActivityIndicator color={GREEN} />
            ) : (
              <TouchableOpacity onPress={charger} accessibilityRole="button">
                <Text style={styles.chargerLinkText}>Charger les référentiels ›</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const chefsById = new Map(chefs.map((c) => [c.id, c]));
  const equipesById = new Map(equipes.map((e) => [e.id, e]));
  const basesById = new Map(bases.map((b) => [b.id, b]));
  const basesPrincipales = bases.filter((b) => b.parent_base_id === null);
  const basesSecondaires = bases.filter((b) => b.parent_base_id !== null);
  const chefsLibres = chefs.filter((c) => !equipes.some((e) => e.chef_de_base_id === c.id));
  const equipesLibres = equipes.filter((e) => !bases.some((b) => b.equipe_id === e.id));

  const nomChef = (chefId: string) => {
    const chef = chefsById.get(chefId);
    return chef ? `${chef.prenom} ${chef.nom}` : '—';
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Référentiels aériens</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <SectionEquipes
            equipes={equipes}
            chefsLibres={chefsLibres}
            nomChef={nomChef}
            token={token!}
            onCreated={(e) => setEquipes((prev) => [...prev, e])}
          />

          <SectionBasePrincipale
            basesPrincipales={basesPrincipales}
            equipes={equipes}
            equipesLibres={equipesLibres}
            equipesById={equipesById}
            token={token!}
            onCreated={(b) => setBases((prev) => [...prev, b])}
          />

          <SectionBaseSecondaire
            basesSecondaires={basesSecondaires}
            basesPrincipales={basesPrincipales}
            basesById={basesById}
            token={token!}
            onCreated={(b) => setBases((prev) => [...prev, b])}
          />

          <SectionStand
            stands={stands}
            token={token!}
            onCreated={(s) => setStands((prev) => [...prev, s])}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SectionEquipes({
  equipes,
  chefsLibres,
  nomChef,
  token,
  onCreated,
}: {
  equipes: Equipe[];
  chefsLibres: Chef[];
  nomChef: (chefId: string) => string;
  token: string;
  onCreated: (equipe: Equipe) => void;
}) {
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [chefDeBaseId, setChefDeBaseId] = useState<string | null>(null);
  const { run, isRunning } = useAsyncAction();

  const creer = () =>
    run(
      async () => {
        const cree = await apiClient.createEquipeAerienne(token, {
          nom: nom.trim(),
          chef_de_base_id: chefDeBaseId!,
        });
        onCreated({ id: cree.id, nom: cree.nom, chef_de_base_id: cree.chef_de_base_id });
        setCreation(false);
        setNom('');
        setChefDeBaseId(null);
      },
      {
        screen: 'referentiels-aeriens',
        precondition: !!token && nom.trim().length > 0 && !!chefDeBaseId,
        preconditionMessage: 'Renseignez le nom et choisissez un chef de base avant de créer l’équipe.',
      }
    );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>ÉQUIPES AÉRIENNES</Text>
      {equipes.length === 0 && <Text style={styles.vide}>Aucune équipe aérienne.</Text>}
      {equipes.map((equipe) => (
        <View key={equipe.id} style={styles.item}>
          <Text style={styles.itemText}>{equipe.nom}</Text>
          <Text style={styles.itemSubtext}>Chef de base : {nomChef(equipe.chef_de_base_id)}</Text>
        </View>
      ))}

      {!creation && (
        <TouchableOpacity style={styles.nouveauLink} onPress={() => setCreation(true)} accessibilityRole="button">
          <Text style={styles.nouveauLinkText}>+ Nouvelle équipe aérienne</Text>
        </TouchableOpacity>
      )}

      {creation && (
        <View style={styles.formulaire}>
          <TextInput
            value={nom}
            onChangeText={setNom}
            placeholder="Nom de l'équipe"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <Text style={styles.sousLabel}>Chef de base</Text>
          {chefsLibres.length === 0 && (
            <Text style={styles.vide}>Aucun chef de base disponible (tous dirigent déjà une équipe).</Text>
          )}
          <View style={styles.chipsRow}>
            {chefsLibres.map((chef) => (
              <TouchableOpacity
                key={chef.id}
                style={[styles.chip, chefDeBaseId === chef.id && styles.chipSelectionne]}
                onPress={() => setChefDeBaseId(chef.id)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, chefDeBaseId === chef.id && styles.chipTextSelectionne]}>
                  {chef.prenom} {chef.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => setCreation(false)} accessibilityRole="button">
              <Text style={styles.annulerText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.creerButton, isRunning && styles.creerButtonDisabled]}
              onPress={creer}
              disabled={isRunning}
              accessibilityRole="button"
            >
              <Text style={styles.creerButtonText}>{isRunning ? 'Création…' : 'Créer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function useGps() {
  const [position, setPosition] = useState<{ latitude: number; longitude: number; altitude: number | null } | null>(
    null
  );
  const { run, isRunning } = useAsyncAction();
  const capturer = () =>
    run(
      async () => {
        const pos = await getCurrentPosition();
        setPosition({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });
      },
      { screen: 'referentiels-aeriens' }
    );
  return { position, isGpsLoading: isRunning, capturer, reset: () => setPosition(null) };
}

function SectionBasePrincipale({
  basesPrincipales,
  equipes,
  equipesLibres,
  equipesById,
  token,
  onCreated,
}: {
  basesPrincipales: Base[];
  equipes: Equipe[];
  equipesLibres: Equipe[];
  equipesById: Map<string, Equipe>;
  token: string;
  onCreated: (base: Base) => void;
}) {
  const [creation, setCreation] = useState(false);
  const [numero, setNumero] = useState('');
  const [localite, setLocalite] = useState('');
  const [equipeId, setEquipeId] = useState<string | null>(null);
  const { position, isGpsLoading, capturer, reset } = useGps();
  const { run, isRunning } = useAsyncAction();

  const ouvrir = () => {
    setCreation(true);
    void capturer();
  };

  const creer = () =>
    run(
      async () => {
        const cree = await apiClient.createBaseAerienne(token, {
          numero: numero.trim(),
          localite: localite.trim(),
          equipe_id: equipeId,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          altitude: position?.altitude ?? null,
        });
        onCreated({
          id: cree.id,
          numero: cree.numero,
          localite: cree.localite,
          parent_base_id: cree.parent_base_id,
          equipe_id: cree.equipe_id,
        });
        setCreation(false);
        setNumero('');
        setLocalite('');
        setEquipeId(null);
        reset();
      },
      {
        screen: 'referentiels-aeriens',
        precondition: !!token && numero.trim().length > 0 && localite.trim().length > 0 && !!equipeId,
        preconditionMessage: 'Renseignez le numéro, la localité et l’équipe avant de créer la base.',
      }
    );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>BASES PRINCIPALES</Text>
      {basesPrincipales.length === 0 && <Text style={styles.vide}>Aucune base principale.</Text>}
      {basesPrincipales.map((base) => (
        <View key={base.id} style={styles.item}>
          <Text style={styles.itemText}>
            {base.numero} — {base.localite}
          </Text>
          <Text style={styles.itemSubtext}>
            Équipe : {base.equipe_id ? equipesById.get(base.equipe_id)?.nom ?? '—' : '—'}
          </Text>
        </View>
      ))}

      {equipes.length === 0 ? (
        <Text style={styles.vide}>Créez d’abord une équipe aérienne.</Text>
      ) : !creation ? (
        <TouchableOpacity style={styles.nouveauLink} onPress={ouvrir} accessibilityRole="button">
          <Text style={styles.nouveauLinkText}>+ Nouvelle base principale</Text>
        </TouchableOpacity>
      ) : null}

      {creation && (
        <View style={styles.formulaire}>
          <TextInput
            value={numero}
            onChangeText={setNumero}
            placeholder="Numéro (ex. IHO01)"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <TextInput
            value={localite}
            onChangeText={setLocalite}
            placeholder="Localité"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <Text style={styles.sousLabel}>Équipe</Text>
          {equipesLibres.length === 0 && (
            <Text style={styles.vide}>Toutes les équipes possèdent déjà une base principale.</Text>
          )}
          <View style={styles.chipsRow}>
            {equipesLibres.map((equipe) => (
              <TouchableOpacity
                key={equipe.id}
                style={[styles.chip, equipeId === equipe.id && styles.chipSelectionne]}
                onPress={() => setEquipeId(equipe.id)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, equipeId === equipe.id && styles.chipTextSelectionne]}>
                  {equipe.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsRowText}>Coordonnées (auto, facultatif)</Text>
            <Text style={styles.gpsValue}>
              {isGpsLoading
                ? 'Localisation…'
                : position
                  ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
                  : '—'}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => setCreation(false)} accessibilityRole="button">
              <Text style={styles.annulerText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.creerButton, isRunning && styles.creerButtonDisabled]}
              onPress={creer}
              disabled={isRunning}
              accessibilityRole="button"
            >
              <Text style={styles.creerButtonText}>{isRunning ? 'Création…' : 'Créer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function SectionBaseSecondaire({
  basesSecondaires,
  basesPrincipales,
  basesById,
  token,
  onCreated,
}: {
  basesSecondaires: Base[];
  basesPrincipales: Base[];
  basesById: Map<string, Base>;
  token: string;
  onCreated: (base: Base) => void;
}) {
  const [creation, setCreation] = useState(false);
  const [numero, setNumero] = useState('');
  const [localite, setLocalite] = useState('');
  const [parentBaseId, setParentBaseId] = useState<string | null>(null);
  const { position, isGpsLoading, capturer, reset } = useGps();
  const { run, isRunning } = useAsyncAction();

  const ouvrir = () => {
    setCreation(true);
    void capturer();
  };

  const creer = () =>
    run(
      async () => {
        const cree = await apiClient.createBaseAerienne(token, {
          numero: numero.trim(),
          localite: localite.trim(),
          parent_base_id: parentBaseId,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          altitude: position?.altitude ?? null,
        });
        onCreated({
          id: cree.id,
          numero: cree.numero,
          localite: cree.localite,
          parent_base_id: cree.parent_base_id,
          equipe_id: cree.equipe_id,
        });
        setCreation(false);
        setNumero('');
        setLocalite('');
        setParentBaseId(null);
        reset();
      },
      {
        screen: 'referentiels-aeriens',
        precondition: !!token && numero.trim().length > 0 && localite.trim().length > 0 && !!parentBaseId,
        preconditionMessage: 'Renseignez le numéro, la localité et la base principale avant de créer la base.',
      }
    );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>BASES SECONDAIRES</Text>
      {basesSecondaires.length === 0 && <Text style={styles.vide}>Aucune base secondaire.</Text>}
      {basesSecondaires.map((base) => (
        <View key={base.id} style={styles.item}>
          <Text style={styles.itemText}>
            {base.numero} — {base.localite}
          </Text>
          <Text style={styles.itemSubtext}>
            Principale : {base.parent_base_id ? basesById.get(base.parent_base_id)?.numero ?? '—' : '—'}
          </Text>
        </View>
      ))}

      {basesPrincipales.length === 0 ? (
        <Text style={styles.vide}>Créez d’abord une base principale.</Text>
      ) : !creation ? (
        <TouchableOpacity style={styles.nouveauLink} onPress={ouvrir} accessibilityRole="button">
          <Text style={styles.nouveauLinkText}>+ Nouvelle base secondaire</Text>
        </TouchableOpacity>
      ) : null}

      {creation && (
        <View style={styles.formulaire}>
          <TextInput
            value={numero}
            onChangeText={setNumero}
            placeholder="Numéro (ex. IHO02)"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <TextInput
            value={localite}
            onChangeText={setLocalite}
            placeholder="Localité"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <Text style={styles.sousLabel}>Base principale</Text>
          <View style={styles.chipsRow}>
            {basesPrincipales.map((principale) => (
              <TouchableOpacity
                key={principale.id}
                style={[styles.chip, parentBaseId === principale.id && styles.chipSelectionne]}
                onPress={() => setParentBaseId(principale.id)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, parentBaseId === principale.id && styles.chipTextSelectionne]}>
                  {principale.numero}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsRowText}>Coordonnées (auto, facultatif)</Text>
            <Text style={styles.gpsValue}>
              {isGpsLoading
                ? 'Localisation…'
                : position
                  ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
                  : '—'}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => setCreation(false)} accessibilityRole="button">
              <Text style={styles.annulerText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.creerButton, isRunning && styles.creerButtonDisabled]}
              onPress={creer}
              disabled={isRunning}
              accessibilityRole="button"
            >
              <Text style={styles.creerButtonText}>{isRunning ? 'Création…' : 'Créer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function SectionStand({
  stands,
  token,
  onCreated,
}: {
  stands: Stand[];
  token: string;
  onCreated: (stand: Stand) => void;
}) {
  const [creation, setCreation] = useState(false);
  const [numero, setNumero] = useState('');
  const [localite, setLocalite] = useState('');
  const { position, isGpsLoading, capturer, reset } = useGps();
  const { run, isRunning } = useAsyncAction();

  const ouvrir = () => {
    setCreation(true);
    void capturer();
  };

  const creer = () =>
    run(
      async () => {
        const cree = await apiClient.createStandRemplissage(token, {
          numero: numero.trim(),
          localite: localite.trim(),
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          altitude: position?.altitude ?? null,
        });
        onCreated({ id: cree.id, numero: cree.numero, localite: cree.localite });
        setCreation(false);
        setNumero('');
        setLocalite('');
        reset();
      },
      {
        screen: 'referentiels-aeriens',
        precondition: !!token && numero.trim().length > 0 && localite.trim().length > 0,
        preconditionMessage: 'Renseignez le numéro et la localité avant de créer le stand.',
      }
    );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>STANDS DE REMPLISSAGE</Text>
      {stands.length === 0 && <Text style={styles.vide}>Aucun stand de remplissage.</Text>}
      {stands.map((stand) => (
        <View key={stand.id} style={styles.item}>
          <Text style={styles.itemText}>
            {stand.numero} — {stand.localite}
          </Text>
        </View>
      ))}

      {!creation && (
        <TouchableOpacity style={styles.nouveauLink} onPress={ouvrir} accessibilityRole="button">
          <Text style={styles.nouveauLinkText}>+ Nouveau stand de remplissage</Text>
        </TouchableOpacity>
      )}

      {creation && (
        <View style={styles.formulaire}>
          <TextInput
            value={numero}
            onChangeText={setNumero}
            placeholder="Numéro (ex. STD01)"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <TextInput
            value={localite}
            onChangeText={setLocalite}
            placeholder="Localité"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <View style={styles.gpsRow}>
            <Text style={styles.gpsRowText}>Coordonnées (auto, facultatif)</Text>
            <Text style={styles.gpsValue}>
              {isGpsLoading
                ? 'Localisation…'
                : position
                  ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
                  : '—'}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => setCreation(false)} accessibilityRole="button">
              <Text style={styles.annulerText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.creerButton, isRunning && styles.creerButtonDisabled]}
              onPress={creer}
              disabled={isRunning}
              accessibilityRole="button"
            >
              <Text style={styles.creerButtonText}>{isRunning ? 'Création…' : 'Créer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chargerLinkText: { fontSize: 14, fontWeight: '700', color: GREEN },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  section: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 13, gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, letterSpacing: 0.5 },
  vide: { fontSize: 12.5, color: TEXT_SECONDARY, fontStyle: 'italic' },
  item: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: BG, gap: 2 },
  itemText: { fontSize: 13, fontWeight: '700', color: TEXT },
  itemSubtext: { fontSize: 11.5, color: TEXT_SECONDARY },
  nouveauLink: { paddingVertical: 8, alignItems: 'center' },
  nouveauLinkText: { fontSize: 13, fontWeight: '700', color: GREEN },
  formulaire: { gap: 8, marginTop: 4 },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8 },
  sousLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  chipSelectionne: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextSelectionne: { color: GREEN },
  gpsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gpsRowText: { fontSize: 11.5, color: TEXT_SECONDARY },
  gpsValue: { fontSize: 12, fontWeight: '700', color: TEXT },
  actionsRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', alignItems: 'center' },
  annulerText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  creerButton: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  creerButtonDisabled: { opacity: 0.6 },
  creerButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
