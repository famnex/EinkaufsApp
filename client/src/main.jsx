import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const startTime = Date.now();
const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Remove splash screen after min 1 second
window.addEventListener('load', () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 1000 - elapsed);

    setTimeout(() => {
      splash.classList.add('hidden');
      setTimeout(() => splash.remove(), 500); // Remove from DOM after fade out
    }, remaining);
  }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = import.meta.env.BASE_URL ? `${import.meta.env.BASE_URL}sw.js`.replace('//', '/') : '/sw.js';
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration);
      })
      .catch((error) => {
        console.log('[PWA] Service Worker registration failed:', error);
      });
  });
}
