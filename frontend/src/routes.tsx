import type { RouteObject } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CampagnesPage } from './pages/CampagnesPage'
import { ProspectionsPage } from './pages/ProspectionsPage'
import { NouvelleProspectionPage } from './pages/NouvelleProspectionPage'
import { ProspectionDetailPage } from './pages/ProspectionDetailPage'
import { SynthesesPage } from './pages/SynthesesPage'
import { CartePage } from './pages/CartePage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { UsersPage } from './pages/UsersPage'
import { StationPage } from './pages/StationPage'
import { ValidationFinalePage } from './pages/ValidationFinalePage'
import { NotFoundPage } from './pages/NotFoundPage'

export const routes: RouteObject[] = [
  // Route publique
  { path: '/login', element: <LoginPage /> },

  // Routes protégées
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          // Dashboard principal
          { path: '/', element: <DashboardPage />, handle: { title: 'Tableau de bord' } },

          // Gestion des campagnes
          { path: '/campagnes', element: <CampagnesPage />, handle: { title: 'Campagnes' } },

          // Gestion des prospections
          {
            path: '/prospections',
            element: <ProspectionsPage />,
            handle: { title: 'Prospections' },
          },
          {
            path: '/prospections/new',
            element: <NouvelleProspectionPage />,
            handle: { title: 'Nouvelle prospection', parent: 'Prospections' },
          },
          {
            path: '/prospections/:id',
            element: <ProspectionDetailPage />,
            handle: { title: 'Fiche de prospection', parent: 'Prospections' },
          },

          // Gestion des utilisateurs
          { path: '/users', element: <UsersPage />, handle: { title: 'Utilisateurs' } },

          // Gestion des stations
          { path: '/stations', element: <StationPage />, handle: { title: 'Stations' } },

          // Validation finale
          {
            path: '/validation-finale',
            element: <ValidationFinalePage />,
            handle: { title: 'Validation finale' },
          },

          // Autres pages
          { path: '/syntheses', element: <SynthesesPage />, handle: { title: 'Synthèses & export' } },
          { path: '/carte', element: <CartePage />, handle: { title: 'Carte des infestations' } },
          {
            path: '/design-system',
            element: <DesignSystemPage />,
            handle: { title: 'Design system' },
          },
        ],
      },
    ],
  },

  // Route inconnue : vraie page 404, pas de renvoi silencieux vers LoginPage
  { path: '*', element: <NotFoundPage /> },
]
