import { describe, expect, it } from 'vitest'
import { cleanPath, distance, pathLength, resample, smooth, tidyPath, truncatePath, type Point2 } from './path'

const L_SHAPE: Point2[] = [
  { x: 0, z: 0 },
  { x: 3, z: 0 },
  { x: 3, z: 4 },
]

describe('pathLength', () => {
  it('sums segment lengths', () => {
    expect(pathLength(L_SHAPE)).toBeCloseTo(7)
  })
})

describe('resample', () => {
  it('spaces points exactly ds apart, with a shorter final gap', () => {
    const out = resample([{ x: 0, z: 0 }, { x: 1, z: 0 }], 0.3) // 0, .3, .6, .9, 1
    expect(out).toHaveLength(5)
    for (let i = 1; i < 4; i++) expect(distance(out[i - 1]!, out[i]!)).toBeCloseTo(0.3, 12)
    expect(distance(out[3]!, out[4]!)).toBeCloseTo(0.1, 12)
  })

  it('carries leftover distance across corners', () => {
    const out = resample(L_SHAPE, 0.4)
    const afterCorner = out[8]! // 0.4 * 8 = 3.2, so 0.2 after the corner
    expect(afterCorner.x).toBeCloseTo(3, 12)
    expect(afterCorner.z).toBeCloseTo(0.2, 12) // 0.2 before the corner + 0.2 after = 0.4

    expect(out.length).toBe(Math.ceil(7 / 0.4) + 1) // count follows arc length (+1 for the start)
    expect(pathLength(out)).toBeLessThan(6.9) // the chord across the corner is shorter than the L
  })

  it('hits the corner when ds divides the leg length', () => {
    const out = resample(L_SHAPE, 1)
    expect(out).toHaveLength(8)
    expect(out[3]).toEqual({ x: 3, z: 0 })
    expect(out[7]).toEqual({ x: 3, z: 4 })
  })

  it('keeps start and end for a path shorter than ds', () => {
    const out = resample([{ x: 0, z: 0 }, { x: 0.1, z: 0 }], 1)
    expect(out).toEqual([{ x: 0, z: 0 }, { x: 0.1, z: 0 }])
  })
})

describe('cleanPath', () => {
  it('drops repeated and near-duplicate points', () => {
    const raw = [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0.01, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }]
    expect(cleanPath(raw, 0.1)).toEqual([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }])
  })

  it('always keeps the true end point', () => {
    const raw = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1.05, z: 0 }]
    expect(cleanPath(raw, 0.1)).toEqual([{ x: 0, z: 0 }, { x: 1.05, z: 0 }])
  })

  it('collapses a tap (no real movement) to a single point', () => {
    expect(cleanPath([{ x: 0, z: 0 }, { x: 0.001, z: 0 }], 0.1)).toHaveLength(1)
  })
})

describe('smooth', () => {
  it('leaves a straight, evenly spaced line unchanged', () => {
    const line = resample([{ x: 0, z: 0 }, { x: 5, z: 0 }], 0.5)
    const out = smooth(line, 3, 2)
    out.forEach((p, i) => {
      expect(p.x).toBeCloseTo(line[i]!.x, 12)
      expect(p.z).toBeCloseTo(line[i]!.z, 12)
    })
  })

  it('never moves the endpoints', () => {
    const wiggly = Array.from({ length: 20 }, (_, i) => ({ x: i, z: i % 2 }))
    const out = smooth(wiggly, 3, 3)
    expect(out[0]).toEqual(wiggly[0])
    expect(out[19]).toEqual(wiggly[19])
  })

  it('reduces zigzag jitter', () => {
    const zigzag = Array.from({ length: 40 }, (_, i) => ({ x: i * 0.1, z: i % 2 ? 0.05 : -0.05 }))
    const amplitude = (ps: Point2[]) => Math.max(...ps.slice(5, -5).map((p) => Math.abs(p.z)))
    expect(amplitude(smooth(zigzag, 2, 2))).toBeLessThan(0.2 * amplitude(zigzag))
  })
})

describe('tidyPath', () => {
  it('turns messy input into an evenly spaced path with the same endpoints', () => {
    const raw = [
      { x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0.3, z: 0.02 }, { x: 0.31, z: 0.02 },
      { x: 1.2, z: -0.03 }, { x: 2, z: 0.4 }, { x: 2.1, z: 1.5 }, { x: 2.1, z: 1.5 },
    ]
    const out = tidyPath(raw, 0.05)
    expect(out[0]).toEqual(raw[0])
    expect(out[out.length - 1]).toEqual(raw[raw.length - 1])
    for (let i = 1; i < out.length; i++) expect(distance(out[i - 1]!, out[i]!)).toBeGreaterThan(0)
  })
})

describe('truncatePath', () => {
  it('cuts the path at exactly maxLength', () => {
    const out = truncatePath(L_SHAPE, 5) // 3 along x, then 2 up the second leg
    expect(out).toEqual([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 2 }])
    expect(pathLength(out)).toBeCloseTo(5, 12)
  })

  it('leaves shorter paths unchanged', () => {
    expect(truncatePath(L_SHAPE, 100)).toEqual(L_SHAPE)
  })
})
