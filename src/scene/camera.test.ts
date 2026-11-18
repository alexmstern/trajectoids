import { describe, expect, it } from 'vitest'
import { fitDistance } from './camera'

describe('fitDistance', () => {
  it('fits a sphere exactly inside the vertical field of view on a wide screen', () => {
    // Half-FOV of 45° → the sphere's tangent lines touch the screen edges at d = r / sin(45°).
    expect(fitDistance(1, 90, 2)).toBeCloseTo(Math.SQRT2, 12)
  })

  it('backs off further on tall (portrait) screens', () => {
    expect(fitDistance(1, 45, 0.5)).toBeGreaterThan(fitDistance(1, 45, 2))
  })
})
