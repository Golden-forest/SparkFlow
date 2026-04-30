import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ExperimentView from './pages/ExperimentView';
import MacroExperimentView from './pages/MacroExperimentView';
import HydrogenAbstractView from './pages/HydrogenAbstractView';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/experiment/rutherford-scattering" element={<MacroExperimentView />} />
        <Route path="/experiment/:experimentId/micro" element={<ExperimentView />} />
        <Route path="/experiment/rutherford-scattering/device" element={<MacroExperimentView />} />
        <Route path="/experiment/hydrogen-transitions/abstract" element={<HydrogenAbstractView />} />
        <Route path="/experiment/solar-system/satellite" element={<ExperimentView />} />
        <Route path="/experiment/:experimentId" element={<ExperimentView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
