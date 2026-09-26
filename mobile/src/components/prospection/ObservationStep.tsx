import { useEffect, useState } from 'react';
import { useObservationForm } from '@/hooks/use-observation-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Card, Chip, PrimaryButton, WizardFooter } from '@/components/ui';
import { Radius, UiBorder, UiOpacity, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { phenotypesFor, type CategorieGrille, type TypeGrille } from '@/lib/prospection-capture-rules';
import {
  basculerGrille,
  basculerPhase,
  basculerStade,
  choisirAucunCriquet,
  ESPECES,
  filtreVide,
  grilleVue,
  nbGrilles,
  stadesAffiches,
  type FiltreObservation,
  type SexeVu,
} from '@/lib/prospection-observation';
import { ReferentialError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { enregistrerFiltreObservation } from '@/lib/prospection-db';
import { listStadesGrille } from '@/lib/referentiel-db';

const log = logger.child({ module: 'observation-step' });

const CATEGORIES: CategorieGrille[] = ['imago', 'larve'];

type Props = {
  type: TypeGrille;
  /** Brouillon auquel le filtre est rattaché (enregistré à l'appui sur le bouton du bas). */
  brouillonId: string;
  /** Filtre déjà enregistré avec le brouillon (reprise, retour depuis l'étape suivante) ; absent = fiche vierge. */
  filtreInitial?: FiltreObservation | null;
  onContinuer: () => void;
};

/** Étape « Qu'avez-vous observé ? » (#701) : grilles, phases et stades vus, communs aux 3 types de fiche. */
export function ObservationStep({ type, brouillonId, filtreInitial, onContinuer }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const { filtre, appliquer, erreurs } = useObservationForm(filtreInitial ?? filtreVide());
  const [erreurEnregistrement, setErreurEnregistrement] = useState(false);

  const continuer = async () => {
    setErreurEnregistrement(false);
    try {
      await enregistrerFiltreObservation(brouillonId, filtre);
      onContinuer();
    } catch (e) {
      log.failure('observation_enregistrement', e);
      setErreurEnregistrement(true);
    }
  };

  return (
    <View style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.titres}>
          <Text style={[UiText.title, { color: c.fg }]}>{t('prospection.observation.titre')}</Text>
          <Text style={[UiText.caption, { color: c.fg3 }]}>{t('prospection.observation.aide')}</Text>
        </View>
        {ESPECES.map((espece) => (
          <Card key={espece} style={{ borderColor: c.greenBorder, opacity: filtre.aucunCriquet ? UiOpacity.disabled : 1 }}>
            <View>
              <Text style={[UiText.subheading, { color: c.fg }]}>{espece}</Text>
              <Text style={[UiText.caption, { color: c.fg3 }]}>{t(`prospection.observation.especes.${espece}`)}</Text>
            </View>
            <View style={styles.rangee}>
              {CATEGORIES.map((categorie) => (
                <View key={categorie} style={styles.flex}>
                  <Chip
                    serre
                    label={t(categorie === 'imago' ? 'prospection.observation.imagos' : 'prospection.observation.larves')}
                    selected={!!grilleVue(filtre, espece, categorie)}
                    onPress={() => appliquer((f) => basculerGrille(f, espece, categorie))}
                    testID={`grille-${espece}-${categorie}`}
                  />
                </View>
              ))}
            </View>
            {CATEGORIES.map(
              (categorie) =>
                grilleVue(filtre, espece, categorie) && (
                  <FiltreGrille key={categorie} type={type} espece={espece} categorie={categorie} filtre={filtre} appliquer={appliquer} />
                )
            )}
          </Card>
        ))}
        <Pressable
          testID="aucun-criquet"
          onPress={() => appliquer(choisirAucunCriquet)}
          accessibilityRole="button"
          accessibilityState={{ selected: filtre.aucunCriquet }}
          style={[
            styles.aucun,
            filtre.aucunCriquet
              ? { backgroundColor: c.primary, borderColor: c.primary }
              : { borderColor: c.borderField, borderStyle: 'dashed' },
          ]}
        >
          <Text style={[UiText.bodyMedium, { color: filtre.aucunCriquet ? c.onPrimary : c.fg2 }]}>
            {filtre.aucunCriquet ? t('ui.choisi', { libelle: t('prospection.observation.aucunCriquet') }) : t('prospection.observation.aucunCriquet')}
          </Text>
        </Pressable>
        {filtre.aucunCriquet && type === 'validation' && (
          <View style={[styles.sautees, { backgroundColor: c.greenBg }]}>
            <Text style={[UiText.caption, { color: c.primary }]}>{t('prospection.observation.grillesSautees')}</Text>
          </View>
        )}
        {erreurEnregistrement && <Banner tone="error" message={t('prospection.observation.erreurEnregistrement')} />}
      </ScrollView>
      <WizardFooter>
        <PrimaryButton
          label={filtre.aucunCriquet ? t('prospection.observation.continuerSansCapture') : t('prospection.observation.boutonCaptures', { count: nbGrilles(filtre) })}
          manques={erreurs.manques}
          onPress={continuer}
          testID="observation-continuer"
        />
      </WizardFooter>
    </View>
  );
}

type FiltreGrilleProps = {
  type: TypeGrille;
  espece: string;
  categorie: CategorieGrille;
  filtre: FiltreObservation;
  appliquer: (transition: (filtre: FiltreObservation) => FiltreObservation) => void;
};

type Stade = { code: string; libelle: string };

/** Les imagos ont un jeu de stades par sexe, les larves un seul. */
const sexesDe = (categorie: CategorieGrille): SexeVu[] => (categorie === 'imago' ? ['F', 'M'] : ['sans_sexe']);

/** Phases vues, puis stades vus lus dans le référentiel : un jeu par sexe pour les imagos, un seul pour les larves. */
function FiltreGrille({ type, espece, categorie, filtre, appliquer }: FiltreGrilleProps) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const grille = grilleVue(filtre, espece, categorie)!;
  const choisi = (libelle: string, coche: boolean) => (coche ? t('ui.choisi', { libelle }) : libelle);
  const libelleCategorie = t(categorie === 'imago' ? 'prospection.observation.imagos' : 'prospection.observation.larves');
  const [stades, setStades] = useState<Partial<Record<SexeVu, Stade[]>>>({});
  const [erreur, setErreur] = useState<'referentiel' | 'lecture' | null>(null);

  useEffect(() => {
    let actif = true;
    Promise.all(
      sexesDe(categorie).map(async (sexe) => {
        const liste = await listStadesGrille(espece, categorie, sexe === 'sans_sexe' ? null : sexe);
        return [sexe, stadesAffiches(type, liste)] as const;
      })
    )
      .then((paires) => actif && setStades(Object.fromEntries(paires)))
      .catch((e) => {
        log.failure('observation_stades', e);
        // Référentiel sans stade pour cette grille (pas synchronisé) ≠ base illisible : deux messages, deux remèdes.
        if (actif) setErreur(e instanceof ReferentialError ? 'referentiel' : 'lecture');
      });
    return () => {
      actif = false;
    };
  }, [type, espece, categorie]);

  return (
    <View style={[styles.filtre, { backgroundColor: c.greenBg }]}>
      <Text style={[UiText.captionMedium, { color: c.primary }]}>
        {t('prospection.observation.phasesVues', { categorie: libelleCategorie })}
      </Text>
      <View style={styles.puces}>
        {phenotypesFor(espece, categorie).map((phase) => (
          <Chip
            key={phase}
            compact
            label={choisi(t(`prospection.observation.phases.${phase}`), grille.phases.includes(phase))}
            selected={grille.phases.includes(phase)}
            onPress={() => appliquer((f) => basculerPhase(f, espece, categorie, phase))}
            testID={`phase-${espece}-${categorie}-${phase}`}
          />
        ))}
      </View>
      <Text style={[UiText.captionMedium, { color: c.primary }]}>
        {t('prospection.observation.stadesVus', { categorie: libelleCategorie })}
      </Text>
      {erreur && (
        <Banner
          tone="warning"
          message={t(erreur === 'referentiel' ? 'prospection.observation.stadesIndisponibles' : 'prospection.observation.stadesIllisibles')}
        />
      )}
      {sexesDe(categorie).map((sexe) => (
        <View key={sexe} style={styles.sexe}>
          {sexe !== 'sans_sexe' && <Text style={[UiText.caption, { color: c.fg3 }]}>{t(`prospection.observation.sexe.${sexe}`)}</Text>}
          <View style={styles.puces}>
            {(stades[sexe] ?? []).map((stade) => {
              const coche = grille.stades[sexe].includes(stade.code);
              return (
                <Chip
                  key={stade.code}
                  compact
                  label={choisi(stade.libelle, coche)}
                  selected={coche}
                  onPress={() => appliquer((f) => basculerStade(f, espece, categorie, sexe, stade.code))}
                  testID={`stade-${espece}-${categorie}-${sexe}-${stade.code}`}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { padding: UiSpace[16], gap: UiSpace[16] },
  titres: { gap: UiSpace[2] },
  rangee: { flexDirection: 'row', gap: UiSpace[8] },
  flex: { flex: 1 },
  aucun: { paddingVertical: UiSpace[12], borderRadius: Radius.md, borderWidth: UiBorder.field, alignItems: 'center' },
  sautees: { paddingHorizontal: UiSpace[14], paddingVertical: UiSpace[12], borderRadius: Radius.md },
  filtre: { padding: UiSpace[12], borderRadius: Radius.sm, gap: UiSpace[10] },
  sexe: { gap: UiSpace[6] },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: UiSpace[6] },
});
