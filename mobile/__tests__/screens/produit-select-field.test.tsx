/**
 * ProduitSelectField : remplace l'ancien affichage en chips (tous les produits du
 * référentiel visibles simultanément) par un champ unique ouvrant une liste de
 * sélection avec recherche — un seul produit sélectionnable, comportement identique
 * pour TerrestreForm et AerienForm qui réutilisent ce composant.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { ProduitSelectField } from '@/components/traitement/ProduitSelectField';
import { Pesticide } from '@/lib/referentiel-db';

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const PESTICIDES: Pesticide[] = [
  { id: 'p1', code: 'chlorpyrifos', nom: 'CHLORPYRIFOS 240 ULV', matiere_active: 'Chlorpyriphos-Ethyl', dose_reference: null, type_produit: null },
  { id: 'p2', code: 'deltamethrine', nom: 'DELTAMETHRINE 15 IL', matiere_active: 'Deltaméthrine 15 UL', dose_reference: null, type_produit: null },
  { id: 'p3', code: 'fenitrothion', nom: 'FENITROTHION 200 SC', matiere_active: 'Fenitrothion', dose_reference: null, type_produit: null },
  { id: 'p4', code: 'green_muscle', nom: 'GREEN MUSCLE', matiere_active: 'Métarhizium', dose_reference: null, type_produit: null },
];

describe('ProduitSelectField', () => {
  afterEach(cleanup);

  it('affiche le placeholder par défaut quand rien n’est sélectionné', async () => {
    await render(<ProduitSelectField pesticides={PESTICIDES} selectedId={null} onSelect={jest.fn()} />);
    expect(screen.getByText('Sélectionner un produit')).toBeTruthy();
  });

  it('affiche le produit déjà sélectionné dans le champ fermé', async () => {
    await render(<ProduitSelectField pesticides={PESTICIDES} selectedId="p3" onSelect={jest.fn()} />);
    expect(screen.getByText('FENITROTHION 200 SC')).toBeTruthy();
    expect(screen.queryByText('Sélectionner un produit')).toBeNull();
  });

  it('ouvre la liste et affiche tous les produits au tap sur le champ', async () => {
    await render(<ProduitSelectField pesticides={PESTICIDES} selectedId={null} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByText('Sélectionner un produit'));
    await settle();
    for (const p of PESTICIDES) {
      expect(screen.getByText(p.nom)).toBeTruthy();
    }
  });

  it('la recherche filtre la liste des produits', async () => {
    await render(<ProduitSelectField pesticides={PESTICIDES} selectedId={null} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByText('Sélectionner un produit'));
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Rechercher un produit'), 'green');
    await settle();
    expect(screen.getByText('GREEN MUSCLE')).toBeTruthy();
    expect(screen.queryByText('FENITROTHION 200 SC')).toBeNull();
  });

  it('sélectionner un produit appelle onSelect et ferme le modal', async () => {
    const onSelect = jest.fn();
    await render(<ProduitSelectField pesticides={PESTICIDES} selectedId={null} onSelect={onSelect} />);
    fireEvent.press(screen.getByText('Sélectionner un produit'));
    await settle();
    fireEvent.press(screen.getByText('DELTAMETHRINE 15 IL'));
    await settle();
    expect(onSelect).toHaveBeenCalledWith(PESTICIDES[1]);
    expect(screen.queryByPlaceholderText('Rechercher un produit')).toBeNull();
  });

  it('readOnly empêche l’ouverture de la liste', async () => {
    await render(<ProduitSelectField pesticides={PESTICIDES} selectedId={null} onSelect={jest.fn()} readOnly />);
    fireEvent.press(screen.getByText('Sélectionner un produit'));
    await settle();
    expect(screen.queryByPlaceholderText('Rechercher un produit')).toBeNull();
  });
});
