import * as THREE from 'three';

interface TextSpriteOptions {
  color?: string;
  background?: string;
  border?: string;
  fontSize?: number;
  scale?: number;
}

export function createTextSprite(text: string, options: TextSpriteOptions = {}): THREE.Sprite {
  const fontSize = options.fontSize ?? 42;
  const padding = 18;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
  }

  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  const metrics = context.measureText(text);
  canvas.width = Math.ceil(metrics.width + padding * 2);
  canvas.height = Math.ceil(fontSize + padding * 2);

  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  context.fillStyle = options.background ?? 'rgba(8, 18, 34, 0.72)';
  context.strokeStyle = options.border ?? 'rgba(125, 211, 252, 0.58)';
  context.lineWidth = 3;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  context.fillStyle = options.color ?? '#E0F2FE';
  context.textBaseline = 'middle';
  context.fillText(text, padding, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  const scale = options.scale ?? 0.008;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
  return sprite;
}

export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    const disposable = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    disposable.geometry?.dispose();

    const materials = Array.isArray(disposable.material)
      ? disposable.material
      : disposable.material
        ? [disposable.material]
        : [];

    materials.forEach((material) => {
      const mappedMaterial = material as THREE.Material & {
        map?: THREE.Texture;
        emissiveMap?: THREE.Texture;
        alphaMap?: THREE.Texture;
      };
      mappedMaterial.map?.dispose();
      mappedMaterial.emissiveMap?.dispose();
      mappedMaterial.alphaMap?.dispose();
      material.dispose();
    });
  });
}
