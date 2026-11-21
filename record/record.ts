// Renders a loop preset with no background (just the path, the trajectoid and optionally its shadow),
// one exact frame at a time, so capture.mjs can turn the frames into a seamless animation.
// URL: record/?loop=heart&w=600&h=600
import { Mesh, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, WebGLRenderer } from 'three'
import { closedRoll } from '../src/math/loops'
import { poseAt } from '../src/math/motion'
import { LOOP_PRESETS } from '../src/math/presets'
import { framePath } from '../src/scene/camera'
import { addLights, createEnvironment } from '../src/scene/setup'
import { createPathLine, createTrajectoidMesh } from '../src/scene/trajectoid'

const OUTER_RATIO = 1.3 // R / r, as on the site
const LINE_WIDTH = 0.12 // as on the site
const SHADOW_OPACITY = 0.25

const PADDING = 12 // transparent pixels kept around the cropped animation

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

declare global {
  interface Window {
    /** Smallest rectangle (plus padding) containing every drawn pixel over `frames` frames. */
    measure?: (frames: number) => Rect
    /** Render the pose at fraction `t` ∈ [0, 1) of one cycle, cropped to `crop`; returns a PNG data URL. */
    renderFrame?: (t: number, shadow: boolean, crop: Rect) => string
    /** Laps in one seamless cycle. */
    laps?: number
  }
}

const params = new URLSearchParams(location.search)
const name = params.get('loop') ?? 'heart'
const width = Number(params.get('w') ?? 720)
const height = Number(params.get('h') ?? 480)

const preset = LOOP_PRESETS[name]
if (!preset) throw new Error(`Unknown loop "${name}"`)
// Optional overrides, for trying out variations: &laps= and &min= (σ to search from).
const laps = Number(params.get('laps') ?? preset.laps)
const minSigma = Number(params.get('min') ?? preset.minSigma)
const loop = preset.path()
const solved = closedRoll(loop, laps, minSigma)
if (!solved) throw new Error(`No seamless radius for "${name}"`)
const roll = solved
const R = OUTER_RATIO * roll.r

// preserveDrawingBuffer lets toDataURL read the frame after rendering; clear alpha 0 = transparent.
const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(width, height)
renderer.setClearColor(0x000000, 0)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const scene = new Scene()
addLights(scene)

// An invisible floor that only shows the shadow falling on it.
const shadowCatcher = new Mesh(new PlaneGeometry(400, 400), new ShadowMaterial({ opacity: SHADOW_OPACITY }))
shadowCatcher.rotation.x = -Math.PI / 2
shadowCatcher.receiveShadow = true
scene.add(shadowCatcher)

const mesh = createTrajectoidMesh(roll.downDirs, roll.r, R, createEnvironment(renderer))
scene.add(mesh, createPathLine(loop, LINE_WIDTH))

const camera = new PerspectiveCamera(45, width / height, 0.1, 300)
const { position, target } = framePath(loop, R, camera.fov, camera.aspect)
camera.position.copy(position)
camera.lookAt(target)

function draw(t: number, shadow: boolean) {
  shadowCatcher.visible = shadow
  poseAt(roll, t * roll.length, mesh.position, mesh.quaternion)
  renderer.render(scene, camera)
}

window.measure = (frames) => {
  const gl = renderer.getContext()
  const pixels = new Uint8Array(width * height * 4)
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let i = 0; i < frames; i++) {
    draw(i / frames, true)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] === 0) continue
        const top = height - 1 - y // readPixels rows start at the bottom
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, top)
        maxY = Math.max(maxY, top)
      }
  }
  const x = Math.max(0, minX - PADDING)
  const y = Math.max(0, minY - PADDING)
  return { x, y, width: Math.min(width, maxX + PADDING + 1) - x, height: Math.min(height, maxY + PADDING + 1) - y }
}

window.laps = laps

const cropped = document.createElement('canvas')
window.renderFrame = (t, shadow, crop) => {
  draw(t, shadow)
  cropped.width = crop.width
  cropped.height = crop.height
  cropped.getContext('2d')!.drawImage(renderer.domElement, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return cropped.toDataURL('image/png')
}
