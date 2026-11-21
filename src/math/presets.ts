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

/**
 * A sine wave that travels `depth` along +z (toward the default camera) while swinging `amplitude`
 * side to side in x, completing `waves` full periods. Centred on the origin.
 */
export function sineWave(depth: number, amplitude: number, waves: number, samples = 200): Point2[] {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples
    return { x: amplitude * Math.sin(2 * Math.PI * waves * t), z: (t - 0.5) * depth }
  })
}

// --- Closed loops (first point = last point), for `closedRoll` in loops.ts ------------------------

function closedCurve(samples: number, f: (t: number) => Point2): Point2[] {
  const points = Array.from({ length: samples }, (_, i) => f((2 * Math.PI * i) / samples))
  return [...points, { ...points[0]! }]
}

/**
 * A geometric heart, `width` across, tip toward the viewer (+z): a square turned 45° (so the tip is
 * a right angle) with a semicircle on each of its two upper sides.
 */
export function heart(width: number, samplesPerArc = 200): Point2[] {
  const s = width / (1 + Math.SQRT1_2) // side of the square
  const h = s * Math.SQRT1_2 // half the square's diagonal
  // Drawn upright in (x, y) with the tip at the origin; y is flipped onto -z below.
  const tip = { x: 0, y: 0 }
  const left = { x: -h, y: h }
  const right = { x: h, y: h }
  // Each semicircle sits on a side of length s (radius s/2), bulging away from the square.
  const arc = (cx: number, cy: number, from: number, to: number) =>
    Array.from({ length: samplesPerArc + 1 }, (_, i) => {
      const a = from + ((to - from) * i) / samplesPerArc
      return { x: cx + (s / 2) * Math.cos(a), y: cy + (s / 2) * Math.sin(a) }
    })
  const deg = Math.PI / 180
  const outline = [
    tip,
    left,
    ...arc(-h / 2, (3 * h) / 2, 225 * deg, 45 * deg).slice(1), // over the upper-left side to the dip
    ...arc(h / 2, (3 * h) / 2, 135 * deg, -45 * deg).slice(1), // over the upper-right side
    right,
    tip,
  ]
  const top = (3 * h) / 2 + s / 2
  return outline.map((p) => ({ x: p.x, z: top / 2 - p.y })) // centre vertically, tip toward +z
}

/** A sideways figure 8 (lemniscate of Gerono), `width` across and `depth` deep. */
export function figureEight(width: number, depth = width / 2, samples = 400): Point2[] {
  return closedCurve(samples, (t) => ({ x: (width / 2) * Math.sin(t), z: depth * Math.sin(t) * Math.cos(t) }))
}

/** A wide oval pinched into `lobes` bulges, `width` × `depth` overall (roughly). */
export function lobedOval(width: number, depth: number, lobes = 3, amount = 0.35, samples = 600): Point2[] {
  return closedCurve(samples, (t) => {
    const k = (1 + amount * Math.cos(lobes * t)) / (1 + amount)
    return { x: (k * width * Math.cos(t)) / 2, z: (k * depth * Math.sin(t)) / 2 }
  })
}

/**
 * Loops that roll forever (see `closedRoll` in loops.ts). Each picks how many laps one seamless cycle
 * takes and the smallest σ (ball turns per lap) to search from, which sets the ball's size.
 */
export const LOOP_PRESETS: Record<string, { path: () => Point2[]; laps: number; minSigma: number }> = {
  heart: { path: () => heart(10), laps: 3, minSigma: 3 },
  eight: { path: () => figureEight(16, 4), laps: 2, minSigma: 3.5 },
  oval: { path: () => lobedOval(16, 7), laps: 2, minSigma: 2 },
}
