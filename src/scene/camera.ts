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
  toOverhead(): void
  /** Tilted view framing the path and a trajectoid of outer radius R. */
  toPath(points: readonly Point2[], R: number, instant?: boolean): void
}

/** Smooth camera moves between the overhead drawing view and the ¾ viewing angle. */
export function createCameraRig(stage: Stage): CameraRig {
  const { camera, controls } = stage
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
    controls.target.lerpVectors(fromTarget, toTarget, t)
  })

  function moveTo(position: Vector3, target: Vector3, instant = false) {
    fromPos.copy(camera.position)
    fromTarget.copy(controls.target)
    toPos.copy(position)
    toTarget.copy(target)
    progress = 0
    if (instant) {
      camera.position.copy(position)
      controls.target.copy(target)
      progress = 1
    }
  }

  return {
    toOverhead() {
      const height = fitDistance(DRAW_AREA / 2, camera.fov, camera.aspect)
      // The tiny z offset keeps OrbitControls from flipping when looking exactly straight down.
      moveTo(new Vector3(0, height, 0.001), new Vector3(0, 0, 0))
    },

    toPath(points, R, instant = false) {
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
}
