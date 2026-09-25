import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/TimeField';
import { ChoixField } from '@/components/equipe/ChoixField';
import { EQ } from '@/components/equipe/tokens';
import { BandeauEquipeVol } from '@/components/vol/BandeauEquipeVol';
import { useAeronefDuJour } from '@/hooks/use-aeronef-du-jour';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { aujourdhuiIso } from '@/lib/equipe-db';
import { libelleSite } from '@/lib/equipe-regles';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { getEquipeLocale } from '@/lib/referentiel-db';
import { type SiteAerienLocal, listSitesAeriensEquipe } from '@/lib/site-aerien-db';
import { enregistrerVolOperation, getVolDeOperation } from '@/lib/vol-db';
import { dureeMinutes, formaterDuree } from '@/lib/vol-regles';

interface Props {
  /** `application` : vol du traitement aérien ; `prospection` : vol d'une prospection extensive aérienne. */
  categorie: 'application' | 'prospection';
  /** Fiche qui porte le vol (traitement ou prospection). */
  ficheId: string;
  /** Jour proposé par défaut (`YYYY-MM-DD`). */
  dateParDefaut?: string;
  readOnly?: boolean;
}

/**
 * Bloc « vol » d'une fiche (#644, Figma 81:447) : date, heures, stand de remplissage (choisi parmi les
 * dépendants du site principal), base secondaire facultative. Équipe, aéronef et site principal sont
 * repris de l'équipe de travail.
 * Il s'enregistre sur l'appareil par son propre bouton ; l'envoi suit la fiche (`vol-sync.ts`).
 */
export function BlocVol({ categorie, ficheId, dateParDefaut, readOnly = false }: Props) {
  const signalerChargement = useSignalerChargement('bloc-vol');
  const equipeId = useEquipeTravailStore((s) => s.equipeId);
  const { run, isRunning } = useAsyncAction();
  const type = categorie === 'application' ? 'traitement' : 'prospection';

  const [equipe, setEquipe] = useState<{ nom: string; type: 'terrestre' | 'aerien' } | null>(null);
  const [principal, setPrincipal] = useState<SiteAerienLocal | null>(null);
  const [dependants, setDependants] = useState<SiteAerienLocal[]>([]);
  const [volId, setVolId] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  const [date, setDate] = useState(dateParDefaut ?? aujourdhuiIso());
  const { aeronef, aeronefs, choisir: choisirAeronef } = useAeronefDuJour(equipeId, date, 'bloc-vol.aeronef');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [standId, setStandId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);

  useEffect(() => {
    if (!equipeId) return;
    (async () => {
      const [e, sites, existant] = await Promise.all([
        getEquipeLocale(equipeId),
        listSitesAeriensEquipe(equipeId),
        getVolDeOperation(type, ficheId),
      ]);
      setEquipe(e ? { nom: e.nom, type: e.type } : null);
      const site = sites.find((s) => s.parent_site_id === null) ?? null;
      setPrincipal(site);
      setDependants(sites.filter((s) => site && s.parent_site_id === site.id));
      if (existant) {
        setVolId(existant.id);
        setEnvoye(existant.statut_sync === 'synced');
        setDate(existant.date_vol);
        setDebut(existant.heure_debut);
        setFin(existant.heure_fin);
        setStandId(existant.stand_id);
        setBaseId(existant.base_secondaire_id);
      }
    })().catch((error) => signalerChargement(error, { source: 'bloc-vol' }));
  }, [equipeId, ficheId, type, signalerChargement]);

  const enregistrer = () => {
    const saisie = {
      categorie,
      equipeType: equipe?.type ?? null,
      aeronefId: aeronef?.id ?? null,
      date,
      debut,
      fin,
      sitePrincipalId: principal?.id ?? null,
      standId,
      baseSecondaireId: baseId,
      motif: '',
      lieuDepart: '',
      lieuArrivee: '',
    };
    void run(
      async () => {
        try {
          const id = await enregistrerVolOperation({
            ...saisie,
            equipeId: equipeId as string,
            dependantIds: dependants.map((d) => d.id),
            liens: [{ type, refId: ficheId }],
            libelleLieu: principal?.localite ?? '',
          });
          setVolId(id);
          setErreurs([]);
        } catch (error) {
          setErreurs(error instanceof Error ? error.message.split('\n') : ['Vol non enregistré.']);
        }
      },
      { screen: 'bloc-vol', precondition: !!equipeId }
    );
  };

  if (!equipeId) return null;
  const options = dependants.map((d) => ({ valeur: d.id, libelle: libelleSite(d) }));
  const inactif = readOnly || envoye;

  return (
    <View style={styles.bloc} testID="bloc-vol">
      <ThemedText style={styles.titre}>
        {categorie === 'application' ? 'VOL ET SITES' : 'VOL DE LA PROSPECTION'}
        {volId ? ' · ENREGISTRÉ' : ''}
      </ThemedText>

      {erreurs.length > 0 && (
        <View style={styles.erreurs} accessibilityRole="alert">
          {erreurs.map((e) => (
            <ThemedText key={e} style={styles.erreur}>
              • {e}
            </ThemedText>
          ))}
        </View>
      )}

      <BandeauEquipeVol equipe={equipe} aeronef={aeronef} aeronefs={aeronefs} onChoisirAeronef={choisirAeronef} />

      <ThemedText style={styles.etiquette}>Date *</ThemedText>
      <DateField value={date} onChange={setDate} editable={!inactif} style={styles.champ} textStyle={styles.champTexte} />

      <View style={styles.heures}>
        <View style={styles.heure} testID="bloc-vol-debut">
          <ThemedText style={styles.etiquette}>Heure début *</ThemedText>
          <TimeField value={debut || null} onChange={setDebut} editable={!inactif} />
        </View>
        <View style={styles.heure} testID="bloc-vol-fin">
          <ThemedText style={styles.etiquette}>Heure fin *</ThemedText>
          <TimeField value={fin || null} onChange={setFin} editable={!inactif} />
        </View>
      </View>
      <View style={styles.duree}>
        <ThemedText style={styles.dureeEtiquette}>Durée</ThemedText>
        <ThemedText style={styles.dureeValeur}>{formaterDuree(dureeMinutes(debut, fin))}</ThemedText>
      </View>

      <View style={styles.info}>
        <ThemedText style={styles.infoSite}>Site principal (implicite)</ThemedText>
        <ThemedText style={styles.infoSiteValeur}>{principal ? libelleSite(principal) : 'Aucun site actif'}</ThemedText>
      </View>

      <ThemedText style={styles.etiquette}>
        {categorie === 'application' ? 'Stand de remplissage *' : 'Stand de remplissage'}
      </ThemedText>
      <ChoixField
        etiquette="Stand"
        valeur={standId}
        options={options}
        onChoisir={inactif ? () => undefined : setStandId}
        placeholder={options.length === 0 ? 'Aucun stand pour ce site' : '— choisir —'}
      />
      <ThemedText style={styles.etiquette}>Base secondaire</ThemedText>
      <ChoixField
        etiquette="Base secondaire"
        valeur={baseId}
        options={options.filter((o) => o.valeur !== standId)}
        onChoisir={inactif ? () => undefined : setBaseId}
        placeholder="Aucune"
      />

      {!inactif && (
        <TouchableOpacity
          style={[styles.cta, isRunning && { opacity: 0.6 }]}
          onPress={enregistrer}
          disabled={isRunning}
          accessibilityRole="button"
          testID="bloc-vol-enregistrer"
        >
          <ThemedText style={styles.ctaTexte}>{volId ? 'Mettre à jour le vol' : 'Enregistrer le vol'}</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 6, marginTop: 16 },
  titre: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  etiquette: { fontSize: 10, lineHeight: 12, fontWeight: '600', color: EQ.attenue, marginTop: 4 },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.vertBordure,
    backgroundColor: EQ.vertLeger,
  },
  infoSite: { fontSize: 9, lineHeight: 14, fontWeight: '600', color: EQ.vert },
  infoSiteValeur: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: EQ.encre },
  champ: { minHeight: 36, borderRadius: 9, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, paddingHorizontal: 11 },
  champTexte: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: EQ.encre },
  heures: { flexDirection: 'row', gap: 10 },
  heure: { flex: 1, gap: 6 },
  duree: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: EQ.fond },
  dureeEtiquette: { fontSize: 10, lineHeight: 13, fontWeight: '500', color: EQ.attenue },
  dureeValeur: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: EQ.encre },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, lineHeight: 14, fontWeight: '500', color: EQ.ambre },
  cta: { height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaTexte: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: EQ.surMarque },
});
