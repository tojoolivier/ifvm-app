import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CampagnesPage } from './pages/CampagnesPage'
import { ProspectionsPage } from './pages/ProspectionsPage'
import { NouvelleProspectionPage } from './pages/NouvelleProspectionPage'
import { ProspectionDetailPage } from './pages/ProspectionDetailPage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { UsersPage } from './pages/UsersPage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/campagnes', element: <CampagnesPage /> },
          { path: '/prospections', element: <ProspectionsPage /> },
          { path: '/prospections/new', element: <NouvelleProspectionPage /> },
          { path: '/prospections/:id', element: <ProspectionDetailPage /> },
          { path: '/design-system', element: <DesignSystemPage /> },
          { path: '/users', element: <UsersPage /> },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
