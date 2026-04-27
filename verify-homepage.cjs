#!/usr/bin/env node

/**
 * Task 5.2 验证脚本
 *
 * 验证首页实验卡片更新是否成功
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('Task 5.2: 首页实验卡片更新验证');
console.log('='.repeat(80));
console.log();

// 1. 验证 mechanics/index.ts
console.log('1. 检查 /Users/hl/Projects/atomic_physics/src/experiments/mechanics/index.ts');
const mechanicsIndex = fs.readFileSync(
    '/Users/hl/Projects/atomic_physics/src/experiments/mechanics/index.ts',
    'utf-8'
);

const removedExperiments = [
    'projectile-motion',
    'circular-motion',
    'simple-harmonic-motion',
    'collision'
];

const addedExperiments = [
    { name: 'Pendulum', id: 'pendulum' },
    { name: 'MotionCollisionLab', id: 'motion-collision' }
];

let allRemoved = true;
removedExperiments.forEach(exp => {
    if (mechanicsIndex.includes(exp)) {
        console.log(`   ❌ 旧实验 "${exp}" 仍然存在`);
        allRemoved = false;
    } else {
        console.log(`   ✅ 旧实验 "${exp}" 已移除`);
    }
});

let allAdded = true;
addedExperiments.forEach(exp => {
    if (mechanicsIndex.includes(`export { ${exp.name} }`)) {
        console.log(`   ✅ 新实验 "${exp.name}" 已添加`);
    } else {
        console.log(`   ❌ 新实验 "${exp.name}" 未找到`);
        allAdded = false;
    }
});

console.log();

// 2. 验证 Home.tsx
console.log('2. 检查 /Users/hl/Projects/atomic_physics/src/pages/Home.tsx');
const homeContent = fs.readFileSync(
    '/Users/hl/Projects/atomic_physics/src/pages/Home.tsx',
    'utf-8'
);

// 检查旧图表是否移除
const oldDiagrams = [
    'ProjectileMotionDiagram',
    'CircularMotionDiagram',
    'SHMDiagram',
    'CollisionDiagram'
];

oldDiagrams.forEach(diagram => {
    if (homeContent.includes(diagram)) {
        console.log(`   ❌ 旧图表组件 "${diagram}" 仍然存在`);
    } else {
        console.log(`   ✅ 旧图表组件 "${diagram}" 已移除`);
    }
});

// 检查新图表是否添加
const newDiagrams = [
    'PendulumDiagram',
    'MotionCollisionDiagram'
];

newDiagrams.forEach(diagram => {
    if (homeContent.includes(diagram)) {
        console.log(`   ✅ 新图表组件 "${diagram}" 已添加`);
    } else {
        console.log(`   ❌ 新图表组件 "${diagram}" 未找到`);
    }
});

console.log();

// 3. 验证实验列表
console.log('3. 检查实验列表');

// 提取实验列表
const experimentsMatch = homeContent.match(/const experiments: ExperimentCard\[] = \[(.*?)\];/s);
if (experimentsMatch) {
    const experimentsList = experimentsMatch[1];
    const experiments = experimentsList.match(/\{[^}]+\}/g);

    console.log(`   找到 ${experiments.length} 个实验卡片：`);

    const expectedExperiments = [
        'hydrogen-transitions',
        'rutherford-scattering',
        'solar-system',
        'pendulum',
        'motion-collision'
    ];

    experiments.forEach(exp => {
        const idMatch = exp.match(/id: '([^']+)'/);
        if (idMatch) {
            const id = idMatch[1];
            if (expectedExperiments.includes(id)) {
                console.log(`   ✅ ${id}`);
            } else {
                console.log(`   ⚠️  ${id} (未在预期列表中)`);
            }
        }
    });

    console.log();

    // 检查是否所有预期实验都存在
    let allPresent = true;
    expectedExperiments.forEach(expId => {
        if (experimentsList.includes(`id: '${expId}'`)) {
            console.log(`   ✅ 预期实验 "${expId}" 存在`);
        } else {
            console.log(`   ❌ 预期实验 "${expId}" 缺失`);
            allPresent = false;
        }
    });

    // 检查是否没有旧实验
    removedExperiments.forEach(expId => {
        if (experimentsList.includes(`id: '${expId}'`)) {
            console.log(`   ❌ 旧实验 "${expId}" 仍然在列表中`);
        }
    });

} else {
    console.log('   ❌ 无法找到实验列表');
}

console.log();

// 4. 验证UI国际化
console.log('4. 检查UI国际化（英文）');

const chinesePattern = /[\u4e00-\u9fa5]/;
const hasChineseInTitles = chinesePattern.test(homeContent.match(/title: '([^']+)'/g)?.join('') || '');
const hasChineseInSubtitles = chinesePattern.test(homeContent.match(/subtitle: '([^']+)'/g)?.join('') || '');

if (!hasChineseInTitles && !hasChineseInSubtitles) {
    console.log('   ✅ 所有标题和副标题使用英文');
} else {
    console.log('   ❌ 发现中文字符');
}

console.log();

// 总结
console.log('='.repeat(80));
console.log('验证完成！');
console.log('='.repeat(80));

console.log('\n📋 修改摘要：');
console.log('   修改的文件：');
console.log('   - /Users/hl/Projects/atomic_physics/src/experiments/mechanics/index.ts');
console.log('   - /Users/hl/Projects/atomic_physics/src/pages/Home.tsx');

console.log('\n🗑️  移除的旧实验：');
removedExperiments.forEach(exp => console.log(`   - ${exp}`));

console.log('\n✨ 添加的新实验：');
addedExperiments.forEach(exp => console.log(`   - ${exp.id} (${exp.name})`));

console.log('\n🔗 实验路由：');
console.log('   - /experiment/pendulum');
console.log('   - /experiment/motion-collision');

console.log('\n📝 建议：');
console.log('   1. 访问 http://localhost:5173 查看首页');
console.log('   2. 点击新实验卡片验证路由是否正确');
console.log('   3. 检查实验页面是否正常加载');

console.log();
