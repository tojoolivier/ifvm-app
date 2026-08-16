import type { RouteObject } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CampagnesPage } from './pages/CampagnesPage'
import { ProspectionsPage } from './pages/ProspectionsPage'
import { TraitementsPage } from './pages/TraitementsPage'
import { TraitementDetailPage } from './pages/TraitementDetailPage'
import { NouvelleProspectionPage } from './pages/NouvelleProspectionPage'
import { ProspectionDetailPage } from './pages/ProspectionDetailPage'
import { SynthesesPage } from './pages/SynthesesPage'
import { CartePage } from './pages/CartePage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { UsersPage } from './pages/UsersPage'
import { StationPage } from './pages/StationPage'
import { ReferentielsPage } from './pages/ReferentielsPage'
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

          // Gestion des traitements
          { path: '/traitements', element: <TraitementsPage />, handle: { title: 'Traitements' } },
          {
            path: '/traitements/:id',
            element: <TraitementDetailPage />,
            handle: { title: 'Fiche de traitement', parent: 'Traitements' },
          },

          // Gestion des utilisateurs
          { path: '/users', element: <UsersPage />, handle: { title: 'Utilisateurs' } },

          // Gestion des stations
          { path: '/stations', element: <StationPage />, handle: { title: 'Stations' } },

          // Référentiels (lecture seule)
          { path: '/referentiels', element: <ReferentielsPage />, handle: { title: 'Référentiels' } },

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
