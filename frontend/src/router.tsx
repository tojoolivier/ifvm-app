import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/prospection/extensive" element={<div className="p-6">Prospection extensive — à implémenter</div>} />
            <Route path="/prospection/intensive" element={<div className="p-6">Prospection intensive — à implémenter</div>} />
            <Route path="/meteo" element={<div className="p-6">Relevés météo — à implémenter</div>} />
            <Route path="/traitement" element={<div className="p-6">CRT — à implémenter</div>} />
            <Route path="/vol" element={<div className="p-6">Fiches de vol — à implémenter</div>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
