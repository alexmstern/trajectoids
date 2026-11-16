import { IcosahedronGeometry, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { resample } from './path'
import { lShape } from './presets'
import { downDirections, rollOrientations } from './rolling'
import { carveRadius, carveVertices } from './shape'

const r = 1
const R = 1.3 * r

function downDirsFor(corners: Parameters<typeof resample>[0]) {
  return downDirections(rollOrientations(resample(corners, r / 20), r))
}

describe('carveRadius', () => {
  const dirs = downDirsFor(lShape(2 * Math.PI * r))

  it('puts every contact point r·d_i exactly on the surface', () => {
    for (const d of dirs) expect(carveRadius(d, dirs, r, R)).toBeCloseTo(r, 9)
  })

  it('leaves directions the path never touches at radius R', () => {
    // A straight roll along +x only touches the great circle in the x–y plane.
    const straight = downDirsFor([{ x: 0, z: 0 }, { x: Math.PI * r, z: 0 }])
    expect(carveRadius(new Vector3(0, 0, 1), straight, r, R)).toBe(R)
  })
})

describe('carveVertices', () => {
  it('never pokes through any floor plane (no vertex below the floor)', () => {
    const dirs = downDirsFor(lShape(2 * Math.PI * r))
    const positions = new IcosahedronGeometry(1, 8).getAttribute('position').array as Float32Array
    carveVertices(positions, dirs, r, R)

    const p = new Vector3()
    let worst = -Infinity
    for (let v = 0; v < positions.length; v += 3) {
      p.fromArray(positions, v)
      for (const d of dirs) worst = Math.max(worst, p.dot(d) - r)
    }
    // Float32 storage limits precision to ~1e-7.
    expect(worst).toBeLessThan(1e-6)
  })
})
