/**
 * Carte « Équipe de travail » de l'Accueil et liste à choix unique de Paramètres (#641), d'après
 * les maquettes Figma « #641 — Équipe de travail ».
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EquipeRadioList } from '@/components/equipe/EquipeRadioList';
import { EquipeTravailCard } from '@/components/equipe/EquipeTravailCard';

const SUD = { id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien' as const, nb_membres: 4 };
const TOLIARA = { id: 'eq-tol', nom: 'EMT Toliara', type: 'terrestre' as const, nb_membres: 5 };

const RESUME_AERIEN = {
  sitePrincipal: { id: 's1', parent_site_id: null, numero: 'n°03', localite: 'Isoanala', date_debut_position: '2026-09-12' },
  sitesSecondaires: [{ id: 's2', parent_site_id: 's1', numero: 'n°01', localite: 'Isoanala', date_debut_position: null }],
  aeronef: { id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188' },
  derniereIntervention: null,
};

describe('EquipeTravailCard', () => {
  it('équipe aérienne : nom, type, site principal, stand et aéronef', async () => {
    await render(<EquipeTravailCard equipe={SUD} resume={RESUME_AERIEN} onChanger={jest.fn()} onVoir={jest.fn()} />);

    expect(screen.getByText('ÉQUIPE DE TRAVAIL')).toBeTruthy();
    expect(screen.getByText('Équipe Sud')).toBeTruthy();
    expect(screen.getByText('AÉRIENNE')).toBeTruthy();
    expect(screen.getByText('Isoanala · n°03')).toBeTruthy();
    expect(screen.getByText('Stand n°01 · Isoanala')).toBeTruthy();
    expect(screen.getByText('5R-MHR')).toBeTruthy();
  });

  it('équipe terrestre : dernière intervention rattachée', async () => {
    await render(
      <EquipeTravailCard
        equipe={TOLIARA}
        resume={{ sitePrincipal: null, sitesSecondaires: [], aeronef: null, derniereIntervention: '2026-09-20' }}
        onChanger={jest.fn()}
        onVoir={jest.fn()}
      />
    );

    expect(screen.getByText('TERRESTRE')).toBeTruthy();
    expect(screen.getByText('Dernière intervention')).toBeTruthy();
    expect(screen.getByText('20/09')).toBeTruthy();
  });

  it('« Changer » et « Voir l’équipe et ses sites » déclenchent leurs actions', async () => {
    const onChanger = jest.fn();
    const onVoir = jest.fn();
    await render(<EquipeTravailCard equipe={SUD} resume={RESUME_AERIEN} onChanger={onChanger} onVoir={onVoir} />);

    await fireEvent.press(screen.getByText('Changer ›'));
    await fireEvent.press(screen.getByText('Voir l’équipe et ses sites ›'));

    expect(onChanger).toHaveBeenCalled();
    expect(onVoir).toHaveBeenCalled();
  });

  it('sans équipe : invite à en définir une', async () => {
    const onChanger = jest.fn();
    await render(<EquipeTravailCard equipe={null} resume={null} onChanger={onChanger} onVoir={jest.fn()} />);

    expect(screen.getByText('AUCUNE ÉQUIPE DE TRAVAIL')).toBeTruthy();
    await fireEvent.press(screen.getByText('Définir l’équipe'));
    expect(onChanger).toHaveBeenCalled();
  });
});

describe('EquipeRadioList', () => {
  it('liste les équipes avec type et effectif, marque l’équipe choisie, et rappelle la portée du choix', async () => {
    await render(<EquipeRadioList equipes={[SUD, TOLIARA]} equipeId="eq-sud" onChoisir={jest.fn()} />);

    expect(screen.getByText('Aérienne · 4 membres')).toBeTruthy();
    expect(screen.getByText('Terrestre · 5 membres')).toBeTruthy();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(screen.getByText(/gardent leur équipe d'origine/)).toBeTruthy();
  });

  it('choisir une équipe applique le choix tout de suite', async () => {
    const onChoisir = jest.fn();
    await render(<EquipeRadioList equipes={[SUD, TOLIARA]} equipeId="eq-sud" onChoisir={onChoisir} />);

    await fireEvent.press(screen.getByText('EMT Toliara'));

    expect(onChoisir).toHaveBeenCalledWith('eq-tol');
  });
});
