/** Bloc vol d'une fiche (traitement aérien / prospection extensive) — #644, Figma 81:447. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BlocVol } from '@/components/vol/BlocVol';
import { PreconditionError } from '@/lib/errors';
import { listAeronefsEquipe } from '@/lib/equipe-db';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { listProspectionsAeriennesDuJour } from '@/lib/prospection-repository';
import { getEquipeLocale } from '@/lib/referentiel-db';
import { listSitesAeriensEquipe } from '@/lib/site-aerien-db';
import { enregistrerVolOperation, getVolDeOperation } from '@/lib/vol-db';

jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-db', () => ({ getEquipeLocale: jest.fn() }));
jest.mock('@/lib/equipe-db', () => ({ listAeronefsEquipe: jest.fn(), aujourdhuiIso: () => '2026-09-23' }));
jest.mock('@/lib/site-aerien-db', () => ({ listSitesAeriensEquipe: jest.fn() }));
jest.mock('@/lib/prospection-repository', () => ({ listProspectionsAeriennesDuJour: jest.fn() }));
jest.mock('@/lib/vol-db', () => ({ enregistrerVolOperation: jest.fn(), getVolDeOperation: jest.fn() }));
jest.mock('@/components/TimeField', () => {
  const { TextInput } = jest.requireActual('react-native');
  return {
    TimeField: ({ value, onChange }: { value: string | null; onChange: (v: string) => void }) => (
      <TextInput testID="time-input" value={value ?? ''} onChangeText={onChange} />
    ),
  };
});
jest.mock('@/components/DateField', () => {
  const { Text } = jest.requireActual('react-native');
  return { DateField: ({ value }: { value: string }) => <Text>{value}</Text> };
});

const site = (id: string, parent: string | null, numero: string) => ({
  id,
  parent_site_id: parent,
  equipe_id: parent ? null : 'eq-1',
  numero,
  localite: 'Isoanala',
});

beforeEach(() => {
  useEquipeTravailStore.setState({ equipeId: 'eq-1', isInitialized: true });
  jest.mocked(getEquipeLocale).mockResolvedValue({ id: 'eq-1', nom: 'Équipe Sud', type: 'aerien' } as any);
  jest.mocked(listAeronefsEquipe).mockReset().mockResolvedValue([{ id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna' }]);
  jest.mocked(listSitesAeriensEquipe).mockResolvedValue([site('pr-1', null, '03'), site('st-1', 'pr-1', '01'), site('bs-1', 'pr-1', '02')] as any);
  jest.mocked(getVolDeOperation).mockReset().mockResolvedValue(null);
  jest.mocked(listProspectionsAeriennesDuJour).mockReset().mockResolvedValue([]);
  jest.mocked(enregistrerVolOperation).mockReset().mockResolvedValue('vol-1');
});

const remplirHeures = async () => {
  const heures = screen.getAllByTestId('time-input');
  await fireEvent.changeText(heures[0], '06:30');
  await fireEvent.changeText(heures[1], '09:15');
};

describe('BlocVol — application', () => {
  it('reprend équipe, aéronef et site principal implicite, et calcule la durée', async () => {
    await render(<BlocVol categorie="application" ficheId="tr-1" />);

    expect(await screen.findByText('Équipe Sud')).toBeVisible();
    expect(await screen.findByText('5R-MHR')).toBeVisible();
    expect(screen.getByText('Isoanala · 03')).toBeVisible();
    await remplirHeures();
    expect(screen.getByText('2h 45min')).toBeVisible();
  });

  it('cherche l’aéronef affecté à la date du vol', async () => {
    await render(<BlocVol categorie="application" ficheId="tr-1" dateParDefaut="2026-09-20" />);
    await screen.findByText('5R-MHR');
    expect(listAeronefsEquipe).toHaveBeenCalledWith('eq-1', '2026-09-20');
  });

  it('affiche les refus de validation sans marquer le vol enregistré', async () => {
    jest.mocked(enregistrerVolOperation).mockRejectedValue(new PreconditionError('Choisissez le stand de remplissage.'));
    await render(<BlocVol categorie="application" ficheId="tr-1" />);
    await screen.findByText('5R-MHR');

    await fireEvent.press(screen.getByTestId('bloc-vol-enregistrer'));

    expect(await screen.findByText('• Choisissez le stand de remplissage.')).toBeVisible();
    expect(screen.queryByText(/ENREGISTRÉ/)).toBeNull();
  });

  it('enregistre le vol lié au traitement avec le stand choisi parmi les dépendants', async () => {
    await render(<BlocVol categorie="application" ficheId="tr-1" />);
    await screen.findByText('5R-MHR');

    await remplirHeures();
    await fireEvent.press(screen.getByLabelText('Stand'));
    await fireEvent.press(await screen.findByText('Isoanala · 01'));
    await fireEvent.press(screen.getByTestId('bloc-vol-enregistrer'));

    await waitFor(() =>
      expect(enregistrerVolOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          categorie: 'application',
          equipeId: 'eq-1',
          aeronefId: 'ae-1',
          sitePrincipalId: 'pr-1',
          standId: 'st-1',
          debut: '06:30',
          fin: '09:15',
          dependantIds: ['st-1', 'bs-1'],
          liens: [{ type: 'traitement', refId: 'tr-1' }],
        })
      )
    );
    expect(await screen.findByText(/ENREGISTRÉ/)).toBeVisible();
  });

  it('un vol déjà envoyé au serveur n’est plus modifiable', async () => {
    jest.mocked(getVolDeOperation).mockResolvedValue({
      id: 'vol-1', categorie: 'application', origine: 'traitement', date_vol: '2026-09-23',
      heure_debut: '06:30', heure_fin: '09:15', statut_sync: 'synced', stand_id: 'st-1', base_secondaire_id: null,
    } as any);
    await render(<BlocVol categorie="application" ficheId="tr-1" />);

    expect(await screen.findByText(/ENREGISTRÉ/)).toBeVisible();
    expect(screen.queryByTestId('bloc-vol-enregistrer')).toBeNull();
  });

  it('sans équipe de travail, n’affiche rien', async () => {
    useEquipeTravailStore.setState({ equipeId: null, isInitialized: true });
    await render(<BlocVol categorie="application" ficheId="tr-1" />);
    expect(screen.queryByTestId('bloc-vol')).toBeNull();
  });
});

describe('BlocVol — prospection : « Ce vol couvre aussi »', () => {
  beforeEach(() => {
    jest.mocked(listProspectionsAeriennesDuJour).mockResolvedValue([
      { id: 'p-2', n_fiche: '0042' },
      { id: 'p-3', n_fiche: '0043' },
      { id: 'p-4', n_fiche: '0044' },
    ]);
    jest.mocked(getVolDeOperation).mockImplementation(async (_type, id) => {
      if (id === 'p-3') return { id: 'v-local', statut_sync: 'local' } as any;
      if (id === 'p-4') return { id: 'v-envoye', statut_sync: 'synced' } as any;
      return null;
    });
  });

  it('propose les fiches du jour, reprend celles au vol local, écarte celles au vol déjà envoyé', async () => {
    await render(<BlocVol categorie="prospection" ficheId="p-1" />);

    expect(await screen.findByText('Fiche 0042')).toBeVisible();
    expect(screen.getByText('Fiche 0043')).toBeVisible();
    expect(screen.getByText('Reprend le vol déjà saisi pour cette fiche')).toBeVisible();
    expect(screen.queryByText('Fiche 0044')).toBeNull();
  });

  it('rattache les fiches cochées au même vol', async () => {
    await render(<BlocVol categorie="prospection" ficheId="p-1" />);
    await screen.findByText('Fiche 0042');

    await remplirHeures();
    await fireEvent.press(screen.getByTestId('vol-couvre-p-2'));
    await fireEvent.press(screen.getByTestId('bloc-vol-enregistrer'));

    await waitFor(() =>
      expect(enregistrerVolOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          categorie: 'prospection',
          liens: [
            { type: 'prospection', refId: 'p-1' },
            { type: 'prospection', refId: 'p-2' },
          ],
        })
      )
    );
  });
});
