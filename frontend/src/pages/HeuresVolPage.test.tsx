import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeuresVolPage } from './HeuresVolPage'

describe('HeuresVolPage', () => {
  it("annonce que le suivi des heures de vol n'est pas encore disponible", () => {
    render(<HeuresVolPage />)

    expect(screen.getByRole('heading', { name: 'Heures de vol' })).toBeTruthy()
    expect(screen.getByText('Bientôt disponible')).toBeTruthy()
  })
})
