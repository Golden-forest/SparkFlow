import * as THREE from 'three';

const MIN_VISIBLE_WAVELENGTH_NM = 380;
const MAX_VISIBLE_WAVELENGTH_NM = 780;
const GAMMA = 0.8;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function applyGamma(intensity: number, factor: number): number {
  if (intensity <= 0 || factor <= 0) {
    return 0;
  }
  return clamp01(Math.pow(intensity * factor, GAMMA));
}

export function wavelengthToRGB(wavelengthNm: number): [number, number, number] {
  if (wavelengthNm < MIN_VISIBLE_WAVELENGTH_NM || wavelengthNm > MAX_VISIBLE_WAVELENGTH_NM) {
    return [0, 0, 0];
  }

  let red = 0;
  let green = 0;
  let blue = 0;

  if (wavelengthNm < 440) {
    red = (440 - wavelengthNm) / (440 - 380);
    blue = 1;
  } else if (wavelengthNm < 490) {
    green = (wavelengthNm - 440) / (490 - 440);
    blue = 1;
  } else if (wavelengthNm < 510) {
    green = 1;
    blue = (510 - wavelengthNm) / (510 - 490);
  } else if (wavelengthNm < 580) {
    red = (wavelengthNm - 510) / (580 - 510);
    green = 1;
  } else if (wavelengthNm < 645) {
    red = 1;
    green = (645 - wavelengthNm) / (645 - 580);
  } else {
    red = 1;
  }

  let factor = 1;
  if (wavelengthNm < 420) {
    factor = 0.3 + 0.7 * (wavelengthNm - 380) / (420 - 380);
  } else if (wavelengthNm > 700) {
    factor = 0.3 + 0.7 * (780 - wavelengthNm) / (780 - 700);
  }

  return [
    applyGamma(red, factor),
    applyGamma(green, factor),
    applyGamma(blue, factor),
  ];
}

export function wavelengthToColor(wavelengthNm: number): THREE.Color {
  const [red, green, blue] = wavelengthToRGB(wavelengthNm);
  return new THREE.Color(red, green, blue);
}

export function wavelengthToLabel(wavelengthNm: number): string {
  if (wavelengthNm < MIN_VISIBLE_WAVELENGTH_NM || wavelengthNm > MAX_VISIBLE_WAVELENGTH_NM) {
    return 'Out of Range';
  }
  if (wavelengthNm < 450) return 'Violet';
  if (wavelengthNm < 495) return 'Blue';
  if (wavelengthNm < 570) return 'Green';
  if (wavelengthNm < 590) return 'Yellow';
  if (wavelengthNm < 620) return 'Orange';
  return 'Red';
}
