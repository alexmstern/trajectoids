// Renders each loop to an animated WebP and a GIF in record/out/.
//
//   npm run record              # all presets
//   npm run record -- heart     # just one
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const FPS = 20
const LAP_SECONDS = 7 // time for one lap around the loop; sets the rolling speed
// Render size in pixels (the output is cropped to what's drawn, so it ends up smaller).
const SETTINGS = {
  heart: { width: 1100, height: 1100 },
  eight: { width: 1700, height: 900 },
  oval: { width: 1600, height: 800 },
}

const outDir = join(import.meta.dirname, 'out')
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SETTINGS)
await mkdir(outDir, { recursive: true })

const server = await createServer({ root: join(import.meta.dirname, '..'), logLevel: 'error', server: { port: 0 } })
await server.listen()
const base = server.resolvedUrls.local[0] // includes the /trajectoids/ base path
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

try {
  for (const name of names) {
    const settings = SETTINGS[name]
    if (!settings) throw new Error(`Unknown loop "${name}". Options: ${Object.keys(SETTINGS).join(', ')}`)
    const { width, height } = settings

    const page = await browser.newPage({ viewport: { width, height } })
    page.on('pageerror', (e) => console.error(e))
    await page.goto(`${base}record/?loop=${name}&w=${width}&h=${height}`)
    await page.waitForFunction(() => window.renderFrame)
    const laps = await page.evaluate(() => window.laps)
    const frames = Math.round(FPS * LAP_SECONDS * laps) // one seamless cycle
    const crop = await page.evaluate((n) => window.measure(n), frames)
    console.log(`${name}: ${crop.width}×${crop.height} px, ${frames} frames (${frames / FPS} s)`)

    for (const shadow of [true, false]) {
      const dir = await mkdtemp(join(tmpdir(), `trajectoid-${name}-`))
      for (let i = 0; i < frames; i++) {
        // Frame i shows t = i / frames, so the frame after the last one is t = 1 = t = 0: seamless.
        const url = await page.evaluate(([t, s, c]) => window.renderFrame(t, s, c), [i / frames, shadow, crop])
        await writeFile(join(dir, `${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'))
        process.stdout.write(`\r${name} ${shadow ? 'webp' : 'gif '} frame ${i + 1}/${frames}`)
      }
      process.stdout.write('\n')

      if (shadow) {
        const files = (await readdir(dir)).sort().map((f) => join(dir, f))
        const delay = String(Math.round(1000 / FPS))
        execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', '85', '-d', delay, ...files, '-o', join(outDir, `${name}.webp`)], { stdio: 'ignore' })
      } else {
        // One shared palette with a transparent slot; pixels under 50% opacity become transparent.
        const filter = 'split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128'
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%04d.png'), '-filter_complex', filter, '-loop', '0', join(outDir, `${name}.gif`)])
      }
      await rm(dir, { recursive: true })
    }
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
