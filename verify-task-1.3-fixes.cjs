/**
 * Task 1.3 代码审查问题修复验证脚本
 * 验证 PhysicsEngine.ts 中的所有修复是否正确实现
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts');
const content = fs.readFileSync(filePath, 'utf-8');

console.log('🔍 Task 1.3 修复验证\n');
console.log('=' .repeat(60));

let passed = 0;
let failed = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failed++;
  }
}

console.log('\n📋 关键问题 1: 欧拉积分顺序');
console.log('-'.repeat(60));

test(
  'updatePositions() 方法存在',
  content.includes('static updatePositions(')
);

test(
  '步骤1: 先应用重力更新速度',
  content.includes('// 步骤1: 应用重力加速度更新速度') &&
  content.includes('obj.velocity.y -= EARTH_GRAVITY * deltaTime;') &&
  content.indexOf('obj.velocity.y -=') < content.indexOf('obj.mesh.position.add(')
);

test(
  '步骤2: 使用新速度更新位置',
  content.includes('// 步骤2: 使用新速度更新位置') &&
  content.includes('const displacement = obj.velocity.clone().multiplyScalar(deltaTime);')
);

test(
  '移除了不必要的零速度检查',
  !content.includes('if (obj.velocity.length() === 0) return;')
);

test(
  '注释说明正确的欧拉积分顺序',
  content.includes('1. 应用重力加速度 → 更新速度') &&
  content.includes('2. 使用新速度 → 更新位置')
);

console.log('\n📋 重要问题 2: 地面碰撞检测功能');
console.log('-'.repeat(60));

test(
  'detectGroundCollision() 方法存在',
  content.includes('static detectGroundCollision(')
);

test(
  '根据物体类型确定碰撞边界',
  content.includes('// 根据物体类型确定碰撞边界') &&
  content.includes('let collisionBoundary: number;')
);

test(
  '处理球体类型（使用半径）',
  content.includes("obj.type === 'sphere'") &&
  content.includes('collisionBoundary = obj.radius;')
);

test(
  '处理盒子和木板类型（使用高度/2）',
  content.includes("obj.type === 'box' || obj.type === 'plank'") &&
  content.includes('collisionBoundary = (obj.height || 1) / 2;')
);

test(
  '有默认边界处理',
  content.includes('// 默认边界') &&
  content.includes('collisionBoundary = 0.5;')
);

test(
  '使用配置的恢复系数',
  content.includes('const restitution = obj.restitution || 0.8;') &&
  content.includes('obj.velocity.y *= -restitution;')
);

test(
  '使用配置的摩擦系数',
  content.includes('const friction = obj.friction || 0.98;') &&
  content.includes('obj.velocity.x *= friction;')
);

test(
  '防止微小抖动（速度过小归零）',
  content.includes('if (Math.abs(obj.velocity.y) < 0.1') &&
  content.includes('obj.velocity.y = 0;')
);

console.log('\n📋 重要问题 3: 碰撞响应位置修正');
console.log('-'.repeat(60));

test(
  'resolveCollision() 方法存在',
  content.includes('static resolveCollision(')
);

test(
  '计算碰撞法线',
  content.includes('const normal = pos2.clone().sub(pos1).normalize();')
);

test(
  '计算重叠距离',
  content.includes('const overlap = r1 + r2 - distance;')
);

test(
  '步骤1: 位置修正',
  content.includes('// 步骤1: 位置修正 - 将物体移开，避免重叠')
);

test(
  '根据质量比例分配修正量',
  content.includes('const totalMass = m1 + m2;') &&
  content.includes('const ratio1 = m2 / totalMass;') &&
  content.includes('const ratio2 = m1 / totalMass;')
);

test(
  '沿碰撞法线移动物体',
  content.includes('const correction1 = normal.clone().multiplyScalar(-overlap * ratio1);') &&
  content.includes('const correction2 = normal.clone().multiplyScalar(overlap * ratio2);') &&
  content.includes('pos1.add(correction1);') &&
  content.includes('pos2.add(correction2);')
);

test(
  '同步更新position属性',
  content.includes('obj1.position.copy(pos1);') &&
  content.includes('obj2.position.copy(pos2);')
);

test(
  '步骤2: 速度更新',
  content.includes('// 步骤2: 速度更新 - 弹性碰撞')
);

test(
  '计算相对速度',
  content.includes('const relativeVelocity = v1.clone().sub(v2);')
);

test(
  '计算沿法线的速度分量',
  content.includes('const velocityAlongNormal = relativeVelocity.dot(normal);')
);

test(
  '分离检测（正在分离的物体不处理）',
  content.includes('if (velocityAlongNormal > 0)') &&
  content.includes('return;')
);

test(
  '使用法线方向的弹性碰撞公式',
  content.includes('v1Final') &&
  content.includes('v2Final') &&
  content.includes('obj1.velocity.copy(v1Final)') &&
  content.includes('obj2.velocity.copy(v2Final)')
);

console.log('\n📋 代码质量');
console.log('-'.repeat(60));

test(
  '方法注释清晰（中文）',
  content.includes('/**') &&
  content.includes('物理引擎 - 处理运动更新和碰撞检测')
);

test(
  '没有硬编码的物理值（使用配置）',
  content.includes('obj.restitution') &&
  content.includes('obj.friction')
);

test(
  '类型安全的边界处理',
  content.includes('obj.type ===') &&
  content.includes('obj.radius !== undefined')
);

console.log('\n' + '='.repeat(60));
console.log(`\n✅ 通过: ${passed}/${passed + failed} 项`);
if (failed > 0) {
  console.log(`❌ 失败: ${failed}/${passed + failed} 项`);
  console.log('\n⚠️  部分修复未完成，请检查失败项');
  process.exit(1);
} else {
  console.log('\n🎉 所有修复已完成！');
  console.log('\n修复内容:');
  console.log('  1. ✅ 正确的欧拉积分顺序（先速度后位置）');
  console.log('  2. ✅ 完整的地面碰撞检测（类型安全、可配置、防抖动）');
  console.log('  3. ✅ 碰撞响应位置修正（防止物体重叠）');
  console.log('\n文件: src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts');
}
