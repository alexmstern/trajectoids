import { Quaternion, Vector3 } from 'three'
import type { Point2 } from './path'

const UP = new Vector3(0, 1, 0)
const DOWN = new Vector3(0, -1, 0)

/**
 * Given a path consisting of points on the floor plane, compute the orientation of a rolling
 * sphere of radius r at each point. The sphere is assumed to roll without slipping, so the
 * distance travelled along the path is equal to the arc length of the sphere's rotation.
 *
 * Each segment rotates the sphere by (segment length / r) about the horizontal axis
 * up × segment. That axis is fixed in world space, so the step is applied on the left
 * (premultiply): Q_i = step · Q_{i-1}. See Sobolev et al. 2023, p. 312, eq. 2.
 *
 * Q_0 is the identity. Returns one quaternion per point (body → world).
 */
export function rollOrientations(points: readonly Point2[], r: number): Quaternion[] {
  if (points.length === 0) return []

  const orientations = [new Quaternion()]
  const delta = new Vector3()
  const axis = new Vector3()
  const step = new Quaternion()

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    delta.set(b.x - a.x, 0, b.z - a.z)
    const s = delta.length()

    const q = orientations[i - 1]!.clone()
    if (s > 1e-12) {
      axis.crossVectors(UP, delta).normalize()
      step.setFromAxisAngle(axis, s / r)
      q.premultiply(step).normalize()
    }
    orientations.push(q)
  }
  return orientations
}

/**
 * Returns the point on the sphere that is pointing straight down in world space,
 * relative to the sphere's starting orientation, for every orientation in the input array.
 *
 * Computed as d_i = Q_i⁻¹ · (0, −1, 0), i.e. world down with the rotation undone. Each d_i is
 * a unit vector from the centre; the contact point on the sphere is r · d_i.
 */
export function downDirections(orientations: readonly Quaternion[]): Vector3[] {
  return orientations.map((q) => DOWN.clone().applyQuaternion(q.clone().invert()))
}
