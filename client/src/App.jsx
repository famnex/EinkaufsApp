import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from './lib/axios';
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
import LandingPage from './pages/LandingPage';
import PublicCookbooks from './pages/PublicCookbooks';
import CommunityCookbooksContent from './components/CommunityCookbooksContent';
import LegalPage from './pages/LegalPage';

import { PullToRefresh } from './components/PullToRefresh';
import { LoadingScreen } from './components/LoadingScreen';

// Helper to convert hex to HSL for Tailwind variables
const hexToHsl = (hex) => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

const applyThemeColor = (type, hexColor) => {
  if (!hexColor) return;
  try {
    const hsl = hexToHsl(hexColor);
    const root = document.documentElement;
    const hslString = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
    const hslForeground = `${hsl.h} ${hsl.s}% ${hsl.l > 60 ? '5%' : '98%'}`;

    if (type === 'accent') {
      root.style.setProperty('--primary', hslString);
      root.style.setProperty('--primary-foreground', hslForeground);
      root.style.setProperty('--accent', hslString);
      root.style.setProperty('--ring', hslString);
      root.style.setProperty('--ref-teal', hexColor);
    } else if (type === 'secondary') {
      root.style.setProperty('--secondary', hslString);
      root.style.setProperty('--secondary-foreground', hslForeground);
      root.style.setProperty('--destructive', hslString); // Often used for "important/pending"
      root.style.setProperty('--ref-red', hexColor);
    }
  } catch (err) {
    console.error(`Failed to apply ${type} theme color:`, err);
  }
};

function AppContent() {
  const { loading, user } = useAuth();

  // Fetch and apply system settings (Accent & Secondary Color)
  useEffect(() => {
    const fetchSettings = async () => {
      // 1. Try to load from localStorage first for immediate results
      try {
        const cached = localStorage.getItem('system_settings_cache');
        if (cached) {
          const data = JSON.parse(cached);
          if (data.system_accent_color) applyThemeColor('accent', data.system_accent_color);
          if (data.system_secondary_color) applyThemeColor('secondary', data.system_secondary_color);
        }
      } catch (e) {
        console.warn('Failed to load cached settings', e);
      }

      // 2. Fetch fresh data from server
      try {
        const { data } = await axios.get(`/system/settings?t=${Date.now()}`);

        // Update Cache
        localStorage.setItem('system_settings_cache', JSON.stringify(data));

        // Apply if different (applyThemeColor handles idempotent calls efficiently enough)
        if (data.system_accent_color) {
          console.log('App: Applying accent color from server:', data.system_accent_color);
          applyThemeColor('accent', data.system_accent_color);
        }
        if (data.system_secondary_color) {
          console.log('App: Applying secondary color from server:', data.system_secondary_color);
          applyThemeColor('secondary', data.system_secondary_color);
        }
      } catch (err) {
        console.error('System settings could not be loaded - defaults/cache will be used', err);
      }
    };

    fetchSettings();
  }, [user]); // Re-run when user auth state changes

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

    // 2. Optimized Scale Reset (fixes flickering on scroll)
    let resetTimeout;
    let lastWidth = window.innerWidth;
    const resetScale = () => {
      clearTimeout(resetTimeout);

      const viewport = window.visualViewport;
      const currentWidth = window.innerWidth;
      const isOrientationChange = Math.abs(currentWidth - lastWidth) > 50;

      // Only reset if zoomed in, OR if orientation changed, OR if an input was just blurred
      // This prevents the flickering during normal scrolling where the address bar hides/shows
      if (viewport && (viewport.scale !== 1.0 || isOrientationChange)) {
        resetTimeout = setTimeout(() => {
          const metaViewport = document.querySelector('meta[name="viewport"]');
          if (metaViewport) {
            // "The Reset Trick": Temporarily change content to force browser to recalculate scale
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
            setTimeout(() => {
              metaViewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
              lastWidth = window.innerWidth;
            }, 50);
          }
        }, 150); // Debounce to allow scroll/resize to settle
      }
    };

    const handleFocusOut = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        // Delay reset slightly after blur to ensure keyboard dismissal layout is stable
        setTimeout(resetScale, 50);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resetScale);
    }

    document.addEventListener('gesturestart', handleGestureStart);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      clearTimeout(resetTimeout);
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resetScale);
      }
    };
  }, []);

  return (
    <>
      <LoadingScreen isVisible={loading} message="GabelGuru wird geladen" />

      {!loading && (
        <PullToRefresh>
          <Router basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Public Shared Routes */}
              <Route path="/shared/:sharingKey/recipe/:id" element={<SharedRecipe />} />
              <Route path="/shared/:sharingKey/cookbook" element={<SharedCookbook />} />

              <Route path="/community-cookbooks" element={
                user ? (
                  <ProtectedRoute>
                    <Layout>
                      <CommunityCookbooksContent />
                    </Layout>
                  </ProtectedRoute>
                ) : (
                  <PublicCookbooks />
                )
              } />
              <Route path="/privacy" element={<LegalPage type="privacy" />} />
              <Route path="/imprint" element={<LegalPage type="imprint" />} />

              <Route path="/" element={
                user ? (
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                ) : (
                  <LandingPage />
                )
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
