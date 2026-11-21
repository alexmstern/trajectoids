import { MathUtils, Vector3 } from 'three'
import type { Point2 } from '../math/path'
import type { Stage } from './setup'

const DRAW_AREA = 16 // world units visible across the shorter screen side while drawing
const VIEW_ELEVATION = MathUtils.degToRad(35) // angle above the floor for the ¾ view
const MOVE_SECONDS = 1.2
const MARGIN = 0.85 // fraction of the screen the framed path may fill, leaving room for the UI

/**
 * Distance at which a sphere of `radius` fits on screen for a camera with vertical field of view
 * `vfovDeg` and the given aspect ratio. Uses whichever of the horizontal/vertical FOV is
 * narrower, so tall phone screens zoom out enough.
 */
export function fitDistance(radius: number, vfovDeg: number, aspect: number): number {
  const halfV = MathUtils.degToRad(vfovDeg) / 2
  const halfH = Math.atan(Math.tan(halfV) * aspect)
  return radius / Math.sin(Math.min(halfV, halfH))
}

/**
 * Distance from `center` along unit direction `dir` (pointing from the target to the camera) at which
 * every corner of the box [min, max] is on screen, filling at most `margin` of it in each direction.
 * For each corner, depth along the view axis is (distance − along), so it fits horizontally when
 * |sideways| ≤ (distance − along)·tan(halfH)·margin, and likewise vertically.
 */
export function fitBoxDistance(
  min: Vector3,
  max: Vector3,
  center: Vector3,
  dir: Vector3,
  vfovDeg: number,
  aspect: number,
  margin = MARGIN,
): number {
  const right = new Vector3(0, 1, 0).cross(dir).normalize()
  const up = dir.clone().cross(right)
  const tanV = Math.tan(MathUtils.degToRad(vfovDeg) / 2) * margin
  const tanH = tanV * aspect
  const p = new Vector3()
  let distance = 0
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      for (const z of [min.z, max.z]) {
        p.set(x, y, z).sub(center)
        const along = p.dot(dir)
        distance = Math.max(distance, along + Math.abs(p.dot(right)) / tanH, along + Math.abs(p.dot(up)) / tanV)
      }
  return distance
}

/** Camera position and look-at point for the ¾ view framing a path and a trajectoid of outer radius R. */
export function framePath(points: readonly Point2[], R: number, vfovDeg: number, aspect: number) {
  // Bounding box of the path, padded by the trajectoid's size (it rolls up to R beside the path's
  // ends and stands up to 2R tall).
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  const min = new Vector3(minX - R, 0, minZ - R)
  const max = new Vector3(maxX + R, 2 * R, maxZ + R)
  const target = new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const dir = new Vector3(0, Math.sin(VIEW_ELEVATION), Math.cos(VIEW_ELEVATION))
  const distance = fitBoxDistance(min, max, target, dir, vfovDeg, aspect)
  return { position: target.clone().addScaledVector(dir, distance), target }
}

export interface CameraRig {
  /** Look straight down at the drawing area. */
  toOverhead(instant?: boolean): void
  /** Tilted view framing the path and a trajectoid of outer radius R. */
  toPath(points: readonly Point2[], R: number, instant?: boolean): void
}

/**
 * The camera is fixed (no user orbit/zoom): it moves smoothly between the overhead drawing view
 * and a ¾ view framed on the current path, and re-frames itself when the window is resized.
 */
export function createCameraRig(stage: Stage): CameraRig {
  const { camera } = stage
  const target = new Vector3() // the point the camera looks at
  const fromPos = new Vector3()
  const fromTarget = new Vector3()
  const toPos = new Vector3()
  const toTarget = new Vector3()
  let progress = 1 // 1 = not moving

  stage.onFrame((dt) => {
    if (progress >= 1) return
    progress = Math.min(1, progress + dt / MOVE_SECONDS)
    const t = progress * progress * (3 - 2 * progress) // smoothstep: ease in and out
    camera.position.lerpVectors(fromPos, toPos, t)
    target.lerpVectors(fromTarget, toTarget, t)
    camera.lookAt(target)
  })

  function moveTo(position: Vector3, lookAt: Vector3, instant = false) {
    fromPos.copy(camera.position)
    fromTarget.copy(target)
    toPos.copy(position)
    toTarget.copy(lookAt)
    progress = 0
    if (instant) {
      camera.position.copy(position)
      target.copy(toTarget)
      camera.lookAt(target)
      progress = 1
    }
  }

  // Re-apply the current view when the screen size changes (e.g. rotating a phone).
  let currentView: (instant: boolean) => void = () => {}
  window.addEventListener('resize', () => currentView(true))

  const rig: CameraRig = {
    toOverhead(instant = false) {
      currentView = rig.toOverhead
      const height = fitDistance(DRAW_AREA / 2, camera.fov, camera.aspect)
      // The tiny z offset avoids looking exactly straight down, where lookAt's "up" is undefined.
      moveTo(new Vector3(0, height, 0.001), new Vector3(0, 0, 0), instant)
    },

    toPath(points, R, instant = false) {
      currentView = (now) => rig.toPath(points, R, now)
      const { position, target: lookAt } = framePath(points, R, camera.fov, camera.aspect)
      moveTo(position, lookAt, instant)
    },
  }
  return rig
}
