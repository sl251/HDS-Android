import React from 'react'

/** A viewport-sized sibling of the app avoids WebView's filtered CSS background layers. */
export function BackgroundImage({ source, opacity, blur, failed }: { source: string; opacity: number; blur: number; failed: () => void }) {
  return <img className="custom-background" src={source} alt="" aria-hidden="true" draggable={false} style={{ opacity: opacity / 100, filter: blur > 0 ? `blur(${blur}px)` : undefined }} onError={failed} />
}
