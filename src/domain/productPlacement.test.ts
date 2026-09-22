import { describe, expect, it } from "vitest"

import type { ProductImageGeometry } from "../images/cutout"
import {
  applyProductPlacement,
  AUTOMATIC_PRODUCT_PLACEMENT,
  clampProductPlacement,
  scaleProductSilhouette,
  type ProductStageBounds,
} from "./productPlacement"

const geometry: ProductImageGeometry = {
  sourceWidth: 1000,
  sourceHeight: 1000,
  visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
}
const automatic = { x: 361.33, y: 1001.33, width: 866.67, height: 866.67, scale: 520 / 600 }
const stage: ProductStageBounds = {
  minVisibleLeft: 430,
  minVisibleTop: 540,
  maxVisibleRight: 980,
  maxVisibleBottom: 1608,
}

describe("restricted product placement", () => {
  it("keeps the automatic position as the neutral placement", () => {
    expect(clampProductPlacement(geometry, automatic, AUTOMATIC_PRODUCT_PLACEMENT, stage)).toEqual({ offsetX: 0, offsetY: 0 })
    expect(applyProductPlacement(automatic, { offsetX: 12, offsetY: -20 })).toMatchObject({ x: 373.33, y: 981.33 })
  })

  it("limits every edge using the visible silhouette rather than transparent padding", () => {
    const farTopLeft = clampProductPlacement(geometry, automatic, { offsetX: -999, offsetY: -999 }, stage)
    const farBottomRight = clampProductPlacement(geometry, automatic, { offsetX: 999, offsetY: 999 }, stage)

    const baseVisibleLeft = automatic.x + geometry.visibleBounds.left * automatic.scale
    const baseVisibleTop = automatic.y + geometry.visibleBounds.top * automatic.scale
    const baseVisibleRight = baseVisibleLeft + geometry.visibleBounds.width * automatic.scale
    const baseVisibleBottom = baseVisibleTop + geometry.visibleBounds.height * automatic.scale

    expect(baseVisibleLeft + farTopLeft.offsetX).toBeCloseTo(stage.minVisibleLeft)
    expect(baseVisibleTop + farTopLeft.offsetY).toBeCloseTo(stage.minVisibleTop)
    expect(baseVisibleRight + farBottomRight.offsetX).toBeCloseTo(stage.maxVisibleRight)
    expect(baseVisibleBottom + farBottomRight.offsetY).toBeCloseTo(stage.maxVisibleBottom)
  })

  it("falls back safely when geometry is unavailable or malformed", () => {
    expect(clampProductPlacement(undefined, automatic, { offsetX: 20, offsetY: -20 }, stage)).toBe(AUTOMATIC_PRODUCT_PLACEMENT)
    expect(clampProductPlacement({ ...geometry, visibleBounds: { ...geometry.visibleBounds, width: 0 } }, automatic, { offsetX: 20, offsetY: -20 }, stage)).toBe(AUTOMATIC_PRODUCT_PLACEMENT)
  })
})

describe("visual product scale", () => {
  const storyCalibration = {
    targetVisibleArea: 135_200,
    maxVisibleWidth: 440,
    maxVisibleHeight: 520,
  }

  it("gives a horizontal package the target visual area without exceeding its width cap", () => {
    const scale = scaleProductSilhouette(
      { left: 80, top: 40, width: 330, height: 234 },
      storyCalibration,
    )

    expect(scale).toBeDefined()
    expect(330 * scale!).toBeCloseTo(436.68, 1)
    expect(234 * scale!).toBeCloseTo(309.65, 1)
    expect(330 * scale!).toBeLessThanOrEqual(storyCalibration.maxVisibleWidth)
    expect(330 * scale! * 234 * scale!).toBeCloseTo(storyCalibration.targetVisibleArea, 1)
  })

  it("keeps a vertical package on the established height cap", () => {
    const scale = scaleProductSilhouette(
      { left: 0, top: 0, width: 300, height: 600 },
      storyCalibration,
    )

    expect(300 * scale!).toBeCloseTo(260)
    expect(600 * scale!).toBeCloseTo(520)
  })

  it("uses an intermediate area-based scale for a square package", () => {
    const scale = scaleProductSilhouette(
      { left: 0, top: 0, width: 100, height: 100 },
      storyCalibration,
    )

    expect(100 * scale!).toBeCloseTo(Math.sqrt(storyCalibration.targetVisibleArea))
    expect(100 * scale!).toBeLessThan(storyCalibration.maxVisibleWidth)
  })

  it("caps extreme aspect ratios and ignores transparent-padding offsets", () => {
    const withoutPadding = scaleProductSilhouette(
      { left: 0, top: 0, width: 1000, height: 100 },
      storyCalibration,
    )
    const withPadding = scaleProductSilhouette(
      { left: 900, top: 600, width: 1000, height: 100 },
      storyCalibration,
    )

    expect(withPadding).toBe(withoutPadding)
    expect(1000 * withPadding!).toBeCloseTo(storyCalibration.maxVisibleWidth)
    expect(100 * withPadding!).toBeLessThan(storyCalibration.maxVisibleHeight)
  })

  it("rejects malformed silhouettes and calibrations", () => {
    expect(scaleProductSilhouette({ left: 0, top: 0, width: 0, height: 100 }, storyCalibration)).toBeUndefined()
    expect(scaleProductSilhouette(
      { left: 0, top: 0, width: 100, height: 100 },
      { ...storyCalibration, targetVisibleArea: Number.NaN },
    )).toBeUndefined()
  })
})
