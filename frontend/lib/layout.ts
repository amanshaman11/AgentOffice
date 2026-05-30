export const SEMI_CIRCLE_RADIUS = 2.9;

// Where active agents walk to during a run.
export const STAGE_POSITION: [number, number, number] = [0, 0, 0.9];

export interface AgentSlot {
  position: [number, number, number];
  angle: number;
}

/**
 * Distribute N agents along a semi-circle of given radius centered at origin.
 * Arc spans from x=+R (right) through z=-R (back) to x=-R (left).
 * The open side of the arc faces +Z (toward the camera in our setup).
 */
export function semiCircleSlots(
  count: number,
  radius = SEMI_CIRCLE_RADIUS,
): AgentSlot[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = Math.PI * t;
    const x = Math.cos(angle) * radius;
    const z = -Math.sin(angle) * radius;
    return { position: [x, 0, z], angle };
  });
}
