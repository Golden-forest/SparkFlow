export interface CartState {
  mass: number;
  position: number;
  velocity: number;
  halfLength: number;
}

export interface CollisionSnapshot {
  preMomentum: number;
  postMomentum: number;
  preKineticEnergy: number;
  postKineticEnergy: number;
  cartAVelocityBefore: number;
  cartBVelocityBefore: number;
  cartAVelocityAfter: number;
  cartBVelocityAfter: number;
}

const MIN_MASS = 1e-6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateCartMomentum(cart: CartState): number {
  return cart.mass * cart.velocity;
}

export function calculateCartKineticEnergy(cart: CartState): number {
  return 0.5 * cart.mass * cart.velocity * cart.velocity;
}

export function calculateSystemMomentum(cartA: CartState, cartB: CartState): number {
  return calculateCartMomentum(cartA) + calculateCartMomentum(cartB);
}

export function calculateSystemKineticEnergy(cartA: CartState, cartB: CartState): number {
  return calculateCartKineticEnergy(cartA) + calculateCartKineticEnergy(cartB);
}

export function integrateCart(cart: CartState, deltaTime: number): void {
  cart.position += cart.velocity * deltaTime;
}

export function resolveTrackBoundaryCollision(
  cart: CartState,
  minX: number,
  maxX: number,
  restitution: number
): boolean {
  const boundedRestitution = clamp(restitution, 0, 1);
  let collided = false;

  const leftEdge = cart.position - cart.halfLength;
  const rightEdge = cart.position + cart.halfLength;

  if (leftEdge < minX) {
    cart.position = minX + cart.halfLength;
    if (cart.velocity < 0) {
      cart.velocity = -cart.velocity * boundedRestitution;
    }
    collided = true;
  }

  if (rightEdge > maxX) {
    cart.position = maxX - cart.halfLength;
    if (cart.velocity > 0) {
      cart.velocity = -cart.velocity * boundedRestitution;
    }
    collided = true;
  }

  return collided;
}

export function resolveCartCollision(
  cartA: CartState,
  cartB: CartState,
  restitution: number
): CollisionSnapshot | null {
  const centerDistance = cartB.position - cartA.position;
  const minimumDistance = cartA.halfLength + cartB.halfLength;
  const distanceMagnitude = Math.abs(centerDistance);

  if (distanceMagnitude > minimumDistance) {
    return null;
  }

  const normal = centerDistance >= 0 ? 1 : -1;
  const overlap = minimumDistance - distanceMagnitude;

  if (overlap > 0) {
    const totalMass = Math.max(MIN_MASS, cartA.mass + cartB.mass);
    const correctionA = overlap * (cartB.mass / totalMass);
    const correctionB = overlap * (cartA.mass / totalMass);

    cartA.position -= normal * correctionA;
    cartB.position += normal * correctionB;
  }

  const relativeVelocityAlongNormal = (cartB.velocity - cartA.velocity) * normal;
  if (relativeVelocityAlongNormal >= 0) {
    return null;
  }

  const m1 = Math.max(MIN_MASS, cartA.mass);
  const m2 = Math.max(MIN_MASS, cartB.mass);
  const boundedRestitution = clamp(restitution, 0, 1);
  const u1 = cartA.velocity;
  const u2 = cartB.velocity;

  const preMomentum = calculateSystemMomentum(cartA, cartB);
  const preKineticEnergy = calculateSystemKineticEnergy(cartA, cartB);

  const v1 = ((m1 - boundedRestitution * m2) * u1 + (1 + boundedRestitution) * m2 * u2) / (m1 + m2);
  const v2 = ((m2 - boundedRestitution * m1) * u2 + (1 + boundedRestitution) * m1 * u1) / (m1 + m2);

  cartA.velocity = v1;
  cartB.velocity = v2;

  const postMomentum = calculateSystemMomentum(cartA, cartB);
  const postKineticEnergy = calculateSystemKineticEnergy(cartA, cartB);

  return {
    preMomentum,
    postMomentum,
    preKineticEnergy,
    postKineticEnergy,
    cartAVelocityBefore: u1,
    cartBVelocityBefore: u2,
    cartAVelocityAfter: v1,
    cartBVelocityAfter: v2,
  };
}
