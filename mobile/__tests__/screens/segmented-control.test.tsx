/**
 * `SegmentedControl` — un libellé plus long que les autres ("Couvertures
 * totales", mode de traitement) passe sur deux lignes dans un segment
 * `flex: 1` partagé à trois : sans `textAlign: 'center'` explicite sur le
 * texte, ces lignes restent calées à gauche du bloc pendant que les libellés
 * courts, tenant sur une seule ligne, semblent déjà centrés. Verrouille le
 * correctif (centrage explicite, quelle que soit la longueur du libellé).
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SegmentedControl } from '@/components/traitement/SegmentedControl';

describe('SegmentedControl — centrage des libellés', () => {
  const OPTIONS = [
    { value: 'TOTAL', label: 'Couvertures totales' },
    { value: 'BARRIERE', label: 'Barrières' },
    { value: 'IRREGULIER', label: 'Irrégulier' },
  ];

  it('centre le texte de chaque segment, y compris le libellé le plus long', async () => {
    await render(
      <SegmentedControl options={OPTIONS} value={null} onChange={() => {}} />
    );

    for (const { label } of OPTIONS) {
      expect(screen.getByText(label).props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ textAlign: 'center' })])
      );
    }
  });

  it('conserve la sélection et le comportement existants', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={OPTIONS} value="BARRIERE" onChange={onChange} />);

    fireEvent.press(screen.getByText('Couvertures totales'));

    expect(onChange).toHaveBeenCalledWith('TOTAL');
  });
});
