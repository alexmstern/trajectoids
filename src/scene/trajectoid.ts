import {
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'
import type { Point2 } from '../math/path'
import { carveVertices } from '../math/shape'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

const PATH_HEIGHT = 0.004 // just above the floor, to avoid flickering
const CREASE_ANGLE = MathUtils.degToRad(35)

/**
 * Build the trajectoid mesh. `detail` is the icosphere subdivision level.
 */
export function createTrajectoidMesh(downDirs: readonly Vector3[], r: number, R: number, detail = 40): Mesh {
  const sphere = new IcosahedronGeometry(1, detail)
  carveVertices(sphere.getAttribute('position').array as Float32Array, downDirs, r, R)

  // Smooth shading across shallow angles (hides the triangle facets) while keeping edges sharper
  // than CREASE_ANGLE crisp (the ridges where a cut meets the sphere).
  const geometry = toCreasedNormals(sphere, CREASE_ANGLE)
  sphere.dispose()
  geometry.computeBoundingSphere()

  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: 0xccd0f4, roughness: 0.6 }))
  mesh.castShadow = true
  return mesh
}

/**
 * The path drawn on the floor, with a dot at each end.
 */
export function createPathLine(points: readonly Point2[], width: number): Group {
  const material = new MeshBasicMaterial({ color: 0x7b1e30, side: DoubleSide })
  const group = new Group()
  group.add(new Mesh(createRibbonGeometry(points, width), material))

  const first = points[0]
  const last = points[points.length - 1]
  if (first && last) {
    group.add(createDot(first, width, material)) // start and end markers: twice the ribbon width
    group.add(createDot(last, width, material))
  }
  return group
}

/** A flat disc lying on the floor at point p. */
function createDot(p: Point2, radius: number, material: MeshBasicMaterial): Mesh {
  const dot = new Mesh(new CircleGeometry(radius, 32), material)
  dot.rotation.x = -Math.PI / 2 // CircleGeometry faces +z; lay it flat on the floor
  dot.position.set(p.x, PATH_HEIGHT, p.z)
  return dot
}

/** Triangle strip following the path, `width` wide. */
function createRibbonGeometry(points: readonly Point2[], width: number): BufferGeometry {
  const half = width / 2
  const y = PATH_HEIGHT
  const vertices: number[] = []
  const indices: number[] = []

  points.forEach((p, i) => {
    // Direction of travel at this point, from its neighbours.
    const prev = points[Math.max(i - 1, 0)]!
    const next = points[Math.min(i + 1, points.length - 1)]!
    const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1
    // Sideways (perpendicular) offset in the floor plane.
    const sx = (-(next.z - prev.z) / len) * half
    const sz = ((next.x - prev.x) / len) * half

    vertices.push(p.x + sx, y, p.z + sz, p.x - sx, y, p.z - sz)
    if (i > 0) {
      const a = 2 * (i - 1) // left/right vertices of the previous point
      const b = 2 * i // left/right vertices of this point
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  return geometry
}

/** Remove an object from its parent and free its GPU resources (geometries and materials). */
export function disposeObject(object: Object3D): void {
  object.removeFromParent()
  object.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((m) => m.dispose())
    }
  })
}
