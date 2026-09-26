import { Navigate, type RouteObject } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CampagnesPage } from './pages/CampagnesPage'
import { ProspectionsPage } from './pages/ProspectionsPage'
import { TraitementsPage } from './pages/TraitementsPage'
import { TraitementDetailPage } from './pages/TraitementDetailPage'
import { VolsPage } from './pages/VolsPage'
import { VolDetailPage } from './pages/VolDetailPage'
import { ParcAeronefsPage } from './pages/ParcAeronefsPage'
import { NouvelleProspectionPage } from './pages/NouvelleProspectionPage'
import { ProspectionDetailPage } from './pages/ProspectionDetailPage'
import { SynthesesPage } from './pages/SynthesesPage'
import { CartePage } from './pages/CartePage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { AdministrationPage } from './pages/AdministrationPage'
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
          { path: '/', element: <DashboardPage />, handle: { crumb: 'Supervision', title: 'Tableau de bord' } },

          // Gestion des campagnes
          { path: '/campagnes', element: <CampagnesPage />, handle: { crumb: 'Référentiel', title: 'Campagnes' } },

          // Gestion des prospections
          {
            path: '/prospections',
            element: <ProspectionsPage />,
            handle: { crumb: 'Fiches terrain', title: 'Prospections' },
          },
          {
            path: '/prospections/new',
            element: <NouvelleProspectionPage />,
            handle: { crumb: 'Fiches terrain', title: 'Nouvelle prospection' },
          },
          {
            path: '/prospections/:id',
            element: <ProspectionDetailPage />,
            handle: { crumb: 'Fiches terrain', title: 'Fiche de prospection' },
          },

          // Gestion des traitements
          {
            path: '/traitements',
            element: <TraitementsPage />,
            handle: { crumb: 'Lutte', title: 'Fiches de traitement' },
          },
          {
            path: '/traitements/:id',
            element: <TraitementDetailPage />,
            handle: { crumb: 'Lutte', title: 'Fiche de traitement' },
          },

          // Vols (#608, #610) : liste filtrable avec total d'heures, puis détail d'un vol. Remplace la
          // page provisoire « Heures de vol ».
          {
            path: '/vols',
            element: <VolsPage />,
            handle: { crumb: 'Lutte', title: 'Vols' },
          },
          {
            path: '/vols/:id',
            element: <VolDetailPage />,
            handle: { crumb: 'Lutte', title: 'Vol' },
          },
          // Ancien chemin de la page « Heures de vol », conservé en redirection pour les favoris.
          { path: '/fiches-vol', element: <Navigate to="/vols" replace /> },

          // Parc aéronefs (#621, #603) : les hélicoptères, leur cycle de vie et l'historique de leurs
          // affectations aux équipes aériennes. Menu réservé aux profils admin et chef.
          {
            path: '/parc-aeronefs',
            element: <ParcAeronefsPage />,
            handle: { crumb: 'Lutte', title: 'Parc aéronefs' },
          },

          // Administration (personnel, stations, équipes aériennes/terrestres —
          // même présentation que ReferentielsPage, nav de gauche par section)
          {
            path: '/administration',
            element: <AdministrationPage />,
            handle: { crumb: 'Administration', title: 'Utilisateurs, stations & équipes' },
          },
          // Anciennes routes, conservées en redirection — l'onglet ouvert doit
          // correspondre à l'ancienne route, pas retomber sur Utilisateurs par défaut.
          {
            path: '/users',
            element: <Navigate to="/administration" replace state={{ tab: 'utilisateurs' }} />,
          },
          {
            path: '/stations',
            element: <Navigate to="/administration" replace state={{ tab: 'stations' }} />,
          },

          // Référentiels (lecture seule)
          {
            path: '/referentiels',
            element: <ReferentielsPage />,
            handle: { crumb: 'Administration', title: 'Référentiels' },
          },

          // Validation finale
          {
            path: '/validation-finale',
            element: <ValidationFinalePage />,
            handle: { crumb: 'Contrôle', title: 'Validation finale' },
          },

          // Autres pages
          {
            path: '/syntheses',
            element: <SynthesesPage />,
            handle: { crumb: 'Analyse', title: 'Synthèses & export' },
          },
          { path: '/carte', element: <CartePage />, handle: { title: 'Cartographie' } },
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
