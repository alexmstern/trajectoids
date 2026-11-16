import { IcosahedronGeometry, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { computeRoll, poseAt } from './motion'
import { lShape } from './presets'
import { carveVertices } from './shape'

const r = 1
const R = 1.3 * r
const roll = computeRoll(lShape(2 * Math.PI * r), r)

describe('poseAt', () => {
  it('keeps the centre at height r on the path', () => {
    const pos = new Vector3()
    const q = new Quaternion()
    poseAt(roll, 0, pos, q)
    expect(pos.toArray()).toEqual([roll.points[0]!.x, r, roll.points[0]!.z])
    poseAt(roll, roll.length, pos, q)
    const end = roll.points[roll.points.length - 1]!
    expect(pos.x).toBeCloseTo(end.x, 9)
    expect(pos.z).toBeCloseTo(end.z, 9)
  })

  it('rests the carved shape on the floor throughout the roll', () => {
    const positions = new IcosahedronGeometry(1, 30).getAttribute('position').array as Float32Array
    carveVertices(positions, roll.downDirs, r, R)

    const pos = new Vector3()
    const q = new Quaternion()
    const v = new Vector3()
    for (let s = 0; s <= roll.length; s += roll.length / 37) {
      poseAt(roll, s, pos, q)
      let minY = Infinity
      for (let i = 0; i < positions.length; i += 3) {
        minY = Math.min(minY, v.fromArray(positions, i).applyQuaternion(q).add(pos).y)
      }
      // Never below the floor; slightly above is allowed because the exact
      // contact point usually falls between mesh vertices.
      expect(minY).toBeGreaterThan(-1e-3)
      expect(minY).toBeLessThan(0.02 * r)
    }
  })
})
