import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/styles/experiment-2d.css'
import '@/i18n/config'
import App from './App.tsx'
import { ErrorBoundary } from '@/platform/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
