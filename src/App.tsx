import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/platform/ErrorBoundary';
import { LoadingPage, NotFoundPage } from '@/platform/StatusPage';
import './index.css';

const Home = lazy(() => import('./pages/Home'));
const ExperimentView = lazy(() => import('./pages/ExperimentView'));
const MacroExperimentView = lazy(() => import('./pages/MacroExperimentView'));
const HydrogenAbstractView = lazy(() => import('./pages/HydrogenAbstractView'));
const AccountRoutes = lazy(() => import('./platform/account/AccountRoutes'));

function AppRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/account/*" element={<AccountRoutes />} />
        <Route path="/experiment/rutherford-scattering" element={<MacroExperimentView />} />
        <Route path="/experiment/:experimentId/micro" element={<ExperimentView />} />
        <Route path="/experiment/rutherford-scattering/device" element={<MacroExperimentView />} />
        <Route path="/experiment/hydrogen-transitions/abstract" element={<HydrogenAbstractView />} />
        <Route path="/experiment/solar-system/satellite" element={<ExperimentView />} />
        <Route path="/experiment/:experimentId" element={<ExperimentView />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
