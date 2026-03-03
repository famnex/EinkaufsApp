import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const startTime = Date.now();
const root = createRoot(document.getElementById('root'));

root.render(
  <App />
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


