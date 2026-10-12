import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import './styles.css';
import { initDatabase } from './db';
import { AppProvider } from './store';
import { App } from './App';

registerSW({ immediate: true });

initDatabase()
  .catch((e) => console.error('init failed', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppProvider>
          <App />
        </AppProvider>
      </StrictMode>
    );
  });
