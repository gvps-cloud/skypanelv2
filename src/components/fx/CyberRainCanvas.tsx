import { useCallback, useEffect, useRef } from "react"

const CHARS = "01ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef@#$%&*+-=<>[]{}|/\\~^"
const CHAR_POOL_SIZE = CHARS.length
const FRAME_INTERVAL = 1000 / 30
const MIN_SPEED = 0.3
const MAX_SPEED = 1.2
const MIN_TRAIL = 6
const MAX_TRAIL = 22
const MOUSE_RADIUS = 12

const GLYPH_FONT = (cellSize: number) =>
  `${cellSize * 0.72}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`

interface Drop {
  y: number
  speed: number
  trail: number
  chars: number[]
}

function parsePrimaryFromCss(): { hue: number; saturation: number } {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
  const parts = raw.split(/\s+/)
  const h = Number.parseFloat(parts[0] ?? "")
  const s = Number.parseFloat(parts[1] ?? "")
  return {
    hue: Number.isFinite(h) ? h : 160,
    saturation: Number.isFinite(s) ? s : 50,
  }
}

function makeDrop(rows: number): Drop {
  const trail = MIN_TRAIL + Math.floor(Math.random() * (MAX_TRAIL - MIN_TRAIL))
  const chars: number[] = []
  for (let i = 0; i < rows + trail + 10; i++) {
    chars.push(Math.floor(Math.random() * CHAR_POOL_SIZE))
  }
  return {
    y: -(Math.random() * rows * 2) - trail,
    speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
    trail,
    chars,
  }
}

function initDrops(cols: number, rows: number): Drop[] {
  const drops: Drop[] = []
  for (let c = 0; c < cols; c++) {
    drops.push(makeDrop(rows))
  }
  return drops
}

interface CyberRainCanvasProps {
  className?: string
  cellSize?: number
  hue?: number
  reducedMotion?: boolean
  followCursor?: boolean
}

export default function CyberRainCanvas({
  className = "",
  cellSize = 14,
  hue: hueProp,
  reducedMotion = false,
  followCursor = false,
}: CyberRainCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const offscreenVisibleRef = useRef(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const dimsRef = useRef({ cols: 0, rows: 0, w: 0, h: 0 })
  const dropsRef = useRef<Drop[]>([])
  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion
  const followCursorRef = useRef(followCursor)
  followCursorRef.current = followCursor

  const cssHueRef = useRef(parsePrimaryFromCss().hue)
  const cssSaturationRef = useRef(parsePrimaryFromCss().saturation)

  const mouseColRef = useRef(-1)
  const mouseActiveRef = useRef(false)

  const resolveHue = useCallback(() => {
    if (typeof hueProp === "number" && Number.isFinite(hueProp)) return hueProp
    return cssHueRef.current
  }, [hueProp])

  const resolveSaturation = useCallback(() => {
    if (typeof hueProp === "number" && Number.isFinite(hueProp)) return 50
    return cssSaturationRef.current
  }, [hueProp])

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
    dropsRef.current = initDrops(cols, rows)
  }, [cellSize])

  useEffect(() => {
    const { hue, saturation } = parsePrimaryFromCss()
    cssHueRef.current = hue
    cssSaturationRef.current = saturation
  }, [])

  useEffect(() => {
    if (typeof hueProp === "number" && Number.isFinite(hueProp)) return
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      const { hue, saturation } = parsePrimaryFromCss()
      cssHueRef.current = hue
      cssSaturationRef.current = saturation
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
    if (!followCursor) return
    const container = containerRef.current
    if (!container) return

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const mx = event.clientX - rect.left
      mouseColRef.current = Math.floor(mx / cellSize)
      mouseActiveRef.current = true
    }

    const handlePointerLeave = () => {
      mouseActiveRef.current = false
      mouseColRef.current = -1
    }

    container.addEventListener("pointermove", handlePointerMove)
    container.addEventListener("pointerleave", handlePointerLeave)
    container.addEventListener("pointercancel", handlePointerLeave)

    return () => {
      container.removeEventListener("pointermove", handlePointerMove)
      container.removeEventListener("pointerleave", handlePointerLeave)
      container.removeEventListener("pointercancel", handlePointerLeave)
    }
  }, [cellSize, followCursor])

  // Reduced motion: static snapshot
  useEffect(() => {
    if (!reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { cols, rows, w, h } = dimsRef.current
    if (!cols || !rows) return

    ctx.font = GLYPH_FONT(cellSize)
    ctx.clearRect(0, 0, w, h)

    const hue = resolveHue()
    const saturation = resolveSaturation()
    const isDark = document.documentElement.classList.contains("dark")

    const drops = dropsRef.current
    for (let c = 0; c < cols; c++) {
      const drop = drops[c]
      if (!drop) continue
      for (let t = 0; t < drop.trail && t < rows; t++) {
        const row = rows - 1 - t
        if (row < 0) continue
        const fade = 1 - t / drop.trail
        const ch = drop.chars[row % drop.chars.length] ?? 0
        const lightness = isDark ? 40 + 40 * fade : 25 + 25 * fade
        const alpha = fade * 0.9
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
        ctx.fillText(CHARS[ch % CHAR_POOL_SIZE]!, c * cellSize, row * cellSize)
      }
    }
  }, [reducedMotion, resize, resolveHue, resolveSaturation, cellSize])

  // Animated rain loop
  useEffect(() => {
    if (reducedMotion) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const root = containerRef.current
    let lastTime = 0
    let accumulator = 0

    const draw = (timestamp: number) => {
      if (!offscreenVisibleRef.current) {
        rafRef.current = 0
        return
      }

      const delta = lastTime ? timestamp - lastTime : FRAME_INTERVAL
      lastTime = timestamp
      accumulator += delta

      if (accumulator < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      accumulator -= FRAME_INTERVAL

      const { cols, rows, w, h } = dimsRef.current
      if (!cols || !rows) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const hue = resolveHue()
      const saturation = resolveSaturation()
      const isDark = document.documentElement.classList.contains("dark")
      const mouseCol = mouseColRef.current
      const mouseNear = followCursorRef.current && mouseActiveRef.current

      ctx.font = GLYPH_FONT(cellSize)
      ctx.clearRect(0, 0, w, h)

      const drops = dropsRef.current

      for (let c = 0; c < cols; c++) {
        const drop = drops[c]
        if (!drop) continue

        const dist = mouseNear ? Math.abs(c - mouseCol) : MOUSE_RADIUS + 1
        const inRange = dist <= MOUSE_RADIUS
        const proximity = inRange ? 1 - dist / MOUSE_RADIUS : 0

        const speedMult = inRange ? 1 + proximity * 0.8 : 1
        drop.y += drop.speed * speedMult

        const trailLen = inRange
          ? Math.min(MAX_TRAIL + 6, drop.trail + Math.floor(proximity * 8))
          : drop.trail

        const headRow = Math.floor(drop.y)

        if (headRow - trailLen > rows) {
          drops[c] = makeDrop(rows)
          continue
        }

        for (let t = 0; t < trailLen; t++) {
          const row = headRow - t
          if (row < 0 || row >= rows) continue

          if (Math.random() < 0.08) {
            const ci = row % drop.chars.length
            if (ci >= 0 && ci < drop.chars.length) {
              drop.chars[ci] = Math.floor(Math.random() * CHAR_POOL_SIZE)
            }
          }

          const fade = 1 - t / trailLen
          const ch = drop.chars[row % drop.chars.length] ?? 0

          let lightness: number
          let alpha: number

          if (t === 0) {
            lightness = isDark ? 95 : 90
            alpha = 0.95 + proximity * 0.05
          } else {
            const baseLit = isDark ? 50 : 35
            const range = isDark ? 30 : 20
            lightness = baseLit + range * fade + proximity * 15
            alpha = fade * (0.7 + proximity * 0.25)
          }

          ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
          ctx.fillText(CHARS[ch % CHAR_POOL_SIZE]!, c * cellSize, row * cellSize)
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    let io: IntersectionObserver | undefined
    if (root) {
      io = new IntersectionObserver(
        (entries) => {
          const hit = entries[0]
          offscreenVisibleRef.current = hit ? hit.isIntersecting : true
          if (offscreenVisibleRef.current && rafRef.current === 0) {
            lastTime = 0
            rafRef.current = requestAnimationFrame(draw)
          }
        },
        { threshold: 0, rootMargin: "80px" },
      )
      io.observe(root)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      io?.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [reducedMotion, cellSize, resolveHue, resolveSaturation])

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
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
