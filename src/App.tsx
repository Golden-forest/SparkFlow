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
        {/* 卢瑟福散射实验 - 宏观装置视图 */}
        <Route path="/experiment/rutherford-scattering" element={<MacroExperimentView />} />
        {/* 卢瑟福散射实验 - 微观原子视图 */}
        <Route path="/experiment/rutherford-scattering/micro" element={<ExperimentView />} />
        {/* 氢原子实验 - 抽象能级视图 */}
        <Route path="/experiment/hydrogen-transitions/abstract" element={<HydrogenAbstractView />} />
        {/* 天体运动实验 - 卫星视图 */}
        <Route path="/experiment/solar-system/satellite" element={<ExperimentView />} />
        {/* 其他实验 - 通用路由 */}
        <Route path="/experiment/:experimentId" element={<ExperimentView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
