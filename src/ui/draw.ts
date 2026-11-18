import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Point2 } from '../math/path'
import type { Stage } from '../scene/setup'

export interface DrawCallbacks {
  /** Called on every pointer move while drawing, with all raw points so far. */
  onStroke?(points: readonly Point2[]): void
  /** Called when the pointer is released, with the complete raw stroke. */
  onFinish?(points: readonly Point2[]): void
}

export interface DrawInput {
  /** Turn drawing on or off (e.g. off while the trajectoid is rolling). */
  setEnabled(enabled: boolean): void
}

const FLOOR = new Plane(new Vector3(0, 1, 0), 0) // y = 0

/**
 * Freehand drawing on the floor. Pointer events cover mouse, touch and pen with the same code;
 * each screen position is turned into a floor point by casting a ray from the camera through it.
 */
export function createDrawInput(stage: Stage, callbacks: DrawCallbacks): DrawInput {
  const canvas = stage.renderer.domElement
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const hit = new Vector3()

  let enabled = true
  let activePointer: number | null = null
  let points: Point2[] = []

  /** Screen position → point on the floor, or null if the ray misses (e.g. above the horizon). */
  function toFloor(event: PointerEvent): Point2 | null {
    const rect = canvas.getBoundingClientRect()
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, stage.camera)
    return raycaster.ray.intersectPlane(FLOOR, hit) ? { x: hit.x, z: hit.z } : null
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!enabled || !event.isPrimary || event.button !== 0) return
    const p = toFloor(event)
    if (!p) return
    canvas.setPointerCapture(event.pointerId) // keep receiving moves even off the canvas
    activePointer = event.pointerId
    points = [p]
    callbacks.onStroke?.(points)
  })

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) return
    // Coalesced events include the in-between positions the browser batched into this frame,
    // which keeps fast strokes smooth.
    for (const e of event.getCoalescedEvents?.() ?? [event]) {
      const p = toFloor(e)
      if (p) points.push(p)
    }
    callbacks.onStroke?.(points)
  })

  function finish(event: PointerEvent) {
    if (event.pointerId !== activePointer) return
    activePointer = null
    callbacks.onFinish?.(points)
  }
  canvas.addEventListener('pointerup', finish)
  canvas.addEventListener('pointercancel', finish)

  return {
    setEnabled(value) {
      enabled = value
      if (!value) activePointer = null
    },
  }
}
