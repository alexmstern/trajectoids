/** A point on the floor plane (y = 0 as this world is y-up). */
export interface Point2 {
  x: number
  z: number
}

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/** Sum of segments forming the path. */
export function pathLength(points: readonly Point2[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1]!, points[i]!)
  }
  return total
}

/** Arc length from the start to each point: [0, |p1−p0|, …, pathLength]. */
export function cumulativeLengths(points: readonly Point2[]): number[] {
  const out = points.length > 0 ? [0] : []
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1]! + distance(points[i - 1]!, points[i]!))
  }
  return out
}

/**
 * Resample a polyline so consecutive points are exactly `ds` apart (measured
 * along the path). The original end point is always kept, so the final gap
 * may be shorter than `ds`.
 */
export function resample(points: readonly Point2[], ds: number): Point2[] {
  if (points.length === 0) return []
  if (ds <= 0) throw new Error('resample: ds must be positive')

  const out: Point2[] = [{ ...points[0]! }]
  // Distance still to travel (from the start of the current segment) before
  // placing the next output point. Carried across segment boundaries.
  let distanceToNext = ds

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const segLen = distance(a, b)

    while (distanceToNext <= segLen) {
      const t = distanceToNext / segLen
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      distanceToNext += ds
    }
    distanceToNext -= segLen
  }

  // Add the true end point unless the last sample already landed on it.
  const last = points[points.length - 1]!
  if (distance(out[out.length - 1]!, last) > ds * 1e-6) {
    out.push({ ...last })
  }
  return out
}
