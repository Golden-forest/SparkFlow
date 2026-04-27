#!/usr/bin/env node

/**
 * Task 1.2 验证脚本 - 验证加速度初始化
 *
 * 测试内容:
 * 1. 验证updatePositions()方法中是否初始化加速度
 * 2. 验证加速度值是否为(0, -9.8, 0)
 * 3. 验证EARTH_GRAVITY常量导入是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Task 1.2 验证 - 加速度初始化\n');

// 读取PhysicsEngine.ts文件
const physicsEnginePath = path.join(__dirname, 'src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts');

if (!fs.existsSync(physicsEnginePath)) {
  console.error('❌ PhysicsEngine.ts 文件不存在');
  process.exit(1);
}

const content = fs.readFileSync(physicsEnginePath, 'utf-8');

// 验证1: 检查是否导入了EARTH_GRAVITY
const hasGravityImport = content.includes("import { EARTH_GRAVITY } from '@/utils/constants'");
console.log(`✓ EARTH_GRAVITY导入: ${hasGravityImport ? '✅ 通过' : '❌ 失败'}`);

// 验证2: 检查updatePositions方法中是否有acceleration初始化
const hasAccelerationInit = content.includes('obj.acceleration.set(0, -EARTH_GRAVITY, 0)');
console.log(`✓ 加速度初始化代码: ${hasAccelerationInit ? '✅ 通过' : '❌ 失败'}`);

// 验证3: 检查注释是否存在
const hasComment = content.includes('// 初始化加速度（重力加速度）');
console.log(`✓ 中文注释: ${hasComment ? '✅ 通过' : '❌ 失败'}`);

// 验证4: 检查代码位置（应该在forEach循环内，velocity更新之前）
const forEachMatch = content.match(/objects\.forEach\(obj => \{([^}]+)\}/);
if (forEachMatch) {
  const forEachBody = forEachMatch[1];
  const lines = forEachBody.trim().split('\n');

  let accelerationLine = -1;
  let velocityLine = -1;

  lines.forEach((line, index) => {
    if (line.includes('acceleration.set')) accelerationLine = index;
    if (line.includes('velocity.y -=')) velocityLine = index;
  });

  const correctOrder = accelerationLine >= 0 && velocityLine >= 0 && accelerationLine < velocityLine;
  console.log(`✓ 代码顺序正确: ${correctOrder ? '✅ 通过' : '❌ 失败'}`);

  if (correctOrder) {
    console.log(`  - 加速度初始化在第 ${accelerationLine + 1} 行`);
    console.log(`  - 速度更新在第 ${velocityLine + 1} 行`);
  }
} else {
  console.log('❌ 无法找到forEach循环');
}

// 验证5: 提取并显示添加的代码
const accelerationMatch = content.match(/\/\/ 初始化加速度（重力加速度）\s+obj\.acceleration\.set\(0, -EARTH_GRAVITY, 0\);/);
if (accelerationMatch) {
  console.log('\n📝 添加的代码:');
  console.log('```typescript');
  console.log(accelerationMatch[0]);
  console.log('```');
}

// 总结
console.log('\n' + '='.repeat(50));
const allPassed = hasGravityImport && hasAccelerationInit && hasComment;
console.log(`\n${allPassed ? '✅ 所有验证通过' : '❌ 部分验证失败'}`);
console.log('\nTask 1.2 实现总结:');
console.log('- 文件: src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts');
console.log('- 方法: updatePositions()');
console.log('- 修改: 在forEach循环开始处添加加速度初始化');
console.log('- 代码行数: +2行(注释 + 赋值语句)');
console.log('- 依赖: Task 1.1已添加acceleration到SimulationObject接口');
console.log('\n下一步: Task 1.3 - 处理碰撞时的加速度变化');
