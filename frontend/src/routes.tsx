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
          { path: '/', element: <DashboardPage /> },

          // Gestion des campagnes
          { path: '/campagnes', element: <CampagnesPage /> },

          // Gestion des prospections
          { path: '/prospections', element: <ProspectionsPage /> },
          { path: '/prospections/new', element: <NouvelleProspectionPage /> },
          { path: '/prospections/:id', element: <ProspectionDetailPage /> },

          // Gestion des utilisateurs
          { path: '/users', element: <UsersPage /> },

          // Gestion des stations
          { path: '/stations', element: <StationPage /> },

          // Validation finale
          { path: '/validation-finale', element: <ValidationFinalePage /> },

          // Autres pages
          { path: '/syntheses', element: <SynthesesPage /> },
          { path: '/carte', element: <CartePage /> },
          { path: '/design-system', element: <DesignSystemPage /> },
        ],
      },
    ],
  },

  // Route inconnue : vraie page 404, pas de renvoi silencieux vers LoginPage
  { path: '*', element: <NotFoundPage /> },
]
