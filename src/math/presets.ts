import type { Point2 } from './path'

/**
 * Corner points of an L-shaped path: `leg` along +x, then `leg` along +z,
 * centred on the origin. Pass the result through `resample` before rolling.
 */
export function lShape(leg: number): Point2[] {
  const h = leg / 2
  return [
    { x: -h, z: -h },
    { x: h, z: -h },
    { x: h, z: h },
  ]
}
