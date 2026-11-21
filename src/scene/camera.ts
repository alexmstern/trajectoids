import { MathUtils, Vector3 } from 'three'
import type { Point2 } from '../math/path'
import type { Stage } from './setup'

const DRAW_AREA = 16 // world units visible across the shorter screen side while drawing
const VIEW_ELEVATION = MathUtils.degToRad(35) // angle above the floor for the ¾ view
const MOVE_SECONDS = 1.2

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
      // Bounding circle of the path, padded by the trajectoid's size.
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
      for (const p of points) {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minZ = Math.min(minZ, p.z)
        maxZ = Math.max(maxZ, p.z)
      }
      const center = new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
      const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 2 * R

      const distance = fitDistance(radius, camera.fov, camera.aspect)
      const offset = new Vector3(0, Math.sin(VIEW_ELEVATION), Math.cos(VIEW_ELEVATION)).multiplyScalar(distance)
      moveTo(center.clone().add(offset), center, instant)
    },
  }
  return rig
}
