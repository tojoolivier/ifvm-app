import { useCallback, useEffect, useRef, useState } from 'react';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

interface Options<F extends { recherche: string }, L> {
  /** Filtres de départ ; « Tout effacer » y revient en gardant la recherche saisie. */
  defaut: F;
  lister: (filtre: F) => Promise<L[]>;
  /** Nom de l'écran, pour le journal de debug. */
  source: string;
}

/**
 * État d'une liste du référentiel filtrable : les filtres, les lignes qu'ils donnent, et leur mise à jour.
 * Commun aux listes pesticides, stations et codes stades, qui relisaient chacune le cache local avec la
 * même garde contre les réponses tardives.
 */
export function useListeFiltrable<F extends { recherche: string }, L>({ defaut, lister, source }: Options<F, L>) {
  const signalerChargement = useSignalerChargement(source);
  const [filtre, setFiltre] = useState<F>(defaut);
  const [lignes, setLignes] = useState<L[]>([]);
  const derniereRequete = useRef(0);

  useEffect(() => {
    const numero = ++derniereRequete.current;
    lister(filtre)
      .then((resultat) => {
        // Une frappe plus récente a déjà lancé sa requête : la réponse tardive ne doit pas l'écraser.
        if (numero === derniereRequete.current) setLignes(resultat);
      })
      .catch((error) => signalerChargement(error, { source }));
  }, [filtre, lister, signalerChargement, source]);

  const modifier = useCallback((partie: Partial<F>) => setFiltre((f) => ({ ...f, ...partie })), []);
  const effacer = useCallback(() => setFiltre((f) => ({ ...defaut, recherche: f.recherche })), [defaut]);

  return { filtre, lignes, modifier, effacer, signalerChargement };
}
