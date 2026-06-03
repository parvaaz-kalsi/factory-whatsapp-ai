import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global fetch interceptor to route /api and /audio requests to the deployed backend
const originalFetch = window.fetch;
window.fetch = async function () {
  let [resource, config] = arguments;
  if (typeof resource === 'string' && (resource.startsWith('/api') || resource.startsWith('/audio'))) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    resource = backendUrl + resource;
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
