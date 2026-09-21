import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

// Pages
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import LiveTVPage from '@/pages/LiveTVPage';
import MoviesPage from '@/pages/MoviesPage';
import SeriesPage from '@/pages/SeriesPage';
import SeriesDetailPage from '@/pages/SeriesDetailPage';
import FavoritesPage from '@/pages/FavoritesPage';
import SearchPage from '@/pages/SearchPage';
import SettingsPage from '@/pages/SettingsPage';
import PlayerPage from '@/pages/PlayerPage';
import ConnectPage from '@/pages/ConnectPage';
import MultiViewPage from '@/pages/MultiViewPage';

const App = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} 
          />

          {/* TV Companion Pairing Route for Phone */}
          <Route path="/connect" element={<ConnectPage />} />
          
          {/* Protected Routes */}
          <Route element={isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/live" element={<LiveTVPage />} />
            <Route path="/multiview" element={<MultiViewPage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/series/:seriesId" element={<SeriesDetailPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Fullscreen Video Player Route */}
          <Route 
            path="/player/:type/:streamId" 
            element={isAuthenticated ? <PlayerPage /> : <Navigate to="/login" replace />} 
          />

          <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
