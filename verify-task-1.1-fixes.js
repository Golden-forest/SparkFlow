#!/usr/bin/env node

/**
 * Task 1.1 修复验证脚本
 *
 * 验证以下修复是否正确实施：
 * 1. 物理引擎逻辑 - 正确的欧拉积分顺序
 * 2. 类型安全的地面碰撞检测
 * 3. removeObject() 方法
 * 4. PhysicsObjectFactory.dispose() 调用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/experiments/mechanics/motion-collision/MotionCollisionLab.ts');

console.log('🔍 验证 Task 1.1 修复...\n');

const content = fs.readFileSync(filePath, 'utf-8');

let checks = {
  passed: 0,
  failed: 0,
  results: []
};

function check(name, condition, details) {
  if (condition) {
    checks.passed++;
    checks.results.push({ name, status: '✅ PASS', details });
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
  } else {
    checks.failed++;
    checks.results.push({ name, status: '❌ FAIL', details });
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
  console.log('');
}

// 1. 检查物理引擎逻辑 - 正确的欧拉积分顺序
console.log('📋 检查 1: 物理引擎逻辑 - 正确的欧拉积分顺序');
console.log('━'.repeat(60));

const updatePhysicsMatch = content.match(/private updatePhysics\(deltaTime: number\): void \{[\s\S]*?\n  \}/m);
check(
  'updatePhysics() 方法存在',
  !!updatePhysicsMatch,
  '找到方法定义'
);

if (updatePhysicsMatch) {
  const methodBody = updatePhysicsMatch[0];

  check(
    '步骤1: 先应用重力更新速度',
    methodBody.includes('obj.velocity.y -= EARTH_GRAVITY * deltaTime'),
    '在位置更新之前更新速度'
  );

  check(
    '步骤2: 使用新速度更新位置',
    methodBody.includes('obj.mesh.position.add(displacement)') &&
    methodBody.indexOf('velocity.y -=') < methodBody.indexOf('position.add'),
    '位置更新在速度更新之后'
  );

  check(
    '步骤3: 然后检测碰撞',
    methodBody.includes('handleGroundCollision'),
    '在更新位置后调用碰撞检测'
  );

  check(
    '正确的积分顺序注释',
    (methodBody.includes('1.') || methodBody.includes('步骤1')) &&
    (methodBody.includes('2.') || methodBody.includes('步骤2')) &&
    (methodBody.includes('3.') || methodBody.includes('步骤3')),
    '代码注释清晰说明了正确的欧拉积分顺序'
  );
}

// 2. 检查类型安全的地面碰撞检测
console.log('📋 检查 2: 类型安全的地面碰撞检测');
console.log('━'.repeat(60));

const handleCollisionMatch = content.match(/private handleGroundCollision[\s\S]*?\n  \}/m);
check(
  'handleGroundCollision() 方法存在',
  !!handleCollisionMatch,
  '找到独立的碰撞处理方法'
);

if (handleCollisionMatch) {
  const methodBody = handleCollisionMatch[0];

  check(
    '处理球体类型',
    methodBody.includes("obj.type === 'sphere'") &&
    methodBody.includes('obj.radius'),
    '球体使用半径作为碰撞边界'
  );

  check(
    '处理盒子和木板类型',
    methodBody.includes("obj.type === 'box' || obj.type === 'plank'") &&
    methodBody.includes('obj.height'),
    '盒子和木板使用高度作为碰撞边界'
  );

  check(
    '有默认边界处理',
    methodBody.includes('default') || methodBody.includes('else'),
    '提供默认的碰撞边界'
  );

  check(
    '使用配置的恢复系数',
    methodBody.includes('obj.restitution'),
    '从对象配置读取恢复系数'
  );

  check(
    '使用配置的摩擦系数',
    methodBody.includes('obj.friction'),
    '从对象配置读取摩擦系数'
  );

  check(
    '防止微小抖动',
    methodBody.includes('velocity.y = 0') && methodBody.includes('< 0.1'),
    '速度过小时归零，防止抖动'
  );
}

// 3. 检查 removeObject() 方法
console.log('📋 检查 3: removeObject() 方法');
console.log('━'.repeat(60));

const removeObjectMatch = content.match(/removeObject\(objectId: string\): boolean \{[\s\S]*?\n  \}/m);
check(
  'removeObject() 方法存在',
  !!removeObjectMatch,
  '找到对象移除方法'
);

if (removeObjectMatch) {
  const methodBody = removeObjectMatch[0];

  check(
    '从场景中移除网格',
    methodBody.includes('removeFromScene(obj.mesh)'),
    '正确从场景移除'
  );

  check(
    '清理几何体',
    methodBody.includes('geometry.dispose()'),
    '释放几何体内存'
  );

  check(
    '清理材质（支持数组）',
    methodBody.includes('Array.isArray') &&
    methodBody.includes('material.dispose()'),
    '正确处理单个和数组材质'
  );

  check(
    '从映射中移除',
    methodBody.includes('simulationObjects.delete'),
    '从仿真对象映射中移除'
  );

  check(
    '返回布尔值',
    methodBody.includes('return true') && methodBody.includes('return false'),
    '返回操作成功状态'
  );
}

// 4. 检查 PhysicsObjectFactory.dispose() 调用
console.log('📋 检查 4: PhysicsObjectFactory.dispose() 调用');
console.log('━'.repeat(60));

const disposeMatch = content.match(/dispose\(\): void \{[\s\S]*?\n  \}/m);
check(
  'dispose() 方法存在',
  !!disposeMatch,
  '找到清理方法'
);

if (disposeMatch) {
  const methodBody = disposeMatch[0];

  check(
    '调用 PhysicsObjectFactory.dispose()',
    methodBody.includes('PhysicsObjectFactory.dispose()'),
    '清理工厂的共享材质'
  );

  check(
    '在清理对象之后调用',
    methodBody.indexOf('PhysicsObjectFactory.dispose()') >
    methodBody.indexOf('simulationObjects.forEach'),
    '先清理对象，再清理工厂'
  );
}

// 5. 代码质量检查
console.log('📋 检查 5: 代码质量');
console.log('━'.repeat(60));

check(
  '方法注释清晰',
  content.includes('正确的欧拉积分顺序') &&
  content.includes('正确处理不同物体类型') &&
  content.includes('正确清理网格、几何体和材质'),
  '所有方法都有清晰的中文注释'
);

check(
  '没有硬编码的物理值',
  !content.match(/obj\.velocity\.y \*= -0\.8(?!\n)/) &&
  !content.match(/const friction = 0\.98(?!\n)/),
  '使用对象配置的物理属性，避免硬编码'
);

check(
  '类型安全的材质清理',
  content.includes('Array.isArray(obj.mesh.material)'),
  '正确处理材质数组情况'
);

// 总结
console.log('━'.repeat(60));
console.log('📊 验证总结');
console.log('━'.repeat(60));
console.log(`总计: ${checks.passed + checks.failed} 项`);
console.log(`✅ 通过: ${checks.passed}`);
console.log(`❌ 失败: ${checks.failed}`);

if (checks.failed === 0) {
  console.log('\n🎉 所有检查通过！Task 1.1 修复完成。');
  process.exit(0);
} else {
  console.log('\n⚠️  部分检查失败，请查看上方详情。');
  process.exit(1);
}
