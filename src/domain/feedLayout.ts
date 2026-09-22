import type { ProductImageGeometry } from "../images/cutout"
import { scaleProductSilhouette } from "./productPlacement"

export const FEED_NAME_LINE_LIMIT = 9
export const FEED_NAME_MAX_LINES = 3
export const FEED_DEFAULT_NAME_FONT_SIZE = 32
export const FEED_NAME_MIN_FONT_SIZE = 18
export const FEED_NAME_MAX_WORD_CHARACTERS = Math.floor(
  FEED_DEFAULT_NAME_FONT_SIZE * FEED_NAME_LINE_LIMIT / FEED_NAME_MIN_FONT_SIZE,
)

export const FEED_PRODUCT_STAGE = {
  centerX: 556,
  baselineY: 1113,
  // Mesma regra de peso visual do Story, calibrada para o palco menor do Feed.
  targetVisibleArea: 72_200,
  maxVisibleWidth: 298,
  maxVisibleHeight: 380,
  // Limites do arraste. São os conceitos aceitos no Story, recalculados contra a
  // arte do Feed — nunca as coordenadas do Story, que vivem em outra tela.
  // Esquerda: a invasão atrás da placa. No Story a silhueta entra 47 px além da
  // borda da placa (475 → 430); aqui, 47 × (220/330) ≈ 31 px além de 438.
  minVisibleLeft: 407,
  // Teto: a folga acima da caixa automática. No Story são 548 px (1088 → 540);
  // aqui, 548 × (380/520) ≈ 401 px acima de 733.
  minVisibleTop: 332,
  // Direita: a folga além da caixa automática. No Story são 107 px (873 → 980);
  // aqui, 107 × (220/330) ≈ 71 px além de 666.
  maxVisibleRight: 737,
  // Base: a própria linha do pedestal, como no Story.
  maxVisibleBottom: 1113,
  // Faixa do fallback para foto sem geometria medida, derivada da faixa que o
  // usuário calibrou no Story (1090 podendo subir 335 e descer 55), escalada
  // por 380/520 sobre o topo automático do Feed, que é 733.
  unmeasuredImageTopRange: {
    minimum: 488,
    maximum: 773,
  },
} as const

export type FeedProductPosition = {
  x: number
  y: number
  width: number
  height: number
  scale: number
}

export type FeedProductContactShadow = {
  cx: number
  cy: number
  rx: number
  ry: number
}

const FEED_PRODUCT_FALLBACK: FeedProductPosition = {
  x: 446,
  y: 733,
  width: 220,
  height: 380,
  scale: 1,
}

export function positionFeedProduct(geometry?: ProductImageGeometry): FeedProductPosition {
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
  ) return FEED_PRODUCT_FALLBACK

  const scale = scaleProductSilhouette(bounds, FEED_PRODUCT_STAGE)
  if (!scale) return FEED_PRODUCT_FALLBACK

  return {
    x: FEED_PRODUCT_STAGE.centerX - (bounds.left + bounds.width / 2) * scale,
    y: FEED_PRODUCT_STAGE.baselineY - (bounds.top + bounds.height) * scale,
    width: geometry.sourceWidth * scale,
    height: geometry.sourceHeight * scale,
    scale,
  }
}

export function feedProductContactShadow(
  geometry: ProductImageGeometry | undefined,
  position = positionFeedProduct(geometry),
): FeedProductContactShadow | undefined {
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
  const rx = Math.min(96, Math.max(42, visibleWidth * 0.45))

  return {
    cx: position.x + (bounds.left + bounds.width / 2) * position.scale,
    cy: FEED_PRODUCT_STAGE.baselineY + 5,
    rx,
    ry: Math.min(15, Math.max(7, rx * 0.11)),
  }
}

export type FeedSignState = "single-line" | "two-lines" | "three-lines"

type FeedSignStateTokens = {
  nameY: number
  lineOffsets: readonly number[]
  nameFontSize: number
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

export const FEED_SIGN_STATES: Record<FeedSignState, FeedSignStateTokens> = {
  "single-line": {
    nameY: 726,
    lineOffsets: [0],
    nameFontSize: 32,
    weight: {
      x: 311,
      y: 784,
      fontSize: 35,
      fill: "#ffe229",
      stroke: "#88110c",
      textAnchor: "middle",
    },
  },
  "two-lines": {
    nameY: 711,
    lineOffsets: [0, 41],
    nameFontSize: 32,
    weight: {
      x: 311,
      y: 792,
      fontSize: 28,
      fill: "#ffe229",
      stroke: "#88110c",
      textAnchor: "middle",
    },
  },
  "three-lines": {
    nameY: 710,
    lineOffsets: [0, 40, 37],
    nameFontSize: 32,
    thirdLineFontSize: 23,
    weight: {
      x: 411,
      y: 840,
      fontSize: 22,
      fill: "#74150f",
      stroke: "none",
      textAnchor: "end",
    },
  },
}

export type FeedSignLayout = {
  nameLines: string[]
  nameLineFontSizes: number[]
  lineCount: 1 | 2 | 3
  state: FeedSignState
}

export function countFeedNameCharacters(value: string): number {
  return Array.from(value).filter((character) => /[\p{L}\p{N}]/u.test(character)).length
}

function lineFontSize(line: string, defaultSize: number): number {
  const characterCount = countFeedNameCharacters(line)
  if (characterCount <= FEED_NAME_LINE_LIMIT) return defaultSize

  return Math.min(
    defaultSize,
    Math.max(
      FEED_NAME_MIN_FONT_SIZE,
      Math.floor(FEED_DEFAULT_NAME_FONT_SIZE * FEED_NAME_LINE_LIMIT / characterCount),
    ),
  )
}

export function getFeedSignLayout(productName: string): FeedSignLayout {
  const normalizedName = productName.trim().replace(/\s+/g, " ")
  const nameLines: string[] = []

  for (const word of normalizedName.split(" ").filter(Boolean)) {
    const currentLine = nameLines.at(-1)
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (countFeedNameCharacters(candidate) <= FEED_NAME_LINE_LIMIT) {
      if (currentLine) nameLines[nameLines.length - 1] = candidate
      else nameLines.push(candidate)
    } else {
      // The Feed plate wraps only between words. A long word stays whole and
      // uses a smaller, explicitly bounded font size on that line.
      nameLines.push(word)
    }
  }

  if (nameLines.length > FEED_NAME_MAX_LINES) {
    nameLines.splice(2, nameLines.length - 2, nameLines.slice(2).join(" "))
  }

  const lineCount = Math.max(1, Math.min(3, nameLines.length)) as 1 | 2 | 3
  const state: FeedSignState =
    lineCount === 1 ? "single-line" : lineCount === 2 ? "two-lines" : "three-lines"
  const stateTokens = FEED_SIGN_STATES[state]
  const nameLineFontSizes = nameLines.map((line, index) => lineFontSize(
    line,
    index === 2 ? stateTokens.thirdLineFontSize ?? FEED_DEFAULT_NAME_FONT_SIZE : FEED_DEFAULT_NAME_FONT_SIZE,
  ))

  return {
    nameLines: nameLines.length ? nameLines : ["Produto"],
    nameLineFontSizes: nameLineFontSizes.length ? nameLineFontSizes : [FEED_DEFAULT_NAME_FONT_SIZE],
    lineCount,
    state,
  }
}
