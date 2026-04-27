/**
 * 可视化数据配置文件
 *
 * ⚠️ 重要说明：此文件包含的是示意性尺度参数，专为教学可视化设计
 * - 所有轨道半径、行星大小均为夸张/示意性数值
 * - 运动速度为相对系数，用于视觉演示
 * - 不代表真实物理数据，不能用于科学计算
 * - 目的是让学生直观理解天体运动的相对关系
 */

/**
 * 视觉行星参数接口
 */
export interface VisualPlanetParams {
    name: string;           // 行星名称
    textureFile: string;    // 纹理文件名（不含扩展名）
    orbit: number;          // 轨道半径（示意性单位）
    size: number;           // 行星大小（示意性单位）
    color: number;          // 颜色（十六进制）
    speed: number;          // 运动速度系数（地球=1.0）
    period: string;         // 公转周期（教学说明）
}

/**
 * 视觉卫星参数接口
 */
export interface VisualSatelliteParams {
    name: string;           // 卫星名称
    orbit: number;          // 轨道半径（夸张比例）
    size: number;           // 卫星大小（夸张比例）
    color: number;          // 颜色
    inclination: number;    // 轨道倾角（弧度）
    speed: number;          // 运动速度系数（同步卫星=1.0）
    type: string;           // 轨道类型说明
}

/**
 * 太阳系可视化数据
 */
export const SOLAR_SYSTEM_VISUAL_DATA = {
    // 太阳参数
    sun: {
        radius: 5,                      // 视觉平衡：降低至 5（从 8），让行星更明显
        color: 0xffdd00,
        emissive: 0xffaa00,
        emissiveIntensity: 2,
    },

    // 行星数据
    planets: [
        { name: 'Mercury', textureFile: 'mercury', orbit: 12, size: 0.5, color: 0x8C7853, speed: 4.0, period: '88 days' },
        { name: 'Venus', textureFile: 'venus', orbit: 18, size: 0.8, color: 0xFFC649, speed: 1.6, period: '225 days' },
        { name: 'Earth', textureFile: 'earth', orbit: 26, size: 0.9, color: 0x4169E1, speed: 1.0, period: '365 days' },
        { name: 'Mars', textureFile: 'mars', orbit: 34, size: 0.7, color: 0xCD5C5C, speed: 0.53, period: '687 days' },
        { name: 'Jupiter', textureFile: 'jupiter', orbit: 48, size: 2.2, color: 0xD8CA9D, speed: 0.24, period: '12 years' },
        { name: 'Saturn', textureFile: 'saturn', orbit: 64, size: 1.8, color: 0xFAD5A5, speed: 0.1, period: '29 years' },
        { name: 'Uranus', textureFile: 'uranus', orbit: 78, size: 1.4, color: 0x4FD0E7, speed: 0.04, period: '84 years' },
        { name: 'Neptune', textureFile: 'neptune', orbit: 92, size: 1.4, color: 0x4169E1, speed: 0.02, period: '165 years' },
    ] as VisualPlanetParams[],
};

/**
 * 卫星可视化数据
 */
export const SATELLITE_VISUAL_DATA = {
    // 地球参数（卫星系统的中心天体）
    earth: {
        radius: 3,
        color: 0x4169E1,
    },

    // 卫星数据
    satellites: [
        { name: 'ISS', orbit: 4.5, size: 0.15, color: 0xFFFFFF, inclination: 0.9, speed: 3.5, type: 'Low Earth Orbit' },
        { name: 'Polar Satellite', orbit: 5.5, size: 0.12, color: 0x0000FF, inclination: 1.57, speed: 2.8, type: 'Polar Orbit' },
        { name: 'GPS Satellite', orbit: 7.5, size: 0.12, color: 0xFF0000, inclination: 0.95, speed: 1.8, type: 'Medium Earth Orbit' },
        { name: 'Geostationary Satellite', orbit: 10, size: 0.15, color: 0x00FF00, inclination: 0, speed: 1.0, type: 'Geostationary Orbit' },
    ] as VisualSatelliteParams[],
};

/**
 * 相机配置（预留）
 */
export const CAMERA_CONFIG = {
    // 太阳系视图配置
    solarView: {
        position: [0, 40, 55] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        fov: 50,
        minDistance: 20,
        maxDistance: 150,
    },

    // 卫星视图配置
    satelliteView: {
        position: [0, 12, 18] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        fov: 60,
        minDistance: 5,
        maxDistance: 40,
    },
};

/**
 * 视图配置
 */
export const VIEW_CONFIG = {
    // 太阳系视图
    solarSystem: {
        name: 'Solar System View',
        description: 'Shows the eight planets orbiting the Sun',
        speedMultiplier: 0.0001,  // 基础速度倍率
    },

    // 卫星视图
    satellite: {
        name: 'Satellite Orbit View',
        description: 'Shows different types of satellites orbiting Earth',
        speedMultiplier: 0.0005,  // 基础速度倍率
    },
};
