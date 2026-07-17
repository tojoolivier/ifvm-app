import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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

const router = createBrowserRouter([
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
          
          // Autres pages
          { path: '/syntheses', element: <SynthesesPage /> },
          { path: '/carte', element: <CartePage /> },
          { path: '/design-system', element: <DesignSystemPage /> },
        ],
      },
    ],
  },
  
  // Redirection par défaut
  { path: '*', element: <LoginPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}