import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import type { ProspectionCreate } from '@/lib/prospection-db';
import { plusProche, type Coordonnees } from '@/lib/prospection-rattachement';
import {
  getStationById,
  listPostesAcridiens,
  listStationsActives,
  listStationsByPoste,
  type PosteAcridien,
  type StationFixe,
} from '@/lib/referentiel-db';

const log = logger.child({ module: 'rattachement' });

export type Rattachement = {
  station: StationFixe;
  pa: PosteAcridien | null;
  distanceM: number;
  paManuel?: boolean;
  stationManuel?: boolean;
};

/** Liste de choix ouverte par « Changer » (PA ou stations d'un PA). */
export type Feuille = { titre: string; items: { id: string; libelle: string; choisir: () => void }[] };

/**
 * PA + station de l'intensive, hors ligne : détectés d'après la position (le plus proche), rouverts depuis
 * le brouillon à la reprise, ou choisis à la main via `changerPa` / `changerStation`.
 */
export function useRattachement(params: { type: string; brouillon?: ProspectionCreate; position: Coordonnees | null }) {
  const { type, brouillon, position } = params;
  const { t } = useTranslation();
  const [auto, setAuto] = useState<Rattachement | null>(null);
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const [recherche, setRecherche] = useState('');
  const latitude = position?.latitude;
  const longitude = position?.longitude;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    const ici = { latitude, longitude };
    let annule = false;
    (async () => {
      if (brouillon) {
        // Reprise : on rouvre le rattachement déjà enregistré.
        if (!brouillon.station_id) return;
        const [station, postes] = await Promise.all([getStationById(brouillon.station_id), listPostesAcridiens()]);
        if (annule || !station) return;
        setAuto({
          station,
          pa: postes.find((p) => p.code === brouillon.pa_code) ?? postes.find((p) => p.id === station.paId) ?? null,
          distanceM: plusProche(ici, [station])?.distanceM ?? 0,
        });
        return;
      }
      if (type !== 'intensive') return;
      const [stations, postes] = await Promise.all([listStationsActives(), listPostesAcridiens()]);
      const proche = plusProche(ici, stations);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `brouillon` et `type` sont stables pour la vie de l'écran
  }, [latitude, longitude]);

  const ouvrir = (titre: string, items: Feuille['items']) => {
    setRecherche('');
    setFeuille({ titre, items });
  };
  const choisir = (choix: () => void) => () => {
    choix();
    setFeuille(null);
  };

  const changerPa = async () => {
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
                if (st) setAuto({ distanceM: 0, ...auto, station: st, pa, paManuel: true, stationManuel: true });
              })
              .catch((e) => log.failure('reference_liste_stations', e));
          }),
        }))
      );
    } catch (e) {
      log.failure('reference_liste_pa', e);
    }
  };

  const changerStation = async () => {
    if (!auto?.pa) return changerPa();
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

  return {
    auto,
    feuille,
    recherche,
    setRecherche,
    fermerFeuille: () => setFeuille(null),
    changerPa,
    changerStation,
  };
}
