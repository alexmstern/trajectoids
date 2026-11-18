import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './style.css'
import { cleanPath, pathLength, tidyPath, truncatePath, type Point2 } from './math/path'
import { lShape } from './math/presets'
import { computeRoll, poseAt, radiusForSigma, type Roll } from './math/motion'
import { createCameraRig } from './scene/camera'
import { createPathLine, createTrajectoidMesh, disposeObject } from './scene/trajectoid'
import { createStage } from './scene/setup'
import { createDrawInput } from './ui/draw'
import type { Mesh, Object3D } from 'three'

const sigma = 1.5 // path length / core circumference; sets r for each drawn path
const outerRatio = 1.3 // R / r: outer sphere the shape is carved from (the paper uses 1.3)
const speed = 1.5 // world units per second
const pauseAtEnd = 1 // seconds before restarting
const lineWidth = 0.12 // world units
const drawSpacing = 0.05 // spacing of the tidied drawn path, in world units
const minPathLength = 1 // ignore taps and tiny scribbles
const maxPathLength = 40 // strokes stop growing here, which keeps builds fast
const minRadius = 0.3 // keep the shape from being a speck on short paths…
const maxRadius = 1.5 // …or enormous on long ones (long paths then get more turns instead)

const stage = createStage(document.querySelector<HTMLDivElement>('#viewport')!)
const rig = createCameraRig(stage)

const ui = {
  drawButton: document.querySelector<HTMLButtonElement>('#draw-button')!,
  playButton: document.querySelector<HTMLButtonElement>('#play-button')!,
}

const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>',
}

// --- Current build: the path line, the trajectoid, and its roll ----------------------------------
let pathLine: Object3D | null = null
let current: { path: Point2[]; roll: Roll; mesh: Mesh; R: number } | null = null
let travelled = 0
let playing = true
let mode: 'draw' | 'view' = 'view'

function showPath(points: readonly Point2[]) {
  if (pathLine) disposeObject(pathLine)
  pathLine = points.length > 1 ? createPathLine(points, lineWidth) : null
  if (pathLine) stage.scene.add(pathLine)
}

/** Compute the trajectoid for a path and start it rolling. */
function build(path: Point2[]) {
  if (current) disposeObject(current.mesh)
  const r = Math.min(Math.max(radiusForSigma(pathLength(path), sigma), minRadius), maxRadius)
  const R = outerRatio * r
  const roll = computeRoll(path, r)
  const mesh = createTrajectoidMesh(roll.downDirs, r, R)
  stage.scene.add(mesh)
  current = { path, roll, mesh, R }
  travelled = 0
  showPath(roll.points)
}

stage.onFrame((dt) => {
  if (!current) return
  if (playing) travelled += speed * dt
  if (travelled > current.roll.length + speed * pauseAtEnd) travelled = 0
  poseAt(current.roll, travelled, current.mesh.position, current.mesh.quaternion)
})

// --- Modes: drawing (overhead, drag draws) and viewing (tilted, drag orbits) ----------------------
const drawInput = createDrawInput(stage, {
  onStroke: (raw) => showPath(truncatePath(cleanPath(raw, drawSpacing / 4), maxPathLength)),
  onFinish: (raw) => {
    const path = tidyPath(truncatePath(raw, maxPathLength), drawSpacing)
    if (pathLength(path) < minPathLength) return showPath([]) // too short: keep drawing
    build(path)
    enterViewMode()
  },
})

function enterDrawMode() {
  mode = 'draw'
  current?.mesh.removeFromParent() // hidden until a new path is drawn (or the user cancels)
  showPath([])
  drawInput.setEnabled(true)
  stage.controls.enabled = false
  rig.toOverhead()
  ui.drawButton.textContent = 'Cancel'
  ui.playButton.disabled = true
}

function enterViewMode(instant = false) {
  if (!current) return
  mode = 'view'
  stage.scene.add(current.mesh)
  showPath(current.roll.points)
  drawInput.setEnabled(false)
  stage.controls.enabled = true
  rig.toPath(current.roll.points, current.R, instant)
  ui.drawButton.textContent = 'Draw'
  ui.playButton.disabled = false
}

// "Draw" in view mode; "Cancel" (back to the previous shape) in draw mode.
ui.drawButton.addEventListener('click', () => (mode === 'view' ? enterDrawMode() : enterViewMode()))

/** Show the icon for what the button will do: pause while playing, play while paused. */
function updatePlayButton() {
  ui.playButton.innerHTML = playing ? ICONS.pause : ICONS.play
  ui.playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play')
}

ui.playButton.addEventListener('click', () => {
  playing = !playing
  updatePlayButton()
})
updatePlayButton()

// Example on first load, so the page isn't empty. With r set from σ, each leg is σ/2 = 0.75 turns.
build(lShape(6))
enterViewMode(true)
