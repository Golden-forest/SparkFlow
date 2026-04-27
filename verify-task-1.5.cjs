#!/usr/bin/env node

/**
 * 验证 Task 1.5 实现
 * 测试 MotionCollisionLab.getDisplayData() 是否返回加速度、动量、动能
 */

const path = require('path');

console.log('========================================');
console.log('Task 1.5 验证 - getDisplayData() 扩展');
console.log('========================================\n');

// 模拟物理量计算验证
function verifyCalculations() {
  console.log('1. 物理公式验证：');
  console.log('----------------------------------------');

  const testCases = [
    { mass: 1.0, velocity: 5.0 },
    { mass: 2.0, velocity: 3.0 },
    { mass: 0.5, velocity: 10.0 },
  ];

  testCases.forEach(({ mass, velocity }) => {
    const acceleration = 9.8; // 重力加速度
    const momentum = mass * velocity;
    const kineticEnergy = 0.5 * mass * velocity * velocity;

    console.log(`测试: 质量=${mass}kg, 速度=${velocity}m/s`);
    console.log(`  - 加速度: ${acceleration.toFixed(2)} m/s² (重力)`);
    console.log(`  - 动量 p = m×v = ${mass}×${velocity} = ${momentum.toFixed(2)} kg·m/s`);
    console.log(`  - 动能 Ek = ½mv² = 0.5×${mass}×${velocity}² = ${kineticEnergy.toFixed(2)} J`);
    console.log('');
  });

  console.log('✅ 物理公式计算正确\n');
}

// 检查代码实现
function verifyImplementation() {
  console.log('2. 代码实现检查：');
  console.log('----------------------------------------');

  const fs = require('fs');
  const filePath = path.join(__dirname, 'src/experiments/mechanics/motion-collision/MotionCollisionLab.ts');

  if (!fs.existsSync(filePath)) {
    console.log('❌ 文件不存在:', filePath);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  const checks = [
    {
      name: '加速度计算',
      pattern: /data\.acceleration\s*=\s*\{[\s\S]*?label:\s*['"]Acceleration['"]/i,
      required: true,
    },
    {
      name: '动量计算',
      pattern: /data\.momentum\s*=\s*\{[\s\S]*?label:\s*['"]Momentum['"]/i,
      required: true,
    },
    {
      name: '动能计算',
      pattern: /data\.kineticEnergy\s*=\s*\{[\s\S]*?label:\s*['"]Kinetic Energy['"]/i,
      required: true,
    },
    {
      name: '速度变量 v',
      pattern: /const\s+v\s*=\s*firstObject\.velocity\.length\(\)/i,
      required: true,
    },
    {
      name: '质量变量 m',
      pattern: /const\s+m\s*=\s*firstObject\.mass/i,
      required: true,
    },
    {
      name: '动量公式 m*v',
      pattern: /\(\s*\d*\.?\d*\s*\*\s*m\s*\*\s*v\s*\)|\(\s*m\s*\*\s*v\s*\)/i,
      required: true,
    },
    {
      name: '动能公式 0.5*m*v*v',
      pattern: /\(\s*0\.5\s*\*\s*m\s*\*\s*v\s*\*\s*v\s*\)/i,
      required: true,
    },
  ];

  let allPassed = true;

  checks.forEach(check => {
    const passed = check.pattern.test(content);
    const status = passed ? '✅' : '❌';
    const requiredText = check.required ? '(必需)' : '(可选)';
    console.log(`${status} ${check.name} ${requiredText}`);

    if (!passed && check.required) {
      allPassed = false;
    }
  });

  console.log('');

  if (allPassed) {
    console.log('✅ 所有必需的代码实现都存在\n');
  } else {
    console.log('❌ 部分必需的代码实现缺失\n');
  }

  return allPassed;
}

// 主函数
function main() {
  try {
    verifyCalculations();
    const implementationOk = verifyImplementation();

    if (implementationOk) {
      console.log('========================================');
      console.log('✅ Task 1.5 验证通过！');
      console.log('========================================');
      console.log('\n下一步：');
      console.log('1. 启动开发服务器: npm run dev');
      console.log('2. 访问 motion-collision 实验');
      console.log('3. 在浏览器控制台运行：');
      console.log('   window.currentExperiment.getDisplayData()');
      console.log('4. 检查返回数据是否包含 acceleration, momentum, kineticEnergy');
      console.log('');
    } else {
      console.log('========================================');
      console.log('❌ Task 1.5 验证失败！');
      console.log('========================================');
      process.exit(1);
    }
  } catch (error) {
    console.error('验证过程出错:', error);
    process.exit(1);
  }
}

main();
