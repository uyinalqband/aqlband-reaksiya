import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/i18n';
import '@/styles/index.css';
import App from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { checkpoint } from '@/lib/debug';

checkpoint('main-tsx-start');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element (#root) was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

checkpoint('main-tsx-render-called');
