import { describe, expect, it } from "vitest"

import { clampProductPlacement } from "./productPlacement"
import {
  FEED_NAME_LINE_LIMIT,
  FEED_PRODUCT_STAGE,
  feedProductContactShadow,
  getFeedSignLayout,
  positionFeedProduct,
} from "./feedLayout"
import { STORY_PRODUCT_STAGE } from "./storyLayout"

describe("Feed layout", () => {
  it("keeps a short product name on one line", () => {
    expect(getFeedSignLayout("Nescau 2.0")).toEqual({
      nameLines: ["Nescau 2.0"],
      nameLineFontSizes: [32],
      lineCount: 1,
      state: "single-line",
    })
  })

  it("uses a separate three-line state without removing name characters", () => {
    const layout = getFeedSignLayout("Leite Ibituruna e Itambé")

    expect(layout).toMatchObject({ lineCount: 3, state: "three-lines" })
    expect(layout.nameLines.join("").replace(/\s/g, "")).toBe("LeiteIbiturunaeItambé")
  })

  it("keeps a long word on one Feed line and reduces only its type", () => {
    const word = "A".repeat(FEED_NAME_LINE_LIMIT + 3)

    expect(getFeedSignLayout(word)).toMatchObject({
      nameLines: [word],
      nameLineFontSizes: [24],
      lineCount: 1,
      state: "single-line",
    })
  })

  it("anchors the visible base on the Feed pedestal despite transparent padding", () => {
    const position = positionFeedProduct({
      sourceWidth: 1000,
      sourceHeight: 1000,
      visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
    })

    expect(position.x + (250 + 150) * position.scale).toBeCloseTo(FEED_PRODUCT_STAGE.centerX)
    expect(position.y + (100 + 600) * position.scale).toBeCloseTo(FEED_PRODUCT_STAGE.baselineY)
    expect(300 * position.scale).toBeLessThanOrEqual(FEED_PRODUCT_STAGE.maxVisibleWidth)
    expect(600 * position.scale).toBeLessThanOrEqual(FEED_PRODUCT_STAGE.maxVisibleHeight)
  })

  it("enlarges a horizontal multipack within the Feed-specific safe width", () => {
    const position = positionFeedProduct({
      sourceWidth: 500,
      sourceHeight: 500,
      visibleBounds: { left: 80, top: 120, width: 330, height: 234 },
    })

    expect(330 * position.scale).toBeCloseTo(FEED_PRODUCT_STAGE.maxVisibleWidth)
    expect(234 * position.scale).toBeCloseTo(234 * FEED_PRODUCT_STAGE.maxVisibleWidth / 330)
    expect(position.x + (80 + 330 / 2) * position.scale).toBeCloseTo(FEED_PRODUCT_STAGE.centerX)
    expect(position.y + (120 + 234) * position.scale).toBeCloseTo(FEED_PRODUCT_STAGE.baselineY)
  })

  it("adds contact shadow only when the image does not bring one", () => {
    const geometry = {
      sourceWidth: 1000,
      sourceHeight: 1000,
      visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
    }

    expect(feedProductContactShadow(geometry)).toMatchObject({
      cx: FEED_PRODUCT_STAGE.centerX,
      cy: FEED_PRODUCT_STAGE.baselineY + 5,
    })
    expect(feedProductContactShadow({ ...geometry, hasIntrinsicContactShadow: true })).toBeUndefined()
  })
})

describe("Feed drag stage", () => {
  const geometry = {
    sourceWidth: 1000,
    sourceHeight: 1000,
    visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
  }
  const position = positionFeedProduct(geometry)
  const limited = (offsetX: number, offsetY: number) =>
    clampProductPlacement(geometry, position, { offsetX, offsetY }, FEED_PRODUCT_STAGE)

  it("keeps its own limits instead of borrowing the Story coordinates", () => {
    // O Feed tem 1350 de altura, placa e pedestal em outro lugar. Repetir os
    // números do Story colocaria a embalagem fora do palco.
    expect(FEED_PRODUCT_STAGE.minVisibleLeft).not.toBe(STORY_PRODUCT_STAGE.minVisibleLeft)
    expect(FEED_PRODUCT_STAGE.minVisibleTop).not.toBe(STORY_PRODUCT_STAGE.minVisibleTop)
    expect(FEED_PRODUCT_STAGE.maxVisibleRight).not.toBe(STORY_PRODUCT_STAGE.maxVisibleRight)
    expect(FEED_PRODUCT_STAGE.maxVisibleBottom).toBe(FEED_PRODUCT_STAGE.baselineY)
  })

  it("limits the left invasion to the band behind the Feed plate", () => {
    // A placa ocupa x 186..438. A silhueta pode entrar atrás dela, mas não pode
    // atravessá-la e reaparecer do outro lado.
    expect(FEED_PRODUCT_STAGE.minVisibleLeft).toBeLessThan(438)
    expect(FEED_PRODUCT_STAGE.minVisibleLeft).toBeGreaterThan(186)
  })

  it("stops the visible silhouette exactly on each border", () => {
    const visibleLeft = position.x + 250 * position.scale
    const visibleRight = visibleLeft + 300 * position.scale
    const visibleTop = position.y + 100 * position.scale

    expect(limited(-9000, 0).offsetX).toBeCloseTo(FEED_PRODUCT_STAGE.minVisibleLeft - visibleLeft)
    expect(limited(9000, 0).offsetX).toBeCloseTo(FEED_PRODUCT_STAGE.maxVisibleRight - visibleRight)
    expect(limited(0, -9000).offsetY).toBeCloseTo(FEED_PRODUCT_STAGE.minVisibleTop - visibleTop)
    // A base é o pedestal: a embalagem apoiada não desce nem um pixel.
    expect(limited(0, 9000).offsetY).toBeCloseTo(0)
  })

  it("brackets the automatic top of an unmeasured photo in the fallback band", () => {
    const fallbackTop = positionFeedProduct().y
    const band = FEED_PRODUCT_STAGE.unmeasuredImageTopRange

    expect(band.minimum).toBeLessThan(fallbackTop)
    expect(band.maximum).toBeGreaterThan(fallbackTop)
    expect(band.maximum).toBeLessThanOrEqual(FEED_PRODUCT_STAGE.baselineY)
  })
})
