import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import ProductsPage from './pages/ProductsPage';
import InstallationsPage from './pages/InstallationsPage';
import TechniciansPage from './pages/TechniciansPage';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import DistributorsPage from './pages/DistributorsPage';
import TechTrackingPage from './pages/TechTrackingPage';
import GoogleAdsPage from './pages/GoogleAdsPage';
import UsersPage from './pages/UsersPage';
import MetricsPage from './pages/MetricsPage';

// Tech App Pages
import TechLoginPage from './pages/tech/TechLoginPage';
import TechDashboardPage from './pages/tech/TechDashboardPage';
import TechInstallationPage from './pages/tech/TechInstallationPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function TechProtectedRoute({ children }: { children: React.ReactNode }) {
  const techToken = localStorage.getItem('tech_token');
  if (!techToken) {
    return <Navigate to="/tech/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Admin Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Technician PWA Routes */}
      <Route path="/tech/login" element={<TechLoginPage />} />
      <Route
        path="/tech/dashboard"
        element={
          <TechProtectedRoute>
            <TechDashboardPage />
          </TechProtectedRoute>
        }
      />
      <Route
        path="/tech/installation/:id"
        element={
          <TechProtectedRoute>
            <TechInstallationPage />
          </TechProtectedRoute>
        }
      />
      <Route path="/tech" element={<Navigate to="/tech/login" replace />} />

      {/* Admin Dashboard Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/distributors" element={<DistributorsPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/installations" element={<InstallationsPage />} />
                <Route path="/technicians" element={<TechniciansPage />} />
                <Route path="/tech-tracking" element={<TechTrackingPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/google-ads" element={<GoogleAdsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/metricas" element={<MetricsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
