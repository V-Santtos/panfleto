import { analyzePackshot } from "./packshotAnalysis"

function containsVisibleAlpha(data: Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) if (data[index] >= 16) return true
  return false
}

// The four outermost rows and columns of the source, read at full resolution so
// downsampling cannot round a legitimate margin onto the analysis edge.
function edgeStrips(bitmap: ImageBitmap): Uint8ClampedArray[] {
  const horizontal = new OffscreenCanvas(bitmap.width, 1)
  let context = horizontal.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Canvas indisponível")
  context.drawImage(bitmap, 0, 0, bitmap.width, 1, 0, 0, bitmap.width, 1)
  const top = context.getImageData(0, 0, bitmap.width, 1).data
  context.clearRect(0, 0, bitmap.width, 1)
  context.drawImage(bitmap, 0, bitmap.height - 1, bitmap.width, 1, 0, 0, bitmap.width, 1)
  const bottom = context.getImageData(0, 0, bitmap.width, 1).data

  const vertical = new OffscreenCanvas(1, bitmap.height)
  context = vertical.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Canvas indisponível")
  context.drawImage(bitmap, 0, 0, 1, bitmap.height, 0, 0, 1, bitmap.height)
  const left = context.getImageData(0, 0, 1, bitmap.height).data
  context.clearRect(0, 0, 1, bitmap.height)
  context.drawImage(bitmap, bitmap.width - 1, 0, 1, bitmap.height, 0, 0, 1, bitmap.height)
  const right = context.getImageData(0, 0, 1, bitmap.height).data
  return [top, bottom, left, right]
}

function sourceEdgeContact(bitmap: ImageBitmap): { transparent: boolean; white: boolean } {
  const strips = edgeStrips(bitmap)
  let transparent = false
  let clearlyNotWhite = 0
  for (const strip of strips) {
    if (containsVisibleAlpha(strip)) transparent = true
    for (let index = 0; index < strip.length; index += 4) {
      // JPEG ringing around a package sits just below pure white, so only a
      // clearly non-white pixel counts as the package reaching the edge.
      if (strip[index + 3] >= 16 && Math.min(strip[index], strip[index + 1], strip[index + 2]) < 232) clearlyNotWhite++
    }
  }
  const ring = 2 * bitmap.width + 2 * bitmap.height - 4
  return { transparent, white: clearlyNotWhite > Math.max(4, Math.round(ring * 0.004)) }
}

self.onmessage = async (event: MessageEvent<{ id: number; url: string }>) => {
  const { id, url } = event.data
  let bitmap: ImageBitmap | undefined
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error("Imagem indisponível")
    bitmap = await createImageBitmap(await response.blob())
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("Imagem muito grande")
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(4, Math.round(bitmap.width * scale)), height = Math.max(4, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) throw new Error("Canvas indisponível")
    ctx.drawImage(bitmap, 0, 0, width, height)
    const edgeContact = sourceEdgeContact(bitmap)
    const assessment = analyzePackshot(
      ctx.getImageData(0, 0, width, height).data,
      width,
      height,
      bitmap.width,
      bitmap.height,
      edgeContact.transparent,
      edgeContact.white,
    )
    self.postMessage({ id, assessment })
  } catch {
    self.postMessage({ id, assessment: { accepted: false, background: "other", score: 0, reasons: ["load"] } })
  } finally {
    bitmap?.close()
  }
}
