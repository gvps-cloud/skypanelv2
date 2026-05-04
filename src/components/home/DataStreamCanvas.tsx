import { useCallback, useEffect, useRef } from "react"

const CHARS = "01ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef@#$%&*+-=<>[]{}|/\\~^"
const CHAR_POOL_SIZE = CHARS.length

const HOLD_MS = 3200
const FADE_MS = 950
const FLIP_BAND = 0.6
const FRAME_INTERVAL = 1000 / 60
const IDLE_SCRAMBLE_RATE = 0.08
const EASE_IN_BOUNDARY = 0.15
const EASE_OUT_BOUNDARY = 0.85

const GLYPH_FONT = (cellSize: number) =>
  `${cellSize * 0.72}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`

/** Lucide-style icon bodies (viewBox 0 0 24 24), white stroke on black filled in wrapLucideSvg */
const LUCIDE_SERVER = `<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>`

const LUCIDE_PANELS_TOP_LEFT = `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M3 9h18"/><path d="M9 21V9"/>`

const LUCIDE_EARTH = `<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/>`

const LUCIDE_SHIELD_CHECK = `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`

const LUCIDE_WALLET = `<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>`

const LUCIDE_ACTIVITY = `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>`

function wrapLucideSvg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512"><rect width="100%" height="100%" fill="#000000"/><g fill="none" stroke="#ffffff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`
}

type FrameDef =
  | { kind: "url"; src: string; scale: number }
  | { kind: "svg"; svg: string; scale: number }

const FRAMES: FrameDef[] = [
  { kind: "url", src: "/favicon.svg", scale: 0.78 },
  { kind: "svg", svg: wrapLucideSvg(LUCIDE_SERVER), scale: 0.7 },
  { kind: "svg", svg: wrapLucideSvg(LUCIDE_PANELS_TOP_LEFT), scale: 0.7 },
  { kind: "svg", svg: wrapLucideSvg(LUCIDE_EARTH), scale: 0.7 },
  { kind: "svg", svg: wrapLucideSvg(LUCIDE_SHIELD_CHECK), scale: 0.7 },
  { kind: "svg", svg: wrapLucideSvg(LUCIDE_WALLET), scale: 0.7 },
  { kind: "svg", svg: wrapLucideSvg(LUCIDE_ACTIVITY), scale: 0.7 },
]

function parsePrimaryHueFromCss(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
  const first = raw.split(/\s+/)[0] ?? ""
  const h = Number.parseFloat(first)
  return Number.isFinite(h) ? h : 160
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

function loadImageFromSvgString(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to decode SVG image"))
    }
    img.src = url
  })
}

function loadFrameImage(frame: FrameDef): Promise<HTMLImageElement> {
  if (frame.kind === "url") return loadImageFromUrl(frame.src)
  return loadImageFromSvgString(frame.svg)
}

function drawImageToMaskContext(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cols: number,
  rows: number,
  scale: number,
): void {
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, cols, rows)
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (iw <= 0 || ih <= 0) return
  const margin = 0.92 * scale
  const maxW = cols * margin
  const maxH = rows * margin
  const aspect = iw / ih
  let dw = maxW
  let dh = dw / aspect
  if (dh > maxH) {
    dh = maxH
    dw = dh * aspect
  }
  const ox = (cols - dw) / 2
  const oy = (rows - dh) / 2
  ctx.drawImage(img, 0, 0, iw, ih, ox, oy, dw, dh)
}

function sampleLuminanceMask(ctx: CanvasRenderingContext2D, cols: number, rows: number): Uint8Array {
  const { data } = ctx.getImageData(0, 0, cols, rows)
  const mask = new Uint8Array(cols * rows)
  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4
    const r = data[o] ?? 0
    const g = data[o + 1] ?? 0
    const b = data[o + 2] ?? 0
    const a = (data[o + 3] ?? 0) / 255
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    mask[i] = Math.min(255, Math.round(255 * lum * a))
  }
  return mask
}

function regenerateFlipMap(buf: Uint8Array): void {
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (Math.random() * 256) & 0xff
  }
}

interface DataStreamCanvasProps {
  className?: string
  cellSize?: number
  /** When set, overrides CSS `--primary` hue for glyph colours */
  hue?: number
  reducedMotion?: boolean
}

export default function DataStreamCanvas({
  className = "",
  cellSize = 14,
  hue: hueProp,
  reducedMotion = false,
}: DataStreamCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const dimsRef = useRef({ cols: 0, rows: 0, w: 0, h: 0 })
  const cellCharsRef = useRef<Uint8Array>(new Uint8Array(0))
  const flipMapRef = useRef<Uint8Array>(new Uint8Array(0))
  const masksRef = useRef<(Uint8Array | null)[]>(FRAMES.map(() => null))
  const bakeGenerationRef = useRef(0)
  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion

  const cssHueRef = useRef(parsePrimaryHueFromCss())
  const seqRef = useRef({
    phase: "hold" as "hold" | "fade",
    phaseStart: 0,
    currentIdx: 0,
    nextIdx: 1 % FRAMES.length,
  })

  const allMasksLoadedRef = useRef(false)

  const resolveHue = useCallback(() => {
    if (typeof hueProp === "number" && Number.isFinite(hueProp)) return hueProp
    return cssHueRef.current
  }, [hueProp])

  const initCellChars = useCallback((cols: number, rows: number) => {
    const n = cols * rows
    const next = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      next[i] = Math.floor(Math.random() * CHAR_POOL_SIZE) & 0xff
    }
    cellCharsRef.current = next
  }, [])

  const bakeAllMasks = useCallback(
    async (cols: number, rows: number, generation: number, staticCellSize: number) => {
      if (cols <= 0 || rows <= 0) return
      const work = document.createElement("canvas")
      work.width = cols
      work.height = rows
      const wctx = work.getContext("2d", { willReadFrequently: true })
      if (!wctx) return

      const results: Uint8Array[] = []
      try {
        for (let f = 0; f < FRAMES.length; f++) {
          if (generation !== bakeGenerationRef.current) return
          const frame = FRAMES[f]!
          const img = await loadFrameImage(frame)
          if (generation !== bakeGenerationRef.current) return
          drawImageToMaskContext(wctx, img, cols, rows, frame.scale)
          results.push(sampleLuminanceMask(wctx, cols, rows))
        }
      } catch {
        if (generation !== bakeGenerationRef.current) return
        return
      }

      if (generation !== bakeGenerationRef.current) return
      masksRef.current = results
      allMasksLoadedRef.current = true
      seqRef.current = {
        phase: "hold",
        phaseStart: performance.now(),
        currentIdx: 0,
        nextIdx: 1 % FRAMES.length,
      }

      if (reducedMotionRef.current) {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        drawStaticLogo(
          canvas,
          ctx,
          results[0] ?? null,
          cols,
          rows,
          staticCellSize,
          resolveHue(),
        )
      }
    },
    [resolveHue],
  )

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const dpr = window.devicePixelRatio || 1
    const w = parent.clientWidth
    const h = parent.clientHeight

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }

    const cols = Math.max(1, Math.floor(w / cellSize))
    const rows = Math.max(1, Math.floor(h / cellSize))

    dimsRef.current = { cols, rows, w, h }
    initCellChars(cols, rows)
    flipMapRef.current = new Uint8Array(cols * rows)
    regenerateFlipMap(flipMapRef.current)
    masksRef.current = FRAMES.map(() => null)
    allMasksLoadedRef.current = false
    bakeGenerationRef.current += 1
    const gen = bakeGenerationRef.current
    void bakeAllMasks(cols, rows, gen, cellSize)
  }, [bakeAllMasks, cellSize, initCellChars])

  useEffect(() => {
    cssHueRef.current = parsePrimaryHueFromCss()
  }, [])

  useEffect(() => {
    if (typeof hueProp === "number" && Number.isFinite(hueProp)) return
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      cssHueRef.current = parsePrimaryHueFromCss()
    })
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [hueProp])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resize()

    const observer = new ResizeObserver(() => resize())
    observer.observe(canvas.parentElement!)

    return () => observer.disconnect()
  }, [resize])

  useEffect(() => {
    if (!reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { cols, rows } = dimsRef.current
    const mask = masksRef.current[0]
    if (cols > 0 && rows > 0 && mask && mask.length === cols * rows) {
      drawStaticLogo(canvas, ctx, mask, cols, rows, cellSize, resolveHue())
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [reducedMotion, resize, resolveHue, cellSize])

  useEffect(() => {
    if (reducedMotion) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let lastTime = 0
    let accumulatedTime = 0

    const draw = (timestamp: number) => {
      const delta = timestamp - lastTime
      lastTime = timestamp
      accumulatedTime += delta
      
      if (accumulatedTime < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      accumulatedTime -= FRAME_INTERVAL

      const { cols, rows, w, h } = dimsRef.current
      const chars = cellCharsRef.current
      if (!cols || !rows || chars.length !== cols * rows) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const masks = masksRef.current
      const curMask = masks[seqRef.current.currentIdx]
      const nextMask = masks[seqRef.current.nextIdx]
      if (!curMask || curMask.length !== cols * rows) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const now = performance.now()
      const seq = seqRef.current
      const nm = nextMask && nextMask.length === cols * rows ? nextMask : curMask
      const nextMaskReady = nextMask && nextMask.length === cols * rows

      if (seq.phase === "hold") {
        if (now - seq.phaseStart >= HOLD_MS && allMasksLoadedRef.current) {
          if (nextMaskReady) {
            seq.phase = "fade"
            seq.phaseStart = now
            const flipBuf = flipMapRef.current
            if (flipBuf.length === cols * rows) {
              regenerateFlipMap(flipBuf)
            }
          } else {
            seq.phaseStart = now
          }
        }
      } else {
        const ft = (now - seq.phaseStart) / FADE_MS
        if (ft >= 1) {
          if (nextMaskReady) {
            seq.currentIdx = seq.nextIdx
            seq.nextIdx = (seq.currentIdx + 1) % FRAMES.length
          }
          seq.phase = "hold"
          seq.phaseStart = now
        }
      }

      const tLinear = seq.phase === "fade" ? Math.min(1, (now - seq.phaseStart) / FADE_MS) : 0
      
      // Apply ease-in at start and ease-out at end to eliminate popping
      let fadeT: number
      if (tLinear < EASE_IN_BOUNDARY) {
        // Ease-in: slow start
        const normalized = tLinear / EASE_IN_BOUNDARY
        fadeT = normalized * normalized * EASE_IN_BOUNDARY
      } else if (tLinear > EASE_OUT_BOUNDARY) {
        // Ease-out: slow end
        const normalized = (tLinear - EASE_OUT_BOUNDARY) / (1 - EASE_OUT_BOUNDARY)
        fadeT = EASE_OUT_BOUNDARY + (1 - EASE_OUT_BOUNDARY) * (1 - (1 - normalized) * (1 - normalized))
      } else {
        // Middle: smooth cubic interpolation
        const mid = (tLinear - EASE_IN_BOUNDARY) / (EASE_OUT_BOUNDARY - EASE_IN_BOUNDARY)
        fadeT = EASE_IN_BOUNDARY + (EASE_OUT_BOUNDARY - EASE_IN_BOUNDARY) * (mid * mid * (3 - 2 * mid))
      }

      const isDark = document.documentElement.classList.contains("dark")
      const hue = resolveHue()

      ctx.font = GLYPH_FONT(cellSize)
      ctx.clearRect(0, 0, w, h)

      const flipMap = flipMapRef.current
      const inFade = seq.phase === "fade"
      const halfBand = FLIP_BAND * 0.5
      const flipReady = flipMap.length === cols * rows

      let i = 0
      for (let r = 0; r < rows; r++) {
        const y = r * cellSize
        for (let c = 0; c < cols; c++) {
          const aByte = curMask[i]!
          const bByte = nm[i]!
          const a = aByte / 255
          const b = bByte / 255

          let m: number
          let scrambling = false

          if (!inFade || !flipReady) {
            m = a
          } else {
            const flip = flipMap[i]! / 255
            const lo = Math.max(0, flip - halfBand)
            const hi = Math.min(1, flip + halfBand)
            const x = hi > lo ? Math.min(1, (fadeT - lo) / (hi - lo)) : 1
            const s = x * x * (3 - 2 * x)
            m = a + (b - a) * s
            scrambling = true
          }

          if (scrambling || Math.random() < IDLE_SCRAMBLE_RATE) {
            chars[i] = Math.floor(Math.random() * CHAR_POOL_SIZE) & 0xff
          }

          const baseNoise = 0.06
          const litBoost = 0.85 * m
          let alpha = Math.min(0.98, baseNoise + litBoost)
          if (scrambling) alpha *= 0.82

          const lightnessDark = 50 + 25 * m
          const lightnessLight = 30 + 15 * m

          if (isDark) {
            ctx.fillStyle = `hsla(${hue}, 75%, ${lightnessDark}%, ${alpha})`
          } else {
            ctx.fillStyle = `hsla(${hue}, 60%, ${lightnessLight}%, ${alpha})`
          }
          ctx.fillText(CHARS[chars[i]! % CHAR_POOL_SIZE]!, c * cellSize, y)
          i++
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [reducedMotion, cellSize, resolveHue])

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          fontSize: `${cellSize * 0.72}px`,
          lineHeight: `${cellSize}px`,
          letterSpacing: "0.02em",
        }}
      />
    </div>
  )
}

function drawStaticLogo(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array | null,
  cols: number,
  rows: number,
  cellSize: number,
  hue: number,
): void {
  const { width, height } = canvas
  const dpr = window.devicePixelRatio || 1
  const w = width / dpr
  const h = height / dpr
  ctx.font = GLYPH_FONT(cellSize)
  ctx.clearRect(0, 0, w, h)
  if (!mask || mask.length !== cols * rows) return

  const isDark = document.documentElement.classList.contains("dark")
  let i = 0
  for (let r = 0; r < rows; r++) {
    const y = r * cellSize
    for (let c = 0; c < cols; c++) {
      const m = mask[i]! / 255
      const ch = CHARS[(i * 13 + 7) % CHAR_POOL_SIZE]!
      const baseNoise = 0.06
      const litBoost = 0.85 * m
      const alpha = Math.min(0.98, baseNoise + litBoost)
      const lightnessDark = 50 + 25 * m
      const lightnessLight = 30 + 15 * m
      if (isDark) {
        ctx.fillStyle = `hsla(${hue}, 75%, ${lightnessDark}%, ${alpha})`
      } else {
        ctx.fillStyle = `hsla(${hue}, 60%, ${lightnessLight}%, ${alpha})`
      }
      ctx.fillText(ch, c * cellSize, y)
      i++
    }
  }
}
