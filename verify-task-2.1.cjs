#!/usr/bin/env node

/**
 * Task 2.1 验证脚本
 * 验证 TabPanel 和 ControlTab 组件是否正确实现
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证 Task 2.1: 创建右侧Tab控制面板组件\n');

const checks = [];

// 检查 1: TabPanel.tsx 文件存在
const tabPanelPath = path.join(__dirname, 'src/components/experiment/TabPanel.tsx');
checks.push({
  name: 'TabPanel.tsx 文件存在',
  pass: fs.existsSync(tabPanelPath)
});

// 检查 2: ControlTab.tsx 文件存在
const controlTabPath = path.join(__dirname, 'src/components/experiment/ControlTab.tsx');
checks.push({
  name: 'ControlTab.tsx 文件存在',
  pass: fs.existsSync(controlTabPath)
});

// 检查 3: index.ts 导出文件存在
const indexPath = path.join(__dirname, 'src/components/experiment/index.ts');
checks.push({
  name: 'index.ts 导出文件存在',
  pass: fs.existsSync(indexPath)
});

// 检查 4: TabPanel 包含必需的导入
if (checks[0].pass) {
  const tabPanelContent = fs.readFileSync(tabPanelPath, 'utf-8');
  checks.push({
    name: 'TabPanel 导入 lucide-react 图标',
    pass: tabPanelContent.includes("from 'lucide-react'") && tabPanelContent.includes('ChevronLeft') && tabPanelContent.includes('ChevronRight')
  });
  checks.push({
    name: 'TabPanel 使用 useState hook',
    pass: tabPanelContent.includes('useState')
  });
  checks.push({
    name: 'TabPanel 有切换按钮',
    pass: tabPanelContent.includes('isExpanded') && tabPanelContent.includes('setIsExpanded')
  });
  checks.push({
    name: 'TabPanel 使用 glassmorphism 样式',
    pass: tabPanelContent.includes('backdrop-blur-md') && tabPanelContent.includes('bg-slate-900/90')
  });
  checks.push({
    name: 'TabPanel 使用 transition-all duration-300',
    pass: tabPanelContent.includes('transition-all duration-300')
  });
  checks.push({
    name: 'TabPanel 使用 pointer-events-none/auto',
    pass: tabPanelContent.includes('pointer-events-none') && tabPanelContent.includes('pointer-events-auto')
  });
}

// 检查 5: ControlTab 包含必需的功能
if (checks[1].pass) {
  const controlTabContent = fs.readFileSync(controlTabPath, 'utf-8');
  checks.push({
    name: 'ControlTab 有两个tab: Control 和 Monitor',
    pass: controlTabContent.includes('Control') && controlTabContent.includes('Monitor')
  });
  checks.push({
    name: 'ControlTab 有 activeTab 状态',
    pass: controlTabContent.includes('activeTab') && controlTabContent.includes('setActiveTab')
  });
  checks.push({
    name: 'ControlTab 使用 bg-blue-600 高亮',
    pass: controlTabContent.includes('bg-blue-600')
  });
  checks.push({
    name: 'ControlTab 包含 ControlContent 和 MonitorContent',
    pass: controlTabContent.includes('ControlContent') && controlTabContent.includes('MonitorContent')
  });
}

// 检查 6: index.ts 正确导出
if (checks[2].pass) {
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  checks.push({
    name: 'index.ts 导出 TabPanel',
    pass: indexContent.includes("export { TabPanel }")
  });
  checks.push({
    name: 'index.ts 导出 ControlTab',
    pass: indexContent.includes("export { ControlTab }")
  });
}

// 输出结果
let passed = 0;
let failed = 0;

checks.forEach(check => {
  const status = check.pass ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
  if (check.pass) passed++;
  else failed++;
});

console.log(`\n📊 总计: ${passed} 通过, ${failed} 失败`);

if (failed === 0) {
  console.log('\n✨ 所有检查通过！Task 2.1 实现完成。');
  process.exit(0);
} else {
  console.log('\n⚠️  有些检查失败，请检查实现。');
  process.exit(1);
}
