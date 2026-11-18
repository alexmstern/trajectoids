import { Quaternion, Vector3 } from 'three'
import { cumulativeLengths, resample, type Point2 } from './path'
import { downDirections, rollOrientations } from './rolling'

/** Data structure to build and animate one trajectoid. */
export interface Roll {
  points: Point2[] // evenly resampled path
  arcLengths: number[] // arc length at each point
  orientations: Quaternion[] // body → world at each point
  downDirs: Vector3[] // floor direction in the body frame at each point
  r: number // core radius = height of the centre above the floor
  length: number
}

/** Resample the path and integrate the rolling motion along it. */
export function computeRoll(path: readonly Point2[], r: number, samplesPerRadius = 20): Roll {
  const points = resample(path, r / samplesPerRadius)
  const orientations = rollOrientations(points, r)
  const arcLengths = cumulativeLengths(points)
  return {
    points,
    arcLengths,
    orientations,
    downDirs: downDirections(orientations),
    r,
    length: arcLengths[arcLengths.length - 1] ?? 0,
  }
}

/**
 * Pose of the body after travelling distance s along the path, interpolated
 * between samples. Writes into `position` (the centre) and `orientation`.
 */
export function poseAt(roll: Roll, s: number, position: Vector3, orientation: Quaternion): void {
  const { points, arcLengths, orientations, r } = roll
  const clamped = Math.min(Math.max(s, 0), roll.length)

  // Binary search for the segment [i, i+1] containing `clamped`.
  let lo = 0
  let hi = points.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (arcLengths[mid]! <= clamped) lo = mid
    else hi = mid
  }

  const segLen = arcLengths[hi]! - arcLengths[lo]!
  const t = segLen > 0 ? (clamped - arcLengths[lo]!) / segLen : 0
  const a = points[lo]!
  const b = points[hi]!

  position.set(a.x + (b.x - a.x) * t, r, a.z + (b.z - a.z) * t)
  orientation.slerpQuaternions(orientations[lo]!, orientations[hi]!, t)
}

/**
 * Core radius that gives a path of length L the scale σ = L / (2πr), i.e. the path is σ full
 * turns of the core. Small σ barely carves the shape; large σ carves it down towards a plain
 * sphere of radius r. Roughly 0.5–2 gives the most interesting shapes. (Sobolev et al. 2023,
 * Fig. 3 caption.)
 */
export function radiusForSigma(length: number, sigma: number): number {
  return length / (2 * Math.PI * sigma)
}
