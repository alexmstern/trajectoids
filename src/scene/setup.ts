import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export interface Stage {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  /** Register a per-frame callback; receives seconds since the last frame. */
  onFrame(callback: (dt: number) => void): void
}

/** Renderer, camera, lights and a floor at y = 0. */
export function createStage(container: HTMLElement): Stage {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  const background = new Color(0xf2f1ef)
  scene.background = background
  scene.fog = new Fog(background, 30, 90) // fade the floor into the background with distance

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2 - 0.05 // don't let the camera go under the floor

  scene.add(new HemisphereLight(0xffffff, 0xb3afa9, 1.2))
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.set(5, 12, 4)
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 })
  scene.add(sun)

  const floor = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: 0xe2e0dc }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const callbacks: ((dt: number) => void)[] = []
  let previous = performance.now()
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - previous) / 1000, 0.1) // clamp after tab switches
    previous = now
    for (const cb of callbacks) cb(dt)
    controls.update()
    renderer.render(scene, camera)
  })

  return { scene, camera, renderer, controls, onFrame: (cb) => callbacks.push(cb) }
}
