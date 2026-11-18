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

/**
 * Drop extraneous points by filtering by minimum distance.
 */
export function cleanPath(points: readonly Point2[], minDist: number): Point2[] {
  const out: Point2[] = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (!prev || distance(prev, p) >= minDist) out.push({ ...p })
  }

  // If the true end point was dropped, move the last kept point onto it.
  const last = points[points.length - 1]
  if (last && out.length > 1) out[out.length - 1] = { ...last }
  return out
}

/**
 * Moving-average smoothing: each point becomes the mean of itself and up to `window` neighbours
 * on each side.
 */
export function smooth(points: readonly Point2[], window: number, passes = 1): Point2[] {
  let current = points.map((p) => ({ ...p }))
  for (let pass = 0; pass < passes; pass++) {
    current = current.map((_, i) => {
      const k = Math.min(window, i, current.length - 1 - i)
      let x = 0
      let z = 0
      for (let j = i - k; j <= i + k; j++) {
        x += current[j]!.x
        z += current[j]!.z
      }
      return { x: x / (2 * k + 1), z: z / (2 * k + 1) }
    })
  }
  return current
}

/**
 * Turn raw pointer input into a usable path: remove duplicates, space points evenly `spacing`
 * apart, then smooth out hand jitter. `smoothing` is the averaging window in path length (world
 * units); larger values give rounder curves.
 */
export function tidyPath(raw: readonly Point2[], spacing: number, smoothing = 10 * spacing): Point2[] {
  const even = resample(cleanPath(raw, spacing / 4), spacing)
  return smooth(even, Math.max(1, Math.round(smoothing / spacing / 2)), 2)
}

/** Cut the path off once it reaches `maxLength` (interpolating the final point). */
export function truncatePath(points: readonly Point2[], maxLength: number): Point2[] {
  const out: Point2[] = points.length > 0 ? [{ ...points[0]! }] : []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const segLen = distance(a, b)
    if (total + segLen >= maxLength) {
      const t = segLen > 0 ? (maxLength - total) / segLen : 0
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      return out
    }
    total += segLen
    out.push({ ...b })
  }
  return out
}
