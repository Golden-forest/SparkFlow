/**
 * 视图切换功能验证脚本
 *
 * 这个脚本验证 Task 3.2 实现的视图切换逻辑
 *
 * 使用方法:
 * 1. 启动应用: npm run dev
 * 2. 打开浏览器开发者工具控制台
 * 3. 在天体运动实验页面运行以下代码
 */

// 验证步骤
console.log('=== 视图切换功能验证 ===');

// 1. 获取实验实例
const getSolarSystemInstance = () => {
    // 从全局状态或 React 组件树中获取 SolarSystem 实例
    // 这需要根据实际的应用架构来调整
    console.log('提示: 需要手动获取 SolarSystem 实例');
};

// 2. 测试太阳系视图
const testSolarView = (experiment) => {
    console.log('\n测试太阳系视图...');
    experiment.switchViewMode('solar');

    // 验证所有行星可见
    const planets = experiment.planets;
    const satellites = experiment.satellites;

    const allPlanetsVisible = planets.every(p => p.getMesh().visible === true);
    const allSatellitesHidden = satellites.every(s => s.getMesh().visible === false);

    console.log(`✓ 所有行星可见: ${allPlanetsVisible}`);
    console.log(`✓ 所有卫星隐藏: ${allSatellitesHidden}`);
    console.log(`✓ 当前视图模式: ${experiment.currentViewMode}`);

    return allPlanetsVisible && allSatellitesHidden;
};

// 3. 测试卫星视图
const testSatelliteView = (experiment) => {
    console.log('\n测试卫星视图...');
    experiment.switchViewMode('satellite');

    const planets = experiment.planets;
    const satellites = experiment.satellites;

    const onlyEarthVisible = planets.filter(p => p.getMesh().visible).length === 1 &&
                            planets.find(p => p.getName() === '地球').getMesh().visible === true;
    const allSatellitesVisible = satellites.every(s => s.getMesh().visible === true);

    console.log(`✓ 只有地球可见: ${onlyEarthVisible}`);
    console.log(`✓ 所有卫星可见: ${allSatellitesVisible}`);
    console.log(`✓ 当前视图模式: ${experiment.currentViewMode}`);

    return onlyEarthVisible && allSatellitesVisible;
};

// 4. 测试轨道显示控制
const testOrbitToggle = (experiment) => {
    console.log('\n测试轨道显示控制...');

    // 关闭轨道
    experiment.onParameterChange('showOrbits', false);
    const allOrbitsHidden = [...experiment.planets, ...experiment.satellites]
        .filter(obj => obj.getMesh().visible)
        .every(obj => obj.getOrbitLine().visible === false);

    // 开启轨道
    experiment.onParameterChange('showOrbits', true);
    const allVisibleOrbitsShown = [...experiment.planets, ...experiment.satellites]
        .filter(obj => obj.getMesh().visible)
        .every(obj => obj.getOrbitLine().visible === true);

    console.log(`✓ 轨道隐藏功能: ${allOrbitsHidden}`);
    console.log(`✓ 轨道显示功能: ${allVisibleOrbitsShown}`);
    console.log(`✓ showOrbits 状态: ${experiment.showOrbits}`);

    return allOrbitsHidden && allVisibleOrbitsShown;
};

// 5. 测试状态同步
const testStateSync = (experiment) => {
    console.log('\n测试状态同步...');

    // 在卫星视图中切换轨道显示
    experiment.switchViewMode('satellite');
    experiment.onParameterChange('showOrbits', false);

    const earth = experiment.planets.find(p => p.getName() === '地球');
    const earthOrbitHidden = !earth.getOrbitLine().visible;
    const satellitesOrbitsHidden = experiment.satellites.every(s => !s.getOrbitLine().visible);

    experiment.onParameterChange('showOrbits', true);
    const earthOrbitShown = earth.getOrbitLine().visible;
    const satellitesOrbitsShown = experiment.satellites.every(s => s.getOrbitLine().visible);

    console.log(`✓ 卫星视图中轨道隐藏: ${earthOrbitHidden && satellitesOrbitsHidden}`);
    console.log(`✓ 卫星视图中轨道显示: ${earthOrbitShown && satellitesOrbitsShown}`);

    return earthOrbitHidden && satellitesOrbitsHidden && earthOrbitShown && satellitesOrbitsShown;
};

// 6. 测试防重复切换
const testDuplicateSwitch = (experiment) => {
    console.log('\n测试防重复切换...');

    experiment.switchViewMode('solar');
    const beforeState = experiment.currentViewMode;

    // 再次切换到同一模式
    experiment.switchViewMode('solar');
    const afterState = experiment.currentViewMode;

    console.log(`✓ 防重复切换: ${beforeState === afterState && beforeState === 'solar'}`);

    return beforeState === afterState;
};

// 主测试函数
const runAllTests = (experiment) => {
    console.log('开始运行所有测试...\n');

    const results = {
        solarView: testSolarView(experiment),
        satelliteView: testSatelliteView(experiment),
        orbitToggle: testOrbitToggle(experiment),
        stateSync: testStateSync(experiment),
        duplicateSwitch: testDuplicateSwitch(experiment)
    };

    console.log('\n=== 测试结果汇总 ===');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${test}: ${passed ? '✓ 通过' : '✗ 失败'}`);
    });

    const allPassed = Object.values(results).every(r => r === true);
    console.log(`\n总体结果: ${allPassed ? '✓ 所有测试通过' : '✗ 部分测试失败'}`);

    return allPassed;
};

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testSolarView,
        testSatelliteView,
        testOrbitToggle,
        testStateSync,
        testDuplicateSwitch,
        runAllTests
    };
}

// 使用示例:
// 1. 在浏览器控制台中获取 SolarSystem 实例
// 2. 运行: runAllTests(experimentInstance)
