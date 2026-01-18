/**
 * 可视化数据配置文件
 *
 * ⚠️ 重要说明：此文件包含的是示意性尺度参数，专为教学可视化设计
 * - 所有轨道半径、行星大小均为夸张/示意性数值
 * - 运动速度为相对系数，用于视觉演示
 * - 不代表真实物理数据，不能用于科学计算
 * - 目的是让学生直观理解天体运动的相对关系
 */

import * as THREE from 'three';

/**
 * 视觉行星参数接口
 */
export interface VisualPlanetParams {
    name: string;           // 行星名称
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
        radius: 8,                      // 使用新的大小设置
        color: 0xffdd00,
        emissive: 0xffaa00,
        emissiveIntensity: 2,
    },

    // 行星数据
    planets: [
        { name: '水星', orbit: 8,   size: 0.3, color: 0x8C7853, speed: 4.0,   period: '88天' },
        { name: '金星', orbit: 12,  size: 0.5, color: 0xFFC649, speed: 1.6,   period: '225天' },
        { name: '地球', orbit: 16,  size: 0.5, color: 0x4169E1, speed: 1.0,   period: '365天' },
        { name: '火星', orbit: 20,  size: 0.4, color: 0xCD5C5C, speed: 0.53,  period: '687天' },
        { name: '木星', orbit: 28,  size: 1.5, color: 0xD8CA9D, speed: 0.24,  period: '12年' },
        { name: '土星', orbit: 36,  size: 1.2, color: 0xFAD5A5, speed: 0.10,  period: '29年' },
        { name: '天王星', orbit: 44, size: 0.9, color: 0x4FD0E7, speed: 0.04,  period: '84年' },
        { name: '海王星', orbit: 52, size: 0.9, color: 0x4169E1, speed: 0.02,  period: '165年' },
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
        { name: '国际空间站', orbit: 4.5, size: 0.15, color: 0xFFFFFF, inclination: 0.9,  speed: 3.5, type: '近地轨道' },
        { name: '极地卫星',     orbit: 5.5, size: 0.12, color: 0x0000FF, inclination: 1.57, speed: 2.8, type: '极地轨道' },
        { name: 'GPS卫星',      orbit: 7.5, size: 0.12, color: 0xFF0000, inclination: 0.95, speed: 1.8, type: '中轨道' },
        { name: '同步卫星',     orbit: 10,  size: 0.15, color: 0x00FF00, inclination: 0,    speed: 1.0, type: '同步轨道' },
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
        name: '太阳系视图',
        description: '展示八大行星围绕太阳的运动',
        speedMultiplier: 0.0001,  // 基础速度倍率
    },

    // 卫星视图
    satellite: {
        name: '卫星轨道视图',
        description: '展示不同类型人造卫星围绕地球的运动',
        speedMultiplier: 0.0005,  // 基础速度倍率
    },
};
