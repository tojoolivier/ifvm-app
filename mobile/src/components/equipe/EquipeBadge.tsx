import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { EQ } from './tokens';

type Ton = 'vertPlein' | 'vertDoux' | 'ambre' | 'neutre';

const FOND: Record<Ton, object> = {
  vertPlein: { backgroundColor: EQ.vert },
  vertDoux: { backgroundColor: EQ.vertDoux },
  ambre: { backgroundColor: EQ.ambreFond },
  neutre: { backgroundColor: EQ.fond, borderWidth: 1, borderColor: EQ.bordure },
};
const TEXTE: Record<Ton, string> = {
  vertPlein: EQ.surMarque,
  vertDoux: EQ.vert,
  ambre: EQ.ambre,
  neutre: EQ.attenue,
};

/** Pastille M/Badge des maquettes. */
export function EquipeBadge({ texte, ton = 'vertDoux' }: { texte: string; ton?: Ton }) {
  return (
    <View style={[styles.badge, FOND[ton]]}>
      <ThemedText style={[styles.texte, { color: TEXTE[ton] }]}>{texte}</ThemedText>
    </View>
  );
}

/** Le badge de type d'une équipe : aérienne en vert, terrestre en ambre. */
export function BadgeTypeEquipe({ type, plein = false }: { type: 'terrestre' | 'aerien'; plein?: boolean }) {
  return type === 'aerien' ? (
    <EquipeBadge texte="AÉRIENNE" ton={plein ? 'vertPlein' : 'vertDoux'} />
  ) : (
    <EquipeBadge texte="TERRESTRE" ton="ambre" />
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  texte: { fontSize: 9, fontWeight: '700' },
});
