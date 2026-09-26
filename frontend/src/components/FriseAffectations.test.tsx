import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FriseAffectations, type LigneFrise } from './FriseAffectations'

const LIGNES: LigneFrise[] = [
  { id: 'a2', titre: 'Équipe Betroka', date_debut: '2026-07-01', date_fin: null },
  { id: 'a1', titre: 'Équipe Ihosy', sousTitre: 'Heli Madagascar', date_debut: '2026-06-01', date_fin: '2026-07-01' },
]

function frise(lignes = LIGNES) {
  return render(
    <FriseAffectations
      lignes={lignes}
      aujourdhui="2026-07-31"
      ariaLabel="Historique des affectations de l'appareil"
      messageVide="Aucune affectation."
    />,
  )
}

// #621, #603 : frise temporelle des affectations d'aéronefs.
describe('FriseAffectations', () => {
  it('affiche une ligne par affectation, dans l’ordre reçu', () => {
    frise()

    const liste = screen.getByRole('list', { name: "Historique des affectations de l'appareil" })
    const lignes = within(liste).getAllByTestId('frise-ligne')
    expect(lignes).toHaveLength(2)
    expect(within(lignes[0]).getByText('Équipe Betroka')).toBeInTheDocument()
    expect(within(lignes[1]).getByText('Équipe Ihosy')).toBeInTheDocument()
    expect(within(lignes[1]).getByText('Heli Madagascar')).toBeInTheDocument()
  })

  it('affiche les dates au format JJ/MM/AAAA, « depuis le » pour l’affectation en cours', () => {
    frise()

    expect(screen.getByText('Depuis le 01/07/2026')).toBeInTheDocument()
    expect(screen.getByText('Du 01/06/2026 au 01/07/2026')).toBeInTheDocument()
  })

  it('marque seule l’affectation en cours', () => {
    frise()

    const [enCours, close] = screen.getAllByTestId('frise-ligne')
    expect(within(enCours).getByText('En cours')).toBeInTheDocument()
    expect(within(close).queryByText('En cours')).not.toBeInTheDocument()
  })

  it('positionne les barres sur la période totale (1er juin → 31 juillet, 60 jours)', () => {
    frise()

    const barres = screen.getAllByTestId('frise-barre')
    // En cours : du 1er juillet (30/60 = 50 %) à aujourd'hui.
    expect(barres[0]).toHaveStyle({ left: '50%', width: '50%' })
    // Close : du 1er juin au 1er juillet (0 → 50 %).
    expect(barres[1]).toHaveStyle({ left: '0%', width: '50%' })
  })

  it('distingue visuellement l’affectation en cours', () => {
    frise()

    const barres = screen.getAllByTestId('frise-barre')
    expect(barres[0]).toHaveClass('bg-ifvm-green-text')
    expect(barres[1]).not.toHaveClass('bg-ifvm-green-text')
  })

  it('affiche l’action d’une ligne', () => {
    frise([{ ...LIGNES[0], action: <button type="button">Clore</button> }, LIGNES[1]])

    const [enCours] = screen.getAllByTestId('frise-ligne')
    expect(within(enCours).getByRole('button', { name: 'Clore' })).toBeInTheDocument()
  })

  it('sans affectation : le message d’état vide, pas de frise', () => {
    frise([])

    expect(screen.getByText('Aucune affectation.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
