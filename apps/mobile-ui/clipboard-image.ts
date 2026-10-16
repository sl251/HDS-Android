/** Keep paste on the host's bounded JPEG contract, including PNG/GIF clipboard images. */
export async function clipboardJpeg(file: File): Promise<string> {
  if (file.size > 32 * 1024 * 1024) throw new Error('粘贴图片最大 32 MiB')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url; await image.decode()
    if (image.naturalWidth * image.naturalHeight > 100_000_000) throw new Error('粘贴图片尺寸过大')
    const ratio = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法处理粘贴图片')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (let quality = .88; quality >= .18; quality -= .1) {
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length < 640000) return data
    }
    throw new Error('粘贴图片压缩后仍过大')
  } finally { URL.revokeObjectURL(url) }
}
