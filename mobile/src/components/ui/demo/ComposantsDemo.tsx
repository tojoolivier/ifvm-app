import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import {
  AppHeader,
  Banner,
  BottomSheet,
  Card,
  Chip,
  NumberField,
  PrimaryButton,
  StatTile,
  Stepper,
  TimelineItem,
  WizardHeader,
} from '@/components/ui';

/** Écran de démonstration du socle UI (#721) — développement uniquement. */
export function ComposantsDemo() {
  const c = useUiTheme();
  const router = useRouter();
  const [chip, setChip] = useState(true);
  const [pct, setPct] = useState(15);
  const [largeur, setLargeur] = useState('');
  const [feuille, setFeuille] = useState(false);

  const erreur = largeur.trim() === '' ? 'Valeur requise' : null;

  return (
    <ScrollView style={{ backgroundColor: c.surfaceMuted }} contentContainerStyle={styles.contenu}>
      <AppHeader titre="Composants" sousTitre="Socle UI (#721)" onBack={() => router.back()} />
      <WizardHeader
        titre="Nouvelle prospection"
        sousTitre="Intensive · FI-20260925-F65AEA"
        badge="Intensive"
        etape={2}
        total={5}
        libelleEtape="Végétation"
      />
      <Section titre="Chip / Stepper / NumberField">
        <View style={styles.ligne}>
          <Chip label="Dense" selected={chip} onPress={() => setChip((v) => !v)} />
          <Chip label="Clairsemé" selected={!chip} onPress={() => setChip((v) => !v)} />
        </View>
        <Stepper label="Recouvrement" value={pct} onChange={setPct} />
        <NumberField label="Largeur" unit="m" value={largeur} onChangeText={setLargeur} error={erreur} />
      </Section>
      <Section titre="Boutons">
        <PrimaryButton label="Continuer" onPress={() => {}} />
        <PrimaryButton label="Continuer" onPress={() => {}} manques={['Largeur']} />
        <PrimaryButton label="Retour" variant="secondary" onPress={() => {}} />
        <PrimaryButton label="Ouvrir la feuille" variant="secondary" onPress={() => setFeuille(true)} />
      </Section>
      <Section titre="Chronologie / chiffres clés">
        <TimelineItem type="Vol" titre="Décollage" detail="Ivato" heure="08:15" />
        <TimelineItem type="Poser" titre="Poser 1" detail="Fiche extensive" heure="08:40" />
        <TimelineItem type="Base" titre="Retour base" heure="10:05" trait={false} />
        <StatTile libelle="Temps de vol" valeur="1 h 38" />
      </Section>
      <Section titre="Bandeaux">
        <Banner tone="info" message="Les données sont enregistrées hors ligne." />
        <Banner tone="warning" message="Position GPS imprécise." />
        <Banner tone="error" message="À corriger avant de continuer" items={['Largeur']} />
      </Section>
      <BottomSheet visible={feuille} titre="Feuille modale" onClose={() => setFeuille(false)}>
        <Text style={UiText.caption}>Contenu de la feuille.</Text>
      </BottomSheet>
    </ScrollView>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  const c = useUiTheme();
  return (
    <Card style={styles.section}>
      <Text style={[UiText.eyebrow, { color: c.primary, textTransform: 'uppercase' }]}>{titre}</Text>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  contenu: { gap: 12, paddingBottom: 48 },
  section: { marginHorizontal: 16 },
  ligne: { flexDirection: 'row', gap: 8 },
});
