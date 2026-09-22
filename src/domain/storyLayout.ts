import type { ProductImageGeometry } from "../images/cutout.js"
import { scaleProductSilhouette } from "./productPlacement.js"

export const STORY_NAME_LINE_LIMIT = 9
export const STORY_NAME_MAX_LINES = 3
export const STORY_DEFAULT_NAME_FONT_SIZE = 44
export const STORY_NAME_MIN_FONT_SIZE = 24
export const STORY_NAME_MAX_WORD_CHARACTERS = Math.floor(
  STORY_DEFAULT_NAME_FONT_SIZE * STORY_NAME_LINE_LIMIT / STORY_NAME_MIN_FONT_SIZE,
)

export const STORY_PRODUCT_STAGE = {
  centerX: 708,
  // Calibrated on the centre of the visible upper plane, not its rear outline.
  // This leaves the product visibly resting on the pedestal instead of floating.
  baselineY: 1608,
  // Área calibrada a partir de uma embalagem vertical 1:2 (260 × 520).
  // A largura maior evita que multipacks horizontais pareçam miniaturas.
  targetVisibleArea: 135_200,
  maxVisibleWidth: 440,
  maxVisibleHeight: 520,
  // Primeira calibração técnica do palco arrastável. O usuário fará o aceite
  // visual com embalagens reais antes de estes limites serem replicados.
  minVisibleLeft: 430,
  minVisibleTop: 540,
  maxVisibleRight: 980,
  maxVisibleBottom: 1608,
  unmeasuredImageTopRange: {
    minimum: 755.05615234375,
    maximum: 1144.6849365234375,
  },
} as const

export type StoryProductPosition = {
  x: number
  y: number
  width: number
  height: number
  scale: number
}

export type StoryProductContactShadow = {
  cx: number
  cy: number
  rx: number
  ry: number
}

const STORY_PRODUCT_FALLBACK: StoryProductPosition = {
  x: 428,
  y: 1090,
  width: 544,
  height: 566,
  scale: 1,
}

export function positionStoryProduct(geometry?: ProductImageGeometry): StoryProductPosition {
  const bounds = geometry?.visibleBounds
  if (
    !geometry
    || !bounds
    || !Number.isFinite(geometry.sourceWidth)
    || !Number.isFinite(geometry.sourceHeight)
    || geometry.sourceWidth <= 0
    || geometry.sourceHeight <= 0
    || bounds.width <= 0
    || bounds.height <= 0
  ) return STORY_PRODUCT_FALLBACK

  const scale = scaleProductSilhouette(bounds, STORY_PRODUCT_STAGE)
  if (!scale) return STORY_PRODUCT_FALLBACK
  return {
    x: STORY_PRODUCT_STAGE.centerX - (bounds.left + bounds.width / 2) * scale,
    y: STORY_PRODUCT_STAGE.baselineY - (bounds.top + bounds.height) * scale,
    width: geometry.sourceWidth * scale,
    height: geometry.sourceHeight * scale,
    scale,
  }
}

export function storyProductContactShadow(
  geometry: ProductImageGeometry | undefined,
  position = positionStoryProduct(geometry),
): StoryProductContactShadow | undefined {
  const bounds = geometry?.visibleBounds
  if (
    !geometry
    || geometry.hasIntrinsicContactShadow
    || !bounds
    || bounds.width <= 0
    || !Number.isFinite(position.scale)
    || position.scale <= 0
  ) return

  const visibleWidth = bounds.width * position.scale
  const rx = Math.min(150, Math.max(54, visibleWidth * 0.48))

  return {
    cx: position.x + (bounds.left + bounds.width / 2) * position.scale,
    cy: STORY_PRODUCT_STAGE.baselineY + 6,
    rx,
    ry: Math.min(19, Math.max(8, rx * 0.11)),
  }
}

export type StorySignState = "single-line" | "two-lines" | "three-lines"

type StorySignStateTokens = {
  nameY: number
  lineOffsets: readonly number[]
  thirdLineFontSize?: number
  weight: {
    x: number
    y: number
    fontSize: number
    fill: string
    stroke: string
    textAnchor: "middle" | "end"
  }
}

export const STORY_SIGN_STATES: Record<StorySignState, StorySignStateTokens> = {
  "single-line": {
    nameY: 1058,
    lineOffsets: [0],
    weight: {
      x: 299,
      y: 1142,
      fontSize: 48,
      fill: "#ffe000",
      stroke: "#88110c",
      textAnchor: "middle",
    },
  },
  "two-lines": {
    nameY: 1038,
    lineOffsets: [0, 56],
    weight: {
      x: 299,
      y: 1154,
      fontSize: 38,
      fill: "#ffe000",
      stroke: "#88110c",
      textAnchor: "middle",
    },
  },
  "three-lines": {
    nameY: 1036,
    lineOffsets: [0, 54, 50],
    thirdLineFontSize: 32,
    weight: {
      x: 445,
      y: 1208,
      fontSize: 30,
      fill: "#74150f",
      stroke: "none",
      textAnchor: "end",
    },
  },
}

export type StorySignLayout = {
  nameLines: string[]
  nameLineFontSizes: number[]
  lineCount: 1 | 2 | 3
  state: StorySignState
}

export function countStoryNameCharacters(value: string): number {
  return Array.from(value).filter((character) => /[\p{L}\p{N}]/u.test(character)).length
}

function lineFontSize(line: string, defaultSize: number): number {
  const characterCount = countStoryNameCharacters(line)
  if (characterCount <= STORY_NAME_LINE_LIMIT) return defaultSize

  return Math.min(
    defaultSize,
    Math.max(
      STORY_NAME_MIN_FONT_SIZE,
      Math.floor(STORY_DEFAULT_NAME_FONT_SIZE * STORY_NAME_LINE_LIMIT / characterCount),
    ),
  )
}

export function getStorySignLayout(productName: string): StorySignLayout {
  const normalizedName = productName.trim().replace(/\s+/g, " ")
  const nameLines: string[] = []

  for (const word of normalizedName.split(" ").filter(Boolean)) {
    const currentLine = nameLines.at(-1)
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (countStoryNameCharacters(candidate) <= STORY_NAME_LINE_LIMIT) {
      if (currentLine) nameLines[nameLines.length - 1] = candidate
      else nameLines.push(candidate)
    } else {
      // The plate can wrap only between words. A single long word stays intact
      // and receives a smaller, explicitly bounded font size below.
      nameLines.push(word)
    }
  }

  if (nameLines.length > STORY_NAME_MAX_LINES) {
    nameLines.splice(2, nameLines.length - 2, nameLines.slice(2).join(" "))
  }

  const lineCount = Math.max(1, Math.min(3, nameLines.length)) as 1 | 2 | 3
  const state: StorySignState =
    lineCount === 1 ? "single-line" : lineCount === 2 ? "two-lines" : "three-lines"
  const stateTokens = STORY_SIGN_STATES[state]
  const nameLineFontSizes = nameLines.map((line, index) => lineFontSize(
    line,
    index === 2 ? stateTokens.thirdLineFontSize ?? STORY_DEFAULT_NAME_FONT_SIZE : STORY_DEFAULT_NAME_FONT_SIZE,
  ))

  return {
    nameLines: nameLines.length ? nameLines : ["Produto"],
    nameLineFontSizes: nameLineFontSizes.length ? nameLineFontSizes : [STORY_DEFAULT_NAME_FONT_SIZE],
    lineCount,
    state,
  }
}
