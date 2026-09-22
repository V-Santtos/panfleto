import { describe, expect, it } from "vitest"

import { getStorySignLayout, positionStoryProduct, storyProductContactShadow, STORY_NAME_LINE_LIMIT, STORY_PRODUCT_STAGE } from "./storyLayout"

describe("Story sign layout", () => {
  it("keeps a short product name in the single-line state", () => {
    expect(getStorySignLayout("Nescau 2.0")).toEqual({
      nameLines: ["Nescau 2.0"],
      nameLineFontSizes: [44],
      lineCount: 1,
      state: "single-line",
    })
  })

  it("moves to the two-line state without breaking words", () => {
    expect(getStorySignLayout("Leite e Bituruna")).toEqual({
      nameLines: ["Leite e", "Bituruna"],
      nameLineFontSizes: [44, 44],
      lineCount: 2,
      state: "two-lines",
    })
  })

  it("keeps a long word whole and reduces only its font", () => {
    const longWord = "A".repeat(STORY_NAME_LINE_LIMIT + 3)

    expect(getStorySignLayout(longWord)).toMatchObject({
      nameLines: [longWord],
      nameLineFontSizes: [33],
      lineCount: 1,
    })
  })

  it("uses three lines after the second line reaches its limit", () => {
    expect(getStorySignLayout("Leite Ibituruna e Itambé")).toEqual({
      nameLines: ["Leite", "Ibituruna", "e Itambé"],
      nameLineFontSizes: [44, 44, 32],
      lineCount: 3,
      state: "three-lines",
    })
  })

  it("does not split or discard a long word when it follows a short one", () => {
    const layout = getStorySignLayout("X Supercalifragilistico")

    expect(layout.nameLines).toEqual(["X", "Supercalifragilistico"])
    expect(layout.nameLines.join("").replace(/\s/g, "")).toBe("XSupercalifragilistico")
  })

  it("anchors the visible product base on the pedestal regardless of transparent padding", () => {
    const position = positionStoryProduct({
      sourceWidth: 1000,
      sourceHeight: 1000,
      visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
    })

    expect(position.x + (250 + 150) * position.scale).toBeCloseTo(STORY_PRODUCT_STAGE.centerX)
    expect(position.y + (100 + 600) * position.scale).toBeCloseTo(STORY_PRODUCT_STAGE.baselineY)
    expect(300 * position.scale).toBeLessThanOrEqual(STORY_PRODUCT_STAGE.maxVisibleWidth)
    expect(600 * position.scale).toBeLessThanOrEqual(STORY_PRODUCT_STAGE.maxVisibleHeight)
  })

  it("gives a horizontal multipack comparable visual weight", () => {
    const position = positionStoryProduct({
      sourceWidth: 500,
      sourceHeight: 500,
      visibleBounds: { left: 80, top: 120, width: 330, height: 234 },
    })

    expect(330 * position.scale).toBeCloseTo(436.68, 1)
    expect(234 * position.scale).toBeCloseTo(309.65, 1)
    expect(330 * position.scale).toBeLessThanOrEqual(STORY_PRODUCT_STAGE.maxVisibleWidth)
    expect(position.x + (80 + 330 / 2) * position.scale).toBeCloseTo(STORY_PRODUCT_STAGE.centerX)
    expect(position.y + (120 + 234) * position.scale).toBeCloseTo(STORY_PRODUCT_STAGE.baselineY)
  })

  it("keeps the established fallback placement until a product image has been measured", () => {
    expect(positionStoryProduct()).toMatchObject({ x: 428, y: 1090, width: 544, height: 566 })
    expect(STORY_PRODUCT_STAGE.unmeasuredImageTopRange).toEqual({
      minimum: 755.05615234375,
      maximum: 1144.6849365234375,
    })
  })

  it("adds a proportional contact shadow only when the source has none", () => {
    const geometry = {
      sourceWidth: 1000,
      sourceHeight: 1000,
      visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
    }
    const shadow = storyProductContactShadow(geometry)

    expect(shadow).toMatchObject({ cx: STORY_PRODUCT_STAGE.centerX, cy: STORY_PRODUCT_STAGE.baselineY + 6 })
    expect(shadow!.rx).toBeGreaterThan(0)
    expect(shadow!.ry).toBeGreaterThan(0)
    expect(storyProductContactShadow({ ...geometry, hasIntrinsicContactShadow: true })).toBeUndefined()
  })
})
