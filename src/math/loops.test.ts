import { describe, expect, it } from 'vitest'
import { closedRoll, closingSigma } from './loops'
import { figureEight, heart, lobedOval } from './presets'
import { carveRadius } from './shape'

describe('closedRoll', () => {
  for (const [name, loop] of [
    ['heart', heart(10)],
    ['figure eight', figureEight(10)],
    ['lobed oval', lobedOval(16, 7)],
  ] as const) {
    for (const laps of [2, 3]) {
      it(`${name}: ${laps} laps return the ball to its starting orientation`, () => {
        const roll = closedRoll(loop, laps)!
        expect(roll).not.toBeNull()
        const end = roll.orientations.at(-1)!
        expect(Math.abs(end.w)).toBeCloseTo(1, 6) // identity (q and −q are the same rotation)

        // ...but not after one lap: it is a turn of 360°·k/laps, i.e. |w| = |cos(180°·k/laps)| < 1.
        const lapEnd = roll.orientations[(roll.orientations.length - 1) / laps]!
        expect(Math.abs(lapEnd.w)).toBeLessThan(0.99)
      })
    }
  }

  it('the carved shape still touches the floor at every contact point', () => {
    const roll = closedRoll(heart(10))!
    const R = 1.3 * roll.r
    for (const d of roll.downDirs) {
      expect(carveRadius(d, roll.downDirs, roll.r, R)).toBeCloseTo(roll.r, 9)
    }
  })

  it('finds no closing radius on a straight out-and-back line within a narrow range', () => {
    // Out and back along a line: the two halves cancel, so every lap is already the identity,
    // which is excluded (it is the trivial solution, not a sign change).
    const line = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 0, z: 0 }]
    expect(closingSigma(line, 2, 1, 1.2)).toBeNull()
  })
})

