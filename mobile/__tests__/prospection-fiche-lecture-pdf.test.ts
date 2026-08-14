import { buildFicheLecturePdfHtml } from '../src/lib/prospection-fiche-lecture-pdf';
import { FicheLectureViewModel } from '../src/lib/prospection-fiche-lecture';

function recap(overrides: Partial<FicheLectureViewModel> = {}): FicheLectureViewModel {
  return {
    nFiche: 'F-001',
    statutLabel: 'Validée ✓',
    stationLabel: 'Station Nord',
    dateProspection: '2026-07-05',
    especes: [],
    infestation: {
      hasInfestation: false,
      typeLabel: '—',
      surfaceTotale: null,
      comportementLabel: '—',
      pullulationNb: null,
      tailleEssaim: '—',
      typeEssaim: null,
      typeLarve: null,
      surfaceContamineeHa: null,
      surfaceInfesteePourcent: null,
    },
    vegetationSummary: 'Strates (100%) : Herbeuse 100%',
    region: null,
    district: null,
    commune: null,
    za: null,
    pa_code: null,
    degatsCulturesPourcent: null,
    verdissementPourcent: null,
    hauteurHerbeCm: null,
    ...overrides,
  };
}

describe('buildFicheLecturePdfHtml', () => {
  it('inclut les mêmes valeurs que la vue, sans recalcul', () => {
    const html = buildFicheLecturePdfHtml(
      recap({
        especes: [
          { espece: 'LMC', totalCaptures: 12, densiteDiffuse: 5, densiteGroupee: null, phenotypeDominantLabel: 'Grégaires' },
        ],
      }),
      'Jean Rakoto'
    );

    expect(html).toContain('F-001');
    expect(html).toContain('Station Nord');
    expect(html).toContain('Jean Rakoto');
    expect(html).toContain('LMC');
    expect(html).toContain('12');
    expect(html).toContain('Grégaires');
    expect(html).toContain('Strates (100%) : Herbeuse 100%');
  });

  it("échappe le contenu utilisateur pour éviter d'injecter du HTML", () => {
    const html = buildFicheLecturePdfHtml(recap({ nFiche: '<script>alert(1)</script>' }), '—');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it("affiche 'Aucune infestation enregistrée' quand hasInfestation est faux", () => {
    const html = buildFicheLecturePdfHtml(recap(), '—');
    expect(html).toContain('Aucune infestation enregistrée');
  });
});
