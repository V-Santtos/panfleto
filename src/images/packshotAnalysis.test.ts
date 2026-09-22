import { describe, expect, it } from "vitest"
import { analyzePackshot } from "./packshotAnalysis"

function fixture(background: [number, number, number, number] = [255, 255, 255, 255], framed = false) {
  const pixels = new Uint8ClampedArray(128 * 128 * 4)
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    // Bottle with cap and shoulders, label detail, and generous clear margins.
    const inside = framed ? x >= 20 && x < 108 && y >= 12 && y < 116
      : y >= 12 && y < 116 && Math.abs(x - 64) < (y < 25 ? 12 : y < 40 ? 12 + (y - 25) : 27)
    const color = inside ? [30 + ((x + y) % 9) * 10, 50, 140, 255] : background
    pixels.set(color, (y * 128 + x) * 4)
  }
  return pixels
}

function moveFixtureUp(pixels: Uint8ClampedArray, rows: number): Uint8ClampedArray {
  const shifted = new Uint8ClampedArray(pixels.length)
  for (let y = rows; y < 128; y++) for (let x = 0; x < 128; x++) {
    shifted.set(pixels.slice((y * 128 + x) * 4, (y * 128 + x + 1) * 4), ((y - rows) * 128 + x) * 4)
  }
  return shifted
}

function whitePackshotNearAnalysisBottom(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(128 * 128 * 4)
  for (let index = 0; index < 128 * 128; index++) pixels.set([255, 255, 255, 255], index * 4)
  // A can kept three source pixels away from the bottom edge, as Cosmos serves
  // it at 500px. Downsampling rounds that margin onto the analysis edge, while
  // the tapered base leaves the border band clean enough to read as white.
  for (let y = 12; y <= 126; y++) {
    const half = y < 25 ? 12 : y < 40 ? 12 + (y - 25) : y >= 122 ? Math.max(2, 27 - (y - 121) * 5) : 27
    for (let x = 64 - half; x <= 64 + half; x++) {
      pixels.set([30 + ((x + y) % 9) * 10, 50, 140, 255], (y * 128 + x) * 4)
    }
  }
  return pixels
}

function genericIllustrationFixture(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(128 * 128 * 4)
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const distance = (x - 64) ** 2 + (y - 64) ** 2
    const halo = distance < 38 ** 2
    const bottle = x >= 55 && x <= 73 && y >= 36 && y <= 91
    const hand = x >= 72 && x <= 91 && y >= 54 && y <= 69
    const color: [number, number, number, number] = bottle ? [40 + ((x + y) % 5) * 20, 50, 150, 255]
      : hand ? [220, 135, 120, 255]
        : halo ? [235, 235, 235, 255]
          : [255, 255, 255, 255]
    pixels.set(color, (y * 128 + x) * 4)
  }
  return pixels
}

describe("strict packshot gate", () => {
  it("accepts an isolated detailed bottle on white", () => {
    expect(analyzePackshot(fixture(), 128, 128, 1000, 1000)).toMatchObject({ accepted: true, background: "white", reasons: [] })
  })
  it("accepts real alpha without treating transparent black pixels as a black backdrop", () => {
    expect(analyzePackshot(fixture([0, 0, 0, 0]), 128, 128, 1000, 1000)).toMatchObject({ accepted: true, background: "transparent" })
  })
  it("accepts a transparent packshot when downsampling moves its safe source margin onto the analysis edge", () => {
    const downsampledNearTopEdge = moveFixtureUp(fixture([0, 0, 0, 0]), 12)
    expect(analyzePackshot(downsampledNearTopEdge, 128, 128, 1000, 1000, false)).toMatchObject({ accepted: true, background: "transparent", reasons: [] })
  })
  it("still rejects a transparent packshot that actually touches the source edge", () => {
    const touchingTopEdge = moveFixtureUp(fixture([0, 0, 0, 0]), 12)
    expect(analyzePackshot(touchingTopEdge, 128, 128, 1000, 1000, true).reasons).toContain("framing")
  })
  it("accepts a white packshot when downsampling moves its safe source margin onto the analysis edge", () => {
    expect(analyzePackshot(whitePackshotNearAnalysisBottom(), 128, 128, 500, 500, undefined, false))
      .toMatchObject({ accepted: true, background: "white", reasons: [] })
  })
  it("still rejects a white packshot that actually touches the source edge", () => {
    expect(analyzePackshot(whitePackshotNearAnalysisBottom(), 128, 128, 500, 500, undefined, true).reasons).toContain("framing")
  })
  it("keeps the conservative canvas guard for a white packshot measured without the source", () => {
    expect(analyzePackshot(whitePackshotNearAnalysisBottom(), 128, 128, 500, 500).reasons).toContain("framing")
  })
  it.each([[220, 220, 220, 255], [255, 240, 170, 255], [170, 200, 220, 255]])("rejects a uniform nonwhite backdrop: %j", (r, g, b, a) => {
    expect(analyzePackshot(fixture([r, g, b, a]), 128, 128, 1000, 1000).reasons).toContain("background")
  })
  it("rejects an informal photo even when surrounded by a perfect white frame", () => {
    const result = analyzePackshot(fixture([255, 255, 255, 255], true), 128, 128, 1000, 1000)
    expect(result.accepted).toBe(false)
    expect(result.reasons).toContain("photo-frame")
  })
  it("rejects textured surroundings", () => {
    const pixels = fixture()
    for (let x = 0; x < 128; x++) pixels.set([x % 2 ? 100 : 240, 200, 180, 255], x * 4)
    expect(analyzePackshot(pixels, 128, 128, 1000, 1000).reasons).toContain("background")
  })
  it("does not give a tiny transparent image a free pass", () => {
    expect(analyzePackshot(fixture([0, 0, 0, 0]), 128, 128, 100, 100).reasons).toContain("resolution")
  })
  it("keeps a clean smaller photo with an explicit resolution warning", () => {
    expect(analyzePackshot(fixture(), 128, 128, 500, 500)).toMatchObject({ accepted: true, lowResolution: true })
  })
  it("rejects blank white and completely transparent images", () => {
    expect(analyzePackshot(new Uint8ClampedArray(128 * 128 * 4).fill(255), 128, 128, 1000, 1000).reasons).toContain("empty")
    expect(analyzePackshot(new Uint8ClampedArray(128 * 128 * 4), 128, 128, 1000, 1000).reasons).toContain("empty")
  })
  it("rejects a second significant object", () => {
    const pixels = fixture()
    for (let y = 30; y < 95; y++) for (let x = 5; x < 20; x++) pixels.set([100, 20, 20, 255], (y * 128 + x) * 4)
    expect(analyzePackshot(pixels, 128, 128, 1000, 1000).reasons).toContain("multiple")
  })
  it("rejects a generic product illustration surrounded by a gray halo", () => {
    const result = analyzePackshot(genericIllustrationFixture(), 128, 128, 1000, 1000)
    expect(result.accepted).toBe(false)
    expect(result.reasons).toContain("generic-illustration")
  })
  it("rejects a package that is cropped against a source edge", () => {
    const pixels = fixture()
    for (let y = 116; y < 128; y++) for (let x = 48; x < 80; x++) pixels.set([30, 50, 140, 255], (y * 128 + x) * 4)
    expect(analyzePackshot(pixels, 128, 128, 1000, 1000).reasons).toContain("framing")
  })
  it("rejects unsupported analysis dimensions", () => {
    expect(() => analyzePackshot(new Uint8ClampedArray(300 * 300 * 4), 300, 300, 1000, 1000)).toThrow(/Dimensões/)
  })
})
