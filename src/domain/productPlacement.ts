import type { ProductImageGeometry, VisibleAlphaBounds } from "../images/cutout.js"

export type ProductPlacement = {
  offsetX: number
  offsetY: number
}

export type ProductPosition = {
  x: number
  y: number
  scale: number
}

export type ProductStageBounds = {
  minVisibleLeft: number
  minVisibleTop: number
  maxVisibleRight: number
  maxVisibleBottom: number
  unmeasuredImageTopRange?: {
    minimum: number
    maximum: number
  }
}

export type ProductScaleCalibration = {
  targetVisibleArea: number
  maxVisibleWidth: number
  maxVisibleHeight: number
}

export const AUTOMATIC_PRODUCT_PLACEMENT: ProductPlacement = Object.freeze({
  offsetX: 0,
  offsetY: 0,
})

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

// Equaliza a presença visual entre formatos de embalagem sem distorcer a foto.
// A área-alvo dá peso semelhante a produtos horizontais, quadrados e verticais;
// os limites de largura e altura protegem o palco contra proporções extremas.
export function scaleProductSilhouette(
  visible: VisibleAlphaBounds,
  calibration: ProductScaleCalibration,
): number | undefined {
  const values = [
    visible.width,
    visible.height,
    calibration.targetVisibleArea,
    calibration.maxVisibleWidth,
    calibration.maxVisibleHeight,
  ]
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return

  return Math.min(
    Math.sqrt(calibration.targetVisibleArea / (visible.width * visible.height)),
    calibration.maxVisibleWidth / visible.width,
    calibration.maxVisibleHeight / visible.height,
  )
}

export function clampProductPlacement(
  geometry: ProductImageGeometry | undefined,
  automaticPosition: ProductPosition,
  intendedPlacement: ProductPlacement,
  stage: ProductStageBounds,
): ProductPlacement {
  const visible = geometry?.visibleBounds
  if (
    !geometry
    || !visible
    || visible.width <= 0
    || visible.height <= 0
    || !Number.isFinite(automaticPosition.x)
    || !Number.isFinite(automaticPosition.y)
    || !Number.isFinite(automaticPosition.scale)
    || automaticPosition.scale <= 0
  ) return AUTOMATIC_PRODUCT_PLACEMENT

  const visibleLeft = automaticPosition.x + visible.left * automaticPosition.scale
  const visibleTop = automaticPosition.y + visible.top * automaticPosition.scale
  const visibleRight = visibleLeft + visible.width * automaticPosition.scale
  const visibleBottom = visibleTop + visible.height * automaticPosition.scale
  const minimumX = stage.minVisibleLeft - visibleLeft
  const maximumX = stage.maxVisibleRight - visibleRight
  const minimumY = stage.minVisibleTop - visibleTop
  const maximumY = stage.maxVisibleBottom - visibleBottom

  if (minimumX > maximumX || minimumY > maximumY) return AUTOMATIC_PRODUCT_PLACEMENT

  return {
    offsetX: clamp(finite(intendedPlacement.offsetX), minimumX, maximumX),
    offsetY: clamp(finite(intendedPlacement.offsetY), minimumY, maximumY),
  }
}

export function applyProductPlacement<T extends ProductPosition>(
  automaticPosition: T,
  placement: ProductPlacement,
): T {
  return {
    ...automaticPosition,
    x: automaticPosition.x + finite(placement.offsetX),
    y: automaticPosition.y + finite(placement.offsetY),
  }
}
