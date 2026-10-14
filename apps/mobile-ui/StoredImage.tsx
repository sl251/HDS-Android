import React, { useEffect, useRef, useState } from 'react'
import type { NativeBridge } from '../../packages/contracts'

export function StoredImage({ id, bridge }: { id: string; bridge: NativeBridge }) {
  const element = useRef<HTMLButtonElement>(null)
  const [data, setData] = useState(''), [error, setError] = useState(''), [open, setOpen] = useState(false)
  useEffect(() => {
    let cancelled = false
    const observer = new IntersectionObserver(entries => { if (!entries.some(entry => entry.isIntersecting)) return; observer.disconnect(); void bridge.rpc({ method: 'images.get', payload: { id } }).then(result => { if (!cancelled) setData((result.data as { dataUri: string }).dataUri) }).catch(() => { if (!cancelled) setError('图片暂时无法读取') }) }, { rootMargin: '200px' })
    if (element.current) observer.observe(element.current)
    return () => { cancelled = true; observer.disconnect() }
  }, [id])
  return <><button ref={element} className="message-image" onClick={() => data && setOpen(true)} aria-label="查看消息图片">{data ? <img src={data} alt="消息附件" /> : <span>{error || '正在读取图片…'}</span>}</button>{open && <div className="image-viewer" role="dialog" aria-modal="true" aria-label="消息图片预览"><button autoFocus aria-label="关闭图片预览" onClick={() => setOpen(false)}>×</button><img src={data} alt="消息附件大图" /></div>}</>
}
