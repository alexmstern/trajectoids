import { describe, expect, it } from 'vitest'
import { distance, pathLength, resample, type Point2 } from './path'

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
