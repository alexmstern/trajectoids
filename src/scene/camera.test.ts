import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { fitBoxDistance, fitDistance } from './camera'

describe('fitDistance', () => {
  it('fits a sphere exactly inside the vertical field of view on a wide screen', () => {
    // Half-FOV of 45° → the sphere's tangent lines touch the screen edges at d = r / sin(45°).
    expect(fitDistance(1, 90, 2)).toBeCloseTo(Math.SQRT2, 12)
  })

  it('backs off further on tall (portrait) screens', () => {
    expect(fitDistance(1, 45, 0.5)).toBeGreaterThan(fitDistance(1, 45, 2))
  })
})

describe('fitBoxDistance', () => {
  it('puts every box corner on screen, with the outermost exactly at the margin', () => {
    for (const aspect of [0.5, 1.6]) {
      const min = new Vector3(-1, 0, -6)
      const max = new Vector3(1, 1, 6) // a long, thin box: the portrait case
      const center = new Vector3(0, 0, 0)
      const dir = new Vector3(0, 1, 2).normalize()
      const d = fitBoxDistance(min, max, center, dir, 45, aspect, 0.8)

      const camera = new PerspectiveCamera(45, aspect)
      camera.position.copy(dir).multiplyScalar(d)
      camera.lookAt(center)
      camera.updateMatrixWorld()
      let extent = 0
      for (const x of [min.x, max.x])
        for (const y of [min.y, max.y])
          for (const z of [min.z, max.z]) {
            const ndc = new Vector3(x, y, z).project(camera) // screen coordinates in [-1, 1]
            extent = Math.max(extent, Math.abs(ndc.x), Math.abs(ndc.y))
          }
      expect(extent).toBeCloseTo(0.8, 6)
    }
  })
})
