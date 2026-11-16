import { Vector3 } from 'three'

/**
 * For one vertex of our initial sphere mesh, compute how far the surface can extend from the
 * centre in that vertex's direction without colliding with the floor at any point along the path.
 * The returned radius is in [r, R]: exactly r where the body touches the floor, R where nothing
 * was cut. See Sobolev et al. 2023, Methods, eq. 3.
 *
 * @param u - unit vector from the centre to the vertex
 * @param downDirs - the down direction at each sample along the path, as unit vectors from the centre
 * @param r - the core radius (height of the centre above the floor)
 * @param R - the radius of the outer sphere the shape is carved from
 */
export function carveRadius(u: Vector3, downDirs: readonly Vector3[], r: number, R: number): number {
  let radius = R
  for (const d of downDirs) {
    const dot = u.dot(d)
    if (dot > 0) radius = Math.min(radius, r / dot)
  }
  return radius
}

/**
 * Carve a mesh in place by moving each vertex out (or in) to the distance calculated by
 * `carveRadius`. Vertices are treated as directions from the origin, so the starting mesh can be
 * any sphere centred at the origin.
 *
 * @param positions - the mesh's vertex positions, as a flat array of xyz coordinates
 * @param downDirs - the down direction at each sample along the path, as unit vectors from the centre
 * @param r - the core radius (height of the centre above the floor)
 * @param R - the radius of the outer sphere the shape is carved from
 */
export function carveVertices(
  positions: Float32Array,
  downDirs: readonly Vector3[],
  r: number,
  R: number,
): void {
  const u = new Vector3()
  for (let v = 0; v < positions.length; v += 3) {
    u.fromArray(positions, v).normalize()
    u.multiplyScalar(carveRadius(u, downDirs, r, R)).toArray(positions, v)
  }
}
