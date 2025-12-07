import * as THREE from 'three';

/**
 * 向量运算工具函数
 */

// 计算两点间距离
export function distance(p1: THREE.Vector3, p2: THREE.Vector3): number {
    return p1.distanceTo(p2);
}

// 向量归一化(返回新向量)
export function normalize(v: THREE.Vector3): THREE.Vector3 {
    return v.clone().normalize();
}

// 计算两向量夹角(弧度)
export function angleBetween(v1: THREE.Vector3, v2: THREE.Vector3): number {
    return v1.angleTo(v2);
}

// 向量投影
export function project(v: THREE.Vector3, onto: THREE.Vector3): THREE.Vector3 {
    const scalar = v.dot(onto) / onto.lengthSq();
    return onto.clone().multiplyScalar(scalar);
}

// 随机单位向量
export function randomUnitVector(): THREE.Vector3 {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
    );
}

// 线性插值
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// 向量线性插值
export function lerpVector(
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    t: number
): THREE.Vector3 {
    return new THREE.Vector3(
        lerp(v1.x, v2.x, t),
        lerp(v1.y, v2.y, t),
        lerp(v1.z, v2.z, t)
    );
}
