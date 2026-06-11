'use client'

import { useCallback, useRef, useState, type CSSProperties, type RefObject } from 'react'

const ZOOM_SCALE = 2.5

export function useInlineImageZoom(containerRef: RefObject<HTMLElement | null>) {
  const [zoomActive, setZoomActive] = useState(false)
  const [originX, setOriginX] = useState(50)
  const [originY, setOriginY] = useState(50)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)

  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastPanRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)

  const updateOriginFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      setOriginX(Math.max(0, Math.min(100, x)))
      setOriginY(Math.max(0, Math.min(100, y)))
    },
    [containerRef],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    lastPanRef.current = { x: e.clientX, y: e.clientY }
    isPanningRef.current = false
    setIsPanning(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!zoomActive) return

      const dx = e.clientX - lastPanRef.current.x
      const dy = e.clientY - lastPanRef.current.y
      lastPanRef.current = { x: e.clientX, y: e.clientY }

      if (!isPanningRef.current && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        isPanningRef.current = true
        setIsPanning(true)
      }
      if (!isPanningRef.current) return

      setPanX((prev) => prev + dx)
      setPanY((prev) => prev + dy)
    },
    [zoomActive],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = pointerStartRef.current
      if (!start) return

      const dx = Math.abs(e.clientX - start.x)
      const dy = Math.abs(e.clientY - start.y)
      const dt = Date.now() - start.time
      const isTap = dx < 10 && dy < 10 && dt < 300

      if (isPanningRef.current) {
        isPanningRef.current = false
        setIsPanning(false)
        pointerStartRef.current = null
        return
      }

      if (isTap) {
        if (zoomActive) {
          setZoomActive(false)
          setPanX(0)
          setPanY(0)
        } else {
          updateOriginFromEvent(e.clientX, e.clientY)
          setZoomActive(true)
        }
      }

      pointerStartRef.current = null
    },
    [zoomActive, updateOriginFromEvent],
  )

  const onPointerCancel = useCallback(() => {
    isPanningRef.current = false
    setIsPanning(false)
    pointerStartRef.current = null
  }, [])

  const resetZoom = useCallback(() => {
    isPanningRef.current = false
    setZoomActive(false)
    setIsPanning(false)
    setPanX(0)
    setPanY(0)
    setOriginX(50)
    setOriginY(50)
    pointerStartRef.current = null
  }, [])

  const imageStyle: CSSProperties = {
    transform: zoomActive
      ? `scale(${ZOOM_SCALE}) translate(${panX / ZOOM_SCALE}px, ${panY / ZOOM_SCALE}px)`
      : 'scale(1)',
    transformOrigin: `${originX}% ${originY}%`,
    transition: isPanning ? 'none' : 'transform 300ms ease',
  }

  return {
    imageStyle,
    zoomActive,
    isPanning,
    resetZoom,
    containerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style: {
        touchAction: zoomActive ? ('none' as const) : ('manipulation' as const),
      },
    },
  }
}
