import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useForm, useStore } from '@tanstack/react-form';
import type { Schema } from 'yup';
import { Banner, BottomSheet, Card, Chip, NumberField, PrimaryButton } from '@/components/ui';
import { MonoFonts, Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useErreursFormulaire } from '@/hooks/use-erreurs-formulaire';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { useAuthStore } from '@/lib/auth-store';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { generateId } from '@/lib/id';
import { getCurrentPosition, type GpsPosition } from '@/lib/location';
import { enregistrerBrouillon, type ProspectionCreate } from '@/lib/prospection-db';
import { resoudreZoneHorsLigne, type ZoneAdministrative } from '@/lib/geo-administratif';
import { generateNumeroFiche, generateNumeroMessage } from '@/lib/prospection-numeros';
import { champsDeReference, dateLocale, formaterDateHeure, repartitionSurfaces, stationLibreDepuisZone, valeursDeReference, type SaisieReference } from '@/lib/prospection-reference';
import { logger } from '@/lib/logger';
import { coordonneesValides, formaterDistance, plusProche } from '@/lib/prospection-rattachement';
import { BIOTOPES, creerReferenceSchema, parserHa, type ReferenceValeurs } from '@/lib/prospection-reference-schema';
import {
  listCampagnesLocal,
  listPostesAcridiens,
  listStationsActives,
  getStationById,
  listStationsByPoste,
  type PosteAcridien,
  type StationFixe,
} from '@/lib/referentiel-db';

const log = logger.child({ module: 'reference-step' });

type Props = {
  type: 'intensive' | 'extensive' | 'validation';
  onContinuer: (id: string) => void;
  /** Publié dès l'affichage : l'en-tête du wizard reprend le N° de fiche avant la première sauvegarde. */
  onNumeroFiche?: (numero: string) => void;
  /** Reprise : la fiche déjà enregistrée, dont l'écran rouvre les valeurs et garde les champs qu'il ne gère pas. */
  brouillon?: ProspectionCreate & { id: string };
};

type Rattachement = { station: StationFixe; pa: PosteAcridien | null; distanceM: number; paManuel?: boolean; stationManuel?: boolean };

type Feuille = { titre: string; items: { id: string; libelle: string; choisir: () => void }[] };

const VALEURS_INITIALES: ReferenceValeurs = {
  surface_station: '',
  surface_prospectee: '',
  surface_infestee: '0',
  station_libre: '',
  biotope: [],
};

/** Étape 1 du wizard : Référence (#684). */
export function ReferenceStep({ type, onContinuer, onNumeroFiche, brouillon }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const [horodatage] = useState(() => new Date());
  const dateFiche = brouillon?.date_prospection ?? dateLocale(horodatage);
  const [auto, setAuto] = useState<Rattachement | null>(null);
  const [position, setPosition] = useState<GpsPosition | null>(() =>
    brouillon?.latitude != null && brouillon.longitude != null
      ? { latitude: brouillon.latitude, longitude: brouillon.longitude, altitude: brouillon.altitude ?? null, accuracy: null, timestamp: 0 }
      : null
  );
  const [brouillonId] = useState(() => brouillon?.id ?? generateId());
  const [numeroFiche] = useState(
    () => brouillon?.n_fiche ?? generateNumeroFiche(brouillonId, dateFiche, type)
  );
  useEffect(() => onNumeroFiche?.(numeroFiche), [numeroFiche, onNumeroFiche]);
  const [saisieManuelle, setSaisieManuelle] = useState<{ latitude: string; longitude: string } | null>(null);
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const [recherche, setRecherche] = useState('');
  const [zone, setZone] = useState<ZoneAdministrative | null>(() =>
    brouillon?.region || brouillon?.district || brouillon?.commune
      ? { region: brouillon.region ?? '', district: brouillon.district ?? '', commune: brouillon.commune ?? '' }
      : null
  );
  const [numeroMessage, setNumeroMessage] = useState<string | null>(brouillon?.n_message ?? null);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);
  const numero = numeroMessage ?? generateNumeroMessage(brouillonId, dateFiche);
  const equipeId = useEquipeTravailStore((s) => s.equipeId);
  const user = useAuthStore((s) => s.user);
  const mode = type === 'intensive' ? 'intensive' : 'extensive';

  const schema: Schema = useMemo(() => creerReferenceSchema(mode, (cle) => t(cle as never)), [mode, t]);
  const form = useForm({ defaultValues: brouillon ? valeursDeReference(brouillon) : VALEURS_INITIALES, validators: { onChangeAsync: schema as never } });
  const libelles = useMemo(
    () => ({
      surface_station: t('prospection.reference.surfaceStation'),
      surface_prospectee: t('prospection.reference.surfaceProspectee'),
      biotope: t('prospection.reference.biotopeLibelle'),
    }),
    [t]
  );
  const erreurs = useErreursFormulaire(form as never, schema, libelles);

  const saisi = useStore(form.store, (st) => st.values);
  const ha = { station: parserHa(saisi.surface_station), prospectee: parserHa(saisi.surface_prospectee), infestee: parserHa(saisi.surface_infestee) };
  const intensif = mode === 'intensive';
  const parts = repartitionSurfaces({ total: intensif ? ha.station : ha.prospectee, prospectee: ha.prospectee, infestee: ha.infestee });
  const texteHa = (n: number | null) => String(n ?? 0).replace('.', ',');

  useEffect(() => {
    let annule = false;
    (async () => {
      if (brouillon) {
        // Reprise : on ne relance pas le GPS, on rouvre le rattachement déjà enregistré.
        if (!brouillon.station_id || !position) return;
        const [station, postes] = await Promise.all([getStationById(brouillon.station_id), listPostesAcridiens()]);
        if (annule || !station) return;
        setAuto({
          station,
          pa: postes.find((p) => p.code === brouillon.pa_code) ?? postes.find((p) => p.id === station.paId) ?? null,
          distanceM: plusProche(position, [station])?.distanceM ?? 0,
        });
        return;
      }
      const fix = await getCurrentPosition();
      if (annule) return;
      setPosition(fix);
      if (type !== 'intensive') {
        // Pas de station du référentiel : station libre pré-remplie hors ligne, sans jamais écraser une saisie.
        const z = resoudreZoneHorsLigne(fix.latitude, fix.longitude);
        setZone(z);
        if (!form.getFieldValue('station_libre')) form.setFieldValue('station_libre', stationLibreDepuisZone(z));
        return;
      }
      const [stations, postes] = await Promise.all([listStationsActives(), listPostesAcridiens()]);
      const proche = plusProche(fix, stations);
      if (annule || !proche) return;
      setAuto({
        station: proche.item,
        pa: postes.find((p) => p.id === proche.item.paId) ?? null,
        distanceM: proche.distanceM,
      });
    })().catch((e) => log.failure('reference_rattachement_auto', e));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule acquisition par écran
  }, [type]);

  /** Champ de surface : le message d'imbrication s'affiche dès qu'une valeur est saisie, sans attendre la soumission. */
  const champHa = (nom: 'surface_station' | 'surface_prospectee' | 'surface_infestee', label: string) => (
    <View style={styles.champ}>
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

  const nombre = (texte: string) => (texte.trim() === '' ? Number.NaN : Number(texte.trim().replace(',', '.')));
  const manuelle = saisieManuelle && { latitude: nombre(saisieManuelle.latitude), longitude: nombre(saisieManuelle.longitude) };
  const coordonneesInvalides = !!manuelle && !coordonneesValides(manuelle.latitude, manuelle.longitude);
  const positionRetenue =
    manuelle && !coordonneesInvalides
      ? { latitude: manuelle.latitude, longitude: manuelle.longitude, altitude: position?.altitude ?? null, accuracy: null }
      : position;
  const formaterCoord = (n: number) => n.toFixed(6).replace('.', ',');

  const continuer = async () => {
    setErreurEnregistrement(null);
    try {
      const campagne = (await listCampagnesLocal())[0];
      if (!campagne) return setErreurEnregistrement(t('prospection.reference.campagneIntrouvable'));
      if (!equipeId) return setErreurEnregistrement(t('prospection.reference.equipeIntrouvable'));
      const valeurs = form.state.values;
      const id = await enregistrerBrouillon(
        {
          ...brouillon,
          id: brouillonId,
          type_prospection: type,
          campagne_id: campagne.id,
          equipe_id: equipeId,
          date_prospection: dateFiche,
          n_fiche: numeroFiche,
          n_message: type === 'extensive' ? numero : null,
          station_id: auto?.station.id ?? null,
          region: zone?.region ?? null,
          district: zone?.district ?? null,
          commune: zone?.commune ?? null,
          pa_code: auto?.pa?.code ?? null,
          latitude: positionRetenue?.latitude ?? null,
          longitude: positionRetenue?.longitude ?? null,
          altitude: positionRetenue?.altitude ?? null,
          avertissements: brouillon?.avertissements ?? [],
          populations: brouillon?.populations ?? [],
          captures: brouillon?.captures ?? [],
          infestations: brouillon?.infestations ?? [],
          operations_aeriennes: brouillon?.operations_aeriennes ?? [],
          ...champsDeReference({ ...valeurs, type, biotope: valeurs.biotope as SaisieReference['biotope'] }),
        },
        brouillon ? {} : { creation: true }
      );
      onContinuer(id);
    } catch (e) {
      log.failure('reference_enregistrement', e);
      setErreurEnregistrement(t('prospection.reference.erreurEnregistrement'));
    }
  };

  const note = (manuel?: boolean) =>
    !auto
      ? ''
      : manuel
        ? t('prospection.reference.choixManuel')
        : t('prospection.reference.autoPlusProche', { distance: formaterDistance(auto.distanceM) });

  const ouvrir = (titre: string, items: Feuille['items']) => {
    setRecherche('');
    setFeuille({ titre, items });
  };
  const choisir = (choix: () => void) => () => {
    choix();
    setFeuille(null);
  };

  const changerStation = async () => {
    if (!auto?.pa) return;
    const { pa } = auto;
    try {
      const stations = await listStationsByPoste(pa.id);
      ouvrir(
        t('prospection.reference.choisirStation'),
        stations.map((st) => ({
          id: st.id,
          libelle: `${st.code} · ${st.nom}`,
          choisir: choisir(() => setAuto({ ...auto, station: st, stationManuel: true })),
        }))
      );
    } catch (e) {
      log.failure('reference_liste_stations', e);
    }
  };

  const changerPa = async () => {
    if (!auto) return;
    try {
      const postes = await listPostesAcridiens();
      ouvrir(
        t('prospection.reference.choisirPa'),
        postes.map((pa) => ({
          id: pa.id,
          libelle: pa.nom,
          choisir: choisir(() => {
            // Le PA change : la station suit — la plus proche de la position dans ce PA, sinon la première.
            listStationsByPoste(pa.id)
              .then((stations) => {
                const st = (position && plusProche(position, stations)?.item) || stations[0];
                if (st) setAuto({ ...auto, station: st, pa, paManuel: true, stationManuel: true });
              })
              .catch((e) => log.failure('reference_liste_stations', e));
          }),
        }))
      );
    } catch (e) {
      log.failure('reference_liste_pa', e);
    }
  };

  return (
    <View style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu}>
        {auto && (
          <Card>
            <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.rattachement')}</Text>
            <Ligne libelle={t('prospection.reference.pa')} valeur={auto.pa?.nom ?? ''} note={note(auto.paManuel)} onChanger={changerPa} testID="changer-pa" />
            <Ligne
              libelle={t('prospection.reference.station')}
              valeur={`${auto.station.code} · ${auto.station.nom}`}
              note={note(auto.stationManuel)}
              onChanger={changerStation}
              testID="changer-station"
            />
          </Card>
        )}
        <Card>
          <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.fiche')}</Text>
          <View style={styles.ligneChanger}>
            <View style={styles.ligne}>
              <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.numeroFiche')}</Text>
              <Text testID="numero-fiche" style={[UiText.bodyMedium, { color: c.fg, fontFamily: MonoFonts.medium }]}>
                {numeroFiche}
              </Text>
              <Text style={[UiText.micro, { color: c.primary }]}>{t('prospection.reference.genereAuto')}</Text>
            </View>
            <Pressable
              onPress={() => Clipboard.setStringAsync(numeroFiche).catch((e) => log.failure('reference_copie', e))}
              accessibilityRole="button"
              style={[styles.copier, { backgroundColor: c.greenBg }]}
            >
              <Text style={[UiText.micro, { color: c.primary }]}>{t('prospection.reference.copier')}</Text>
            </Pressable>
          </View>
          {user && (
            <View style={styles.ligne}>
              <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.prospecteur')}</Text>
              <Text style={[UiText.bodyMedium, { color: c.fg }]}>
                {t('prospection.reference.prospecteurConnecte', { nom: `${user.prenom.charAt(0)}. ${user.nom}` })}
              </Text>
            </View>
          )}
        </Card>
        {type === 'extensive' && (
          <Card>
            <NumberField
              label={t('prospection.reference.numeroMessage')}
              value={numero}
              onChangeText={setNumeroMessage}
              clavier="default"
              testID="numero-message"
            />
            <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.numeroMessageAide')}</Text>
          </Card>
        )}
        {positionRetenue && (
          <View style={[styles.gps, { backgroundColor: c.primary }]}>
            <View style={styles.titreGps}>
              <Text style={[UiText.subheading, styles.flex, { color: c.onPrimary }]}>{t('prospection.reference.positionAcquise')}</Text>
              {positionRetenue.accuracy != null && (
                <Text style={[UiText.micro, styles.pastille, { color: c.onPrimary, backgroundColor: c.onPrimaryPill }]}>
                  {t('prospection.reference.precision', { metres: Math.round(positionRetenue.accuracy) })}
                </Text>
              )}
            </View>
            <View style={styles.rangee}>
              {(
                [
                  ['latitude', formaterCoord(positionRetenue.latitude)],
                  ['longitude', formaterCoord(positionRetenue.longitude)],
                  ['altitude', t('prospection.reference.altitudeMetres', { metres: Math.round(positionRetenue.altitude ?? 0) })],
                ] as const
              ).map(([cle, valeur]) => (
                <View key={cle} style={[styles.tuile, { backgroundColor: c.onPrimaryTile }]}>
                  <Text style={[UiText.micro, { color: c.greenBorder }]}>{t(`prospection.reference.${cle}`)}</Text>
                  <Text style={[UiText.caption, { color: c.onPrimary }]}>{valeur}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {mode === 'extensive' && (
          <View style={styles.coordonnees}>
            {saisieManuelle ? (
              <>
                <View style={styles.rangee}>
                  <View style={styles.flex}>
                    <NumberField
                      label={t('prospection.reference.latitude')}
                      value={saisieManuelle.latitude}
                      onChangeText={(latitude) => setSaisieManuelle({ ...saisieManuelle, latitude })}
                      clavier="numbers-and-punctuation"
                      testID="latitude"
                    />
                  </View>
                  <View style={styles.flex}>
                    <NumberField
                      label={t('prospection.reference.longitude')}
                      value={saisieManuelle.longitude}
                      onChangeText={(longitude) => setSaisieManuelle({ ...saisieManuelle, longitude })}
                      clavier="numbers-and-punctuation"
                      testID="longitude"
                    />
                  </View>
                </View>
                {coordonneesInvalides && <Banner tone="error" message={t('prospection.reference.coordonneesHorsMadagascar')} />}
              </>
            ) : (
              <Pressable
                testID="saisir-coordonnees"
                accessibilityRole="button"
                onPress={() => setSaisieManuelle({ latitude: '', longitude: '' })}
              >
                <Text style={[UiText.captionMedium, styles.lien, { color: c.primary }]}>{t('prospection.reference.saisirCoordonnees')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {mode === 'extensive' && (
          <Card>
            <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.localisation')}</Text>
            <form.Field name="station_libre">
              {(field) => (
                <NumberField
                  label={t('prospection.reference.stationLibre')}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  clavier="default"
                  error={erreurs.erreurChamp('station_libre')}
                  testID="station-libre"
                />
              )}
            </form.Field>
          </Card>
        )}
        <Card>
          <View style={styles.ligne}>
            <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.dateReleve')}</Text>
            <Text testID="date-releve" style={[UiText.bodyMedium, { color: c.fg }]}>{formaterDateHeure(horodatage)}</Text>
            <Text style={[UiText.micro, { color: c.primary }]}>{t('prospection.reference.horodatageAuto')}</Text>
          </View>
        </Card>
        <Card>
          <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.surfaces')}</Text>
          <View style={styles.rangee}>
            {mode === 'intensive' && champHa('surface_station', t('prospection.reference.surfaceStation'))}
            {champHa('surface_prospectee', t('prospection.reference.surfaceProspectee'))}
            {champHa('surface_infestee', t('prospection.reference.surfaceInfestee'))}
          </View>
          <View style={[styles.barre, { backgroundColor: intensif ? c.surfaceMuted : c.strateHerbeuse }]}>
            {intensif && <View style={{ width: `${parts.prospecteePct}%`, backgroundColor: c.strateHerbeuse, height: '100%' }} />}
            <View style={[styles.infestee, { width: `${parts.infesteePct}%`, backgroundColor: c.danger }]} />
          </View>
          <View style={styles.rangee}>
            {intensif && <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.legendeStation', { ha: texteHa(ha.station) })}</Text>}
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
        <Card>
          <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.biotope')}</Text>
          <form.Field name="biotope">
            {(field) => (
              <View style={styles.rangee}>
                {BIOTOPES.map((b) => (
                  <View key={b} style={styles.champ}>
                    <Chip
                      label={t(`prospection.reference.biotopes.${b}`)}
                      selected={field.state.value.includes(b)}
                      onPress={() =>
                        field.handleChange(
                          field.state.value.includes(b)
                            ? field.state.value.filter((x) => x !== b)
                            : [...field.state.value, b]
                        )
                      }
                    />
                  </View>
                ))}
              </View>
            )}
          </form.Field>
        </Card>
        {erreurEnregistrement && <Banner tone="error" message={erreurEnregistrement} />}
      </ScrollView>
      <BottomSheet visible={!!feuille} titre={feuille?.titre ?? ''} onClose={() => setFeuille(null)}>
        <NumberField
          label={t('prospection.reference.rechercher')}
          value={recherche}
          onChangeText={setRecherche}
          clavier="default"
          testID="recherche-liste"
        />
        {feuille?.items
          .filter((i) => i.libelle.toLowerCase().includes(recherche.trim().toLowerCase()))
          .map((i) => (
            <Pressable key={i.id} onPress={i.choisir} testID={`choix-${i.id}`} accessibilityRole="button">
              <Text style={[UiText.bodyMedium, styles.choix, { color: c.fg }]}>{i.libelle}</Text>
            </Pressable>
          ))}
      </BottomSheet>
      <PrimaryButton
        label={t('prospection.reference.continuer')}
        onPress={continuer}
        manques={erreurs.manques}
        disabled={Object.keys(erreurs.parChamp).length > 0 || coordonneesInvalides}
        testID="reference-continuer"
      />
    </View>
  );
}

function Ligne({
  libelle,
  valeur,
  note,
  onChanger,
  testID,
}: {
  libelle: string;
  valeur: string;
  note: string;
  onChanger: () => void;
  testID: string;
}) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.ligneChanger}>
      <View style={styles.ligne}>
        <Text style={[UiText.micro, { color: c.fg3 }]}>{libelle}</Text>
        <Text style={[UiText.bodyMedium, { color: c.fg }]}>{valeur}</Text>
        <Text style={[UiText.micro, { color: c.primary }]}>{note}</Text>
      </View>
      <Pressable onPress={onChanger} testID={testID} accessibilityRole="button" accessibilityLabel={`${t('prospection.reference.changer')} ${libelle}`}>
        <Text style={[UiText.captionMedium, { color: c.primary }]}>{t('prospection.reference.changer')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { padding: UiSpace[16], gap: UiSpace[16] },
  rangee: { flexDirection: 'row', gap: UiSpace[8] },
  champ: { flex: 1 },
  ligne: { flex: 1, gap: UiSpace[4] },
  ligneChanger: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[12] },
  choix: { paddingVertical: UiSpace[12] },
  flex: { flex: 1 },
  barre: { height: UiSize.surfaceBar, borderRadius: Radius.full, overflow: 'hidden' },
  infestee: { position: 'absolute', left: 0, top: 0, height: '100%' },
  gps: { padding: UiSpace[16], borderRadius: Radius.lg, gap: UiSpace[12] },
  titreGps: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[8] },
  pastille: { paddingHorizontal: UiSpace[10], paddingVertical: UiSpace[4], borderRadius: Radius.full, overflow: 'hidden' },
  tuile: { flex: 1, gap: UiSpace[2], paddingHorizontal: UiSpace[10], paddingVertical: UiSpace[8], borderRadius: Radius.sm },
  coordonnees: { gap: UiSpace[12] },
  lien: { textDecorationLine: 'underline' },
  copier: { paddingHorizontal: UiSpace[10], paddingVertical: UiSpace[4], borderRadius: Radius.full },
});
