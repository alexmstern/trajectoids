import { pathLength, cumulativeLengths, resample, type Point2 } from './path'
import { downDirections, rollOrientations } from './rolling'
import type { Roll } from './motion'

const LAP_SAMPLES = 1500 // fixed sampling, so the lap rotation varies smoothly with r

/** Zero when n laps at σ turns per lap bring the ball back to its starting orientation. */
function closure(lap: readonly Point2[], length: number, sigma: number, laps: number): number {
  const w = rollOrientations(lap, length / (2 * Math.PI * sigma)).at(-1)!.w
  return Math.sin(laps * Math.acos(Math.min(1, Math.max(-1, w))))
}

/**
 * Smallest σ ≥ `minSigma` (up to `maxSigma`) where `laps` laps close up, or null if there is none.
 * Larger σ means a smaller ball that turns more often, so its shape gets more carved.
 */
export function closingSigma(loop: readonly Point2[], laps = 2, minSigma = 1, maxSigma = 8): number | null {
  const length = pathLength(loop)
  const lap = resample(loop, length / LAP_SAMPLES)
  const f = (sigma: number) => closure(lap, length, sigma, laps)
  const step = 0.01
  let a = minSigma
  let fa = f(a)
  for (let b = a + step; b <= maxSigma; b += step) {
    const fb = f(b)
    if (fa * fb < 0) {
      // Bisect the bracket [a, b] down to floating-point precision.
      for (let i = 0; i < 50; i++) {
        const mid = (a + b) / 2
        const fm = f(mid)
        if (fa * fm <= 0) b = mid
        else [a, fa] = [mid, fm]
      }
      return (a + b) / 2
    }
    a = b
    fa = fb
  }
  return null
}

/**
 * Roll for `laps` laps around a closed loop at a radius where the motion
 * repeats seamlessly. Returns null if there is no such radius in range.
 */
export function closedRoll(loop: readonly Point2[], laps = 2, minSigma = 1): Roll | null {
  const sigma = closingSigma(loop, laps, minSigma)
  if (sigma === null) return null

  const length = pathLength(loop)
  const r = length / (2 * Math.PI * sigma)
  const lap = resample(loop, length / LAP_SAMPLES)
  const points = [...lap]
  for (let i = 1; i < laps; i++) points.push(...lap.slice(1))
  const orientations = rollOrientations(points, r)
  const arcLengths = cumulativeLengths(points)
  const every = Math.max(1, Math.floor(r / 20 / (length / LAP_SAMPLES)))

  return {
    points,
    arcLengths,
    orientations,
    downDirs: downDirections(orientations.filter((_, i) => i % every === 0)),
    r,
    length: arcLengths.at(-1)!,
  }
}
