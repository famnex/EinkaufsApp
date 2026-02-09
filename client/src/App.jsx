import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { EditModeProvider } from './contexts/EditModeContext';
import { SyncProvider } from './contexts/SyncContext';

import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Lists from './pages/Lists';
import ListDetail from './pages/ListDetail';
import Products from './pages/Products';
import SettingsPage from './pages/Settings';
import MenuPlan from './pages/MenuPlan';
import Recipes from './pages/Recipes';
import SharedRecipe from './pages/SharedRecipe';
import SharedCookbook from './pages/SharedCookbook';
import JoinHousehold from './pages/JoinHousehold';

import { PullToRefresh } from './components/PullToRefresh';
import { LoadingScreen } from './components/LoadingScreen';

function AppContent() {
  const { loading } = useAuth();

  // Remove initial splash screen once app is mounted
  useEffect(() => {
    const splash = document.getElementById('initial-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 500);
    }
  }, []);

  // iOS Zoom & Keyboard Fix
  useEffect(() => {
    // 1. Prevent Pinch-to-Zoom (iOS)
    const handleGestureStart = (e) => {
      e.preventDefault();
    };

    // 2. Force Scale Reset after Blur/Resize/Rotation
    const resetScale = () => {
      // Small timeout to let the browser finish its layout shift
      setTimeout(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          const originalContent = viewport.getAttribute('content');
          // Temporarily lock scale to 1.0
          viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
          setTimeout(() => {
            // Restore original but keep user-scalable=no if that was the goal
            // In our case, we want it fixed at 1.0/no-zoom normally.
            viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
          }, 100);
        }
      }, 100);
    };

    const handleFocusOut = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        resetScale();
      }
    };

    // Listen for zoom/resize events on visualViewport (iOS specific fix for rotation/keyboard)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resetScale);
    }

    document.addEventListener('gesturestart', handleGestureStart);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resetScale);
      }
    };
  }, []);

  return (
    <>
      <LoadingScreen isVisible={loading} message="EinkaufsApp wird geladen" />

      {!loading && (
        <PullToRefresh>
          <Router basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Public Shared Routes */}
              <Route path="/shared/:sharingKey/recipe/:id" element={<SharedRecipe />} />
              <Route path="/shared/:sharingKey/cookbook" element={<SharedCookbook />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/menu" element={
                <ProtectedRoute>
                  <Layout>
                    <MenuPlan />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/recipes" element={
                <ProtectedRoute>
                  <Layout>
                    <Recipes />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/lists" element={
                <ProtectedRoute>
                  <Layout>
                    <Lists />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/lists/:id" element={
                <ProtectedRoute>
                  <Layout>
                    <ListDetail />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/products" element={
                <ProtectedRoute>
                  <Layout>
                    <Products />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout>
                    <SettingsPage />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/join-household" element={
                <ProtectedRoute>
                  <JoinHousehold />
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </PullToRefresh>
      )}
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <EditModeProvider>
        <AuthProvider>
          <SyncProvider>
            <AppContent />
          </SyncProvider>
        </AuthProvider>
      </EditModeProvider>
    </ThemeProvider>
  );
}

export default App;
