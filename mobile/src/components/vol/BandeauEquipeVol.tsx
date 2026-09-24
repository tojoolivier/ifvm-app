import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ChoixField } from '@/components/equipe/ChoixField';
import { EQ } from '@/components/equipe/tokens';
import { Fonts } from '@/constants/theme';
import type { AeronefEquipe } from '@/lib/equipe-db';

interface Props {
  equipe: { nom: string } | null;
  aeronef: AeronefEquipe | null;
  /** Plus d'un aéronef affecté ce jour-là : l'agent choisit. */
  aeronefs: AeronefEquipe[];
  onChoisirAeronef: (id: string) => void;
}

/** Bandeau « Équipe · aéronef » repris de l'équipe de travail (Figma « InfoBar »), commun aux écrans de vol. */
export function BandeauEquipeVol({ equipe, aeronef, aeronefs, onChoisirAeronef }: Props) {
  return (
    <>
      {equipe && (
        <View style={styles.info}>
          <ThemedText style={styles.equipe}>{equipe.nom}</ThemedText>
          {aeronef && <ThemedText style={styles.immatriculation}>{aeronef.immatriculation}</ThemedText>}
        </View>
      )}
      {aeronefs.length > 1 && (
        <ChoixField
          etiquette="Aéronef"
          valeur={aeronef?.id ?? null}
          options={aeronefs.map((a) => ({ valeur: a.id, libelle: a.immatriculation }))}
          onChoisir={onChoisirAeronef}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.vertBordure,
    backgroundColor: EQ.vertLeger,
  },
  equipe: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: EQ.vert },
  immatriculation: { fontSize: 10, lineHeight: 14, fontWeight: '600', fontFamily: Fonts.mono, color: EQ.vert },
});
