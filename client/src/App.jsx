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

  // iOS Zoom Fix
  useEffect(() => {
    const handleFocusOut = (e) => {
      const { tagName } = e.target;
      if (['INPUT', 'TEXTAREA'].includes(tagName)) {
        setTimeout(() => {
          const activeElement = document.activeElement;
          const isInput =
            activeElement &&
            (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) ||
              activeElement.isContentEditable);

          if (!isInput) {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
              const originalContent = viewport.getAttribute('content');
              viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
              setTimeout(() => {
                if (viewport.getAttribute('content') !== originalContent) {
                  viewport.setAttribute('content', originalContent);
                }
              }, 100);
            }
          }
        }, 50);
      }
    };

    document.addEventListener('focusout', handleFocusOut);
    return () => document.removeEventListener('focusout', handleFocusOut);
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
              <Route path="/shared/recipe/:id" element={<SharedRecipe />} />

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
