/**
 * 项目统一配色方案
 * 基于深青蓝科技风格
 */

/**
 * 基础背景色
 */
export const BACKGROUND = {
  /** 深空黑 */
  darkSpace: 0x0D1117,
  /** 深板岩 */
  darkSlate: 0x0f172a,
  /** 深灰蓝 */
  darkGrayBlue: 0x1a1a2e,
} as const;

/**
 * 星空粒子色
 */
export const STARFIELD = {
  /** 浅青色 */
  cyan: 0x7dd3fc,
  /** 天蓝色 */
  sky: 0x38bdf8,
} as const;

/**
 * 网格色
 */
export const GRID = {
  /** 深青绿（主色） */
  primary: 0x164e63,
  /** 深灰绿（副色） */
  secondary: 0x1e293b,
} as const;

/**
 * 物理量向量颜色标准
 */
export const VECTOR_COLORS = {
  /** 速度向量 - 绿色 */
  velocity: 0x34d399,
  /** 力向量 - 黄色 */
  force: 0xfacc15,
  /** 电场向量 - 橙色 */
  electric: 0xf97316,
  /** 磁场向量 - 蓝色 */
  magnetic: 0x38bdf8,
  /** 加速度向量 - 青色 */
  acceleration: 0x22d3ee,
} as const;

/**
 * 设备/结构颜色
 */
export const DEVICE_COLORS = {
  /** 真空管道 - 青色 */
  tube: 0x7dd3fc,
  /** 管道发光 - 亮青色 */
  tubeGlow: 0x22d3ee,
  /** 偏转磁铁 - 蓝色 */
  magnet: 0x2563eb,
  /** RF磁铁 - 橙色 */
  magnetHot: 0xf97316,
  /** RF加速腔 - 金色 */
  rf: 0xf59e0b,
  /** 探测器 - 浅蓝白 */
  detector: 0xe0f2fe,
} as const;

/**
 * 原子/粒子颜色
 */
export const PARTICLE_COLORS = {
  /** 原子核 - 金黄色 */
  nucleus: 0xffd700,
  /** 原子核发光 - 琥珀色 */
  nucleusGlow: 0xffaa00,
  /** 电子 - 蓝色 */
  electron: 0x3b82f6,
  /** 正电子/反粒子 - 橙色 */
  positron: 0xfb923c,
  /** α粒子 - 青色 */
  alphaParticle: 0x22d3ee,
} as const;

/**
 * 常见材质预设颜色
 */
export const MATERIAL_COLORS = {
  /** 绿色发光源 */
  greenEmitter: 0x84cc16,
  /** 红色金属 */
  redMetal: 0xef4444,
  /** 蓝色金属 */
  blueMetal: 0x3b82f6,
  /** 紫色金属 */
  purpleMetal: 0x8b5cf6,
} as const;
