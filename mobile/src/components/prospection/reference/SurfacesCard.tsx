import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '@tanstack/react-form';
import { Card, NumberField } from '@/components/ui';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { ErreursReference, ReferenceForm } from '@/hooks/use-reference-form';
import { repartitionSurfaces } from '@/lib/prospection-reference';
import { parserHa } from '@/lib/prospection-reference-schema';

type NomSurface = 'surface_station' | 'surface_prospectee' | 'surface_infestee';

const texteHa = (n: number | null) => String(n ?? 0).replace('.', ',');

/** Surfaces (ha) : champs, barre d'imbrication et légende. Intensive : 3 champs ; extensive : 2. */
export function SurfacesCard({ form, erreurs, intensif }: { form: ReferenceForm; erreurs: ErreursReference; intensif: boolean }) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const saisi = useStore(form.store, (st) => st.values);
  const ha = {
    station: parserHa(saisi.surface_station),
    prospectee: parserHa(saisi.surface_prospectee),
    infestee: parserHa(saisi.surface_infestee),
  };
  const parts = repartitionSurfaces({ total: intensif ? ha.station : ha.prospectee, prospectee: ha.prospectee, infestee: ha.infestee });

  /** Le message d'imbrication s'affiche dès qu'une valeur est saisie, sans attendre la soumission. */
  const champ = (nom: NomSurface, label: string) => (
    <View style={styles.flex}>
      <form.Field name={nom}>
        {(field) => (
          <NumberField
            label={label}
            unit={t('prospection.reference.unite')}
            value={field.state.value}
            onChangeText={field.handleChange}
            onBlur={field.handleBlur}
            error={erreurs.erreurChamp(nom) ?? (field.state.value !== '' ? erreurs.parChamp[nom] : undefined)}
            testID={nom.replace('_', '-')}
          />
        )}
      </form.Field>
    </View>
  );

  return (
    <Card>
      <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.surfaces')}</Text>
      <View style={styles.rangee}>
        {intensif && champ('surface_station', t('prospection.reference.surfaceStation'))}
        {champ('surface_prospectee', t('prospection.reference.surfaceProspectee'))}
        {champ('surface_infestee', t('prospection.reference.surfaceInfestee'))}
      </View>
      <View style={[styles.barre, { backgroundColor: intensif ? c.surfaceMuted : c.strateHerbeuse }]}>
        {intensif && <View style={[styles.prospectee, { width: `${parts.prospecteePct}%`, backgroundColor: c.strateHerbeuse }]} />}
        <View style={[styles.infestee, { width: `${parts.infesteePct}%`, backgroundColor: c.danger }]} />
      </View>
      <View style={styles.rangee}>
        {intensif && (
          <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.legendeStation', { ha: texteHa(ha.station) })}</Text>
        )}
        <Text style={[UiText.micro, { color: c.fg3 }]}>
          {intensif
            ? t('prospection.reference.legendeProspecteePct', { ha: texteHa(ha.prospectee), pct: parts.prospecteePct })
            : t('prospection.reference.legendeProspectee', { ha: texteHa(ha.prospectee) })}
        </Text>
        <Text style={[UiText.micro, { color: c.fg3 }]}>
          {intensif
            ? t('prospection.reference.legendeInfestee', { ha: texteHa(ha.infestee) })
            : t('prospection.reference.legendeInfesteePct', { ha: texteHa(ha.infestee), pct: parts.infesteePct })}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: UiSpace[8] },
  flex: { flex: 1 },
  barre: { height: UiSize.surfaceBar, borderRadius: Radius.full, overflow: 'hidden' },
  prospectee: { height: '100%' },
  infestee: { position: 'absolute', left: 0, top: 0, height: '100%' },
});
