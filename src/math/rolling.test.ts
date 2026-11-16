import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { resample, type Point2 } from './path'
import { downDirections, rollOrientations } from './rolling'

const r = 1

/** Rotation angle of a quaternion, in radians. */
function angleOf(q: Quaternion): number {
  return 2 * Math.acos(Math.min(1, Math.abs(q.w)))
}

function expectVec(v: Vector3, x: number, y: number, z: number) {
  expect(v.x).toBeCloseTo(x, 6)
  expect(v.y).toBeCloseTo(y, 6)
  expect(v.z).toBeCloseTo(z, 6)
}

function last<T>(xs: readonly T[]): T {
  return xs[xs.length - 1]!
}

describe('rollOrientations', () => {
  it('returns one orientation per point, starting at the identity', () => {
    const path = resample([{ x: 0, z: 0 }, { x: 1, z: 0 }], 0.1)
    const qs = rollOrientations(path, r)
    expect(qs).toHaveLength(path.length)
    expect(angleOf(qs[0]!)).toBe(0)
  })

  it('returns to the identity after rolling a straight line of length 2πr', () => {
    const path = resample([{ x: 0, z: 0 }, { x: 2 * Math.PI * r, z: 0 }], r / 50)
    expect(angleOf(last(rollOrientations(path, r)))).toBeCloseTo(0, 6)
  })

  it('rolls the top point forward', () => {
    const path: Point2[] = [{ x: 0, z: 0 }, { x: (Math.PI / 2) * r, z: 0 }]
    const top = new Vector3(0, 1, 0).applyQuaternion(last(rollOrientations(path, r)))
    expectVec(top, 1, 0, 0)
  })

  it('applies each step in world space (catches wrong multiplication order)', () => {
    const quarter = (Math.PI / 2) * r
    const path: Point2[] = [
      { x: 0, z: 0 },
      { x: quarter, z: 0 },
      { x: quarter, z: quarter },
    ]
    const d = last(downDirections(rollOrientations(path, r)))
    expectVec(d, 0, 0, 1) // the wrong order gives (1, 0, 0)
  })
})

describe('downDirections', () => {
  it('is straight down at the start and always a unit vector', () => {
    const path = resample([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }], 0.05)
    const ds = downDirections(rollOrientations(path, r))
    expectVec(ds[0]!, 0, -1, 0)
    for (const d of ds) expect(d.length()).toBeCloseTo(1, 9)
  })
})
