import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './style.css'
import { cleanPath, pathLength, tidyPath, truncatePath, type Point2 } from './math/path'
import { LOOP_PRESETS, sineWave } from './math/presets'
import { closedRoll } from './math/loops'
import { computeRoll, poseAt, radiusForSigma, type Roll } from './math/motion'
import { createCameraRig } from './scene/camera'
import { createPathLine, createTrajectoidMesh, disposeObject } from './scene/trajectoid'
import { createStage } from './scene/setup'
import { createDrawInput } from './ui/draw'
import type { Mesh, Object3D } from 'three'

const sigma = 1.5 // path length / core circumference; sets r for each drawn path
const outerRatio = 1.3 // R / r: outer sphere the shape is carved from (the paper uses 1.3)
const speed = 1.75 // world units per second
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
// `line` is the path as drawn on the floor; `looping` rolls around a closed loop with no pause.
let current: { line: Point2[]; roll: Roll; mesh: Mesh; R: number; looping: boolean } | null = null
let travelled = 0
let playing = true
let mode: 'draw' | 'view' = 'view'

function showPath(points: readonly Point2[]) {
  if (pathLine) disposeObject(pathLine)
  pathLine = points.length > 1 ? createPathLine(points, lineWidth) : null
  if (pathLine) stage.scene.add(pathLine)
}

/** Compute the trajectoid for an open path and start it rolling. */
function build(path: Point2[]) {
  const r = Math.min(Math.max(radiusForSigma(pathLength(path), sigma), minRadius), maxRadius)
  const roll = computeRoll(path, r)
  start(roll, roll.points, false)
}

/** Carve the trajectoid for a roll and start it rolling. */
function start(roll: Roll, line: Point2[], looping: boolean) {
  if (current) disposeObject(current.mesh)
  const R = outerRatio * roll.r
  const mesh = createTrajectoidMesh(roll.downDirs, roll.r, R, stage.environment)
  stage.scene.add(mesh)
  current = { line, roll, mesh, R, looping }
  travelled = 0
  showPath(line)
}

stage.onFrame((dt) => {
  if (!current) return
  if (playing) travelled += speed * dt
  if (current.looping) travelled %= current.roll.length // seamless: the end pose is the start pose
  else if (travelled > current.roll.length + speed * pauseAtEnd) travelled = 0
  poseAt(current.roll, travelled, current.mesh.position, current.mesh.quaternion)
})

// --- Modes: drawing (overhead, drag draws) and viewing (tilted, fixed camera) ---------------------
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
  rig.toOverhead()
  ui.drawButton.textContent = 'Cancel'
  ui.playButton.disabled = true
}

function enterViewMode(instant = false) {
  if (!current) return
  mode = 'view'
  stage.scene.add(current.mesh)
  showPath(current.line)
  drawInput.setEnabled(false)
  rig.toPath(current.line, current.R, instant)
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

// --- Start-up ------------------------------------------------------------------------------------
// ?loop=heart|eight|oval shows a closed loop rolling forever (see math/loops.ts) instead of the wave.
const preset = LOOP_PRESETS[new URLSearchParams(location.search).get('loop') ?? '']
const loop = preset?.path()
const loopRoll = preset && loop && closedRoll(loop, preset.laps, preset.minSigma)

if (loop && loopRoll) start(loopRoll, loop, true)
else build(sineWave(10, 2, 1.5)) // example on first load: a wave rolling toward the viewer
enterViewMode(true)
