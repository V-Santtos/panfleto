/// <reference lib="webworker" />

import { hasSoftContactShadow, hasTransparentBackground, visibleAlphaBounds, visibleContentBounds, type RgbaImage } from "./cutout"

declare const self: DedicatedWorkerGlobalScope

self.onmessage = async (event: MessageEvent<{ id: number; bitmap: ImageBitmap }>) => {
  const { id, bitmap } = event.data
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Não foi possível medir a embalagem.")
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const image: RgbaImage = { data: pixels.data, width: pixels.width, height: pixels.height }
    const transparent = hasTransparentBackground(image)
    const visibleBounds = transparent ? visibleAlphaBounds(image) : visibleContentBounds(image)
    if (!visibleBounds) throw new Error("Não foi possível localizar a embalagem na imagem.")
    self.postMessage({
      id,
      placement: {
        sourceWidth: image.width,
        sourceHeight: image.height,
        visibleBounds,
        hasIntrinsicContactShadow: transparent ? hasSoftContactShadow(image, visibleBounds) : false,
      },
    })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Não foi possível medir a embalagem." })
  } finally {
    bitmap.close()
  }
}
