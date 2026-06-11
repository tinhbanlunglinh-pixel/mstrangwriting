import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill process for libraries that expect it (like some AI SDKs)
if (typeof window !== 'undefined') {
  window.process = window.process || { env: {} } as any;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
