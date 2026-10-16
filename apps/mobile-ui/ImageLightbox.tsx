import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const clampZoom = (scale: number) => Math.max(1, Math.min(4, scale))
export const canDismissImage = (scale: number, startScroll: number, dx: number, dy: number) => scale === 1 && startScroll <= 0 && dy > 100 && dy > Math.abs(dx) * 1.3
export function ImageLightbox({ source, close }: { source: string; close: () => void }) {
  const viewport = useRef<HTMLDivElement>(null), image = useRef<HTMLImageElement>(null), button = useRef<HTMLButtonElement>(null)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0, pull: 0 })
  const [gesturing, setGesturing] = useState(false), [closing, setClosing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const dismiss = useCallback(() => {
    if (timer.current) return
    setClosing(true)
    timer.current = setTimeout(close, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200)
  }, [close])
  const dismissRef = useRef(dismiss); dismissRef.current = dismiss
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; button.current?.focus()
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') dismissRef.current(); if (event.key === 'Tab') { event.preventDefault(); button.current?.focus() } }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); clearTimeout(timer.current); previous?.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    const view = viewport.current!, img = image.current!
    let value = { scale: 1, x: 0, y: 0, pull: 0 }
    let lastDx = 0
    let start = { ...value, px: 0, py: 0, distance: 0, scroll: 0, cx: 0, cy: 0, pinch: false }
    const point = (touches: TouchList) => ({ x: (touches[0].clientX + (touches[1]?.clientX ?? touches[0].clientX)) / 2, y: (touches[0].clientY + (touches[1]?.clientY ?? touches[0].clientY)) / 2 })
    const distance = (touches: TouchList) => touches.length > 1 ? Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY) : 0
    const commit = (next: typeof value) => { value = next; setTransform(next) }
    const bounded = (scale: number, x: number, y: number) => {
      if (scale === 1) return { scale, x: 0, y: 0, pull: 0 }
      const bounds = img.getBoundingClientRect(), frame = view.getBoundingClientRect()
      const cx = (bounds.left + bounds.right) / 2 - value.x, cy = (bounds.top + bounds.bottom) / 2 - value.y
      const width = bounds.width / value.scale * scale, height = bounds.height / value.scale * scale
      return { scale, x: width > frame.width ? Math.max(frame.right - cx - width / 2, Math.min(frame.left - cx + width / 2, x)) : 0, y: height > frame.height ? Math.max(frame.bottom - cy - height / 2, Math.min(frame.top - cy + height / 2, y)) : 0, pull: 0 }
    }
    const begin = (event: TouchEvent) => {
      if (!event.touches.length) return
      const p = point(event.touches), bounds = img.getBoundingClientRect()
      lastDx = 0
      start = { ...value, px: p.x, py: p.y, distance: distance(event.touches), scroll: view.scrollTop, cx: (bounds.left + bounds.right) / 2 - value.x, cy: (bounds.top + bounds.bottom) / 2 - value.y, pinch: event.touches.length > 1 }
      if (start.pinch || value.scale > 1) { event.preventDefault(); setGesturing(true) }
    }
    const move = (event: TouchEvent) => {
      if (!event.touches.length) return
      const p = point(event.touches), dx = p.x - start.px, dy = p.y - start.py
      lastDx = dx
      if (event.touches.length > 1) {
        event.preventDefault(); setGesturing(true)
        if (!start.pinch) { begin(event); return }
        const scale = clampZoom(start.scale * distance(event.touches) / Math.max(1, start.distance)), ratio = scale / start.scale
        commit(bounded(scale, p.x - start.cx - (start.px - start.cx - start.x) * ratio, p.y - start.cy - (start.py - start.cy - start.y) * ratio))
      } else if (value.scale > 1) { event.preventDefault(); commit(bounded(value.scale, start.x + dx, start.y + dy)) }
      else if (!start.pinch && start.scroll <= 0 && dy > 0 && dy > Math.abs(dx) * 1.3) { event.preventDefault(); setGesturing(true); commit({ ...value, pull: dy }) }
    }
    const end = (event: TouchEvent) => {
      if (event.touches.length) { begin(event); return }
      setGesturing(false)
      if (!start.pinch && canDismissImage(value.scale, start.scroll, lastDx, value.pull)) dismissRef.current()
      else commit({ ...value, pull: 0 })
    }
    const cancel = () => { setGesturing(false); commit({ ...value, pull: 0 }) }
    view.addEventListener('touchstart', begin, { passive: false }); view.addEventListener('touchmove', move, { passive: false }); view.addEventListener('touchend', end); view.addEventListener('touchcancel', cancel)
    return () => { view.removeEventListener('touchstart', begin); view.removeEventListener('touchmove', move); view.removeEventListener('touchend', end); view.removeEventListener('touchcancel', cancel) }
  }, [])
  return createPortal(<div className={`image-viewer${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label="消息图片预览" data-zoom={transform.scale} data-gesturing={gesturing}>
    <button ref={button} aria-label="关闭图片预览" onClick={dismiss}>×</button>
    <div ref={viewport} className="image-scroll" style={{ overflowY: transform.scale === 1 ? 'auto' : 'hidden', touchAction: transform.scale === 1 ? 'pan-y' : 'none' }} onClick={event => { if (event.target === event.currentTarget) dismiss() }}>
      <div className="image-stage" onClick={event => { if (event.target === event.currentTarget) dismiss() }} style={{ transform: `translateY(${transform.pull}px)`, opacity: Math.max(.3, 1 - transform.pull / 500) }}><img ref={image} src={source} alt="消息附件大图" draggable={false} style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }} /></div>
    </div>
  </div>, document.body)
}
