import {
  countStoryNameCharacters,
  STORY_NAME_LINE_LIMIT,
  STORY_NAME_MAX_LINES,
  STORY_NAME_MAX_WORD_CHARACTERS,
} from "./storyLayout.js"

export const PRESENTATION_UNITS = ["g", "kg", "ml", "L", "unidade"] as const
export type PresentationUnit = (typeof PRESENTATION_UNITS)[number]

export const PRESENTATION_UNIT_LABELS: Record<PresentationUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  L: "L",
  unidade: "UN",
}

export type Offer = {
  productName: string
  quantity: number
  unit: PresentationUnit
  promotionalPriceCents: number
  previousPriceCents?: number
}

export type OfferDraft = {
  productName: string
  quantity: string
  unit: PresentationUnit
  promotionalPrice: string
  hasPreviousPrice: boolean
  previousPrice: string
}

export type OfferField =
  | "productName"
  | "quantity"
  | "promotionalPrice"
  | "previousPrice"

export type OfferErrors = Partial<Record<OfferField, string>>

export const DEFAULT_OFFER: Offer = {
  productName: "Nescau 2.0",
  quantity: 400,
  unit: "g",
  promotionalPriceCents: 1299,
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function formatMoney(cents: number): string {
  return brlFormatter.format(cents / 100)
}

export function moneyToInput(cents?: number): string {
  if (cents === undefined) return ""
  return (cents / 100).toFixed(2).replace(".", ",")
}

export function parseMoneyToCents(value: string): number | null {
  const compact = value
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")

  if (!compact) return null

  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null

  return Math.round(parsed * 100)
}

export function offerToDraft(offer: Offer): OfferDraft {
  return {
    productName: offer.productName,
    quantity: String(offer.quantity),
    unit: offer.unit,
    promotionalPrice: moneyToInput(offer.promotionalPriceCents),
    hasPreviousPrice: offer.previousPriceCents !== undefined,
    previousPrice: moneyToInput(offer.previousPriceCents),
  }
}

export function validateOfferDraft(draft: OfferDraft): OfferErrors {
  const errors: OfferErrors = {}
  const name = draft.productName.trim()
  const quantity = Number(draft.quantity.replace(",", "."))
  const promotional = parseMoneyToCents(draft.promotionalPrice)
  const previous = parseMoneyToCents(draft.previousPrice)

  if (!name) {
    errors.productName = "Informe o nome do produto."
  } else if (name.split(/\s+/).some((word) => countStoryNameCharacters(word) > STORY_NAME_MAX_WORD_CHARACTERS)) {
    errors.productName = `Cada palavra pode ter no máximo ${STORY_NAME_MAX_WORD_CHARACTERS} letras ou números neste cartaz.`
  } else if (countStoryNameCharacters(name) > STORY_NAME_LINE_LIMIT * STORY_NAME_MAX_LINES) {
    errors.productName = "Use no máximo 27 letras ou números para este cartaz."
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = "Informe uma quantidade maior que zero."
  } else if (quantity > 9999) {
    errors.quantity = "A quantidade máxima deste cartaz é 9.999."
  } else if (!Number.isInteger(quantity * 1000)) {
    errors.quantity = "Use no máximo três casas decimais na quantidade."
  }

  if (promotional === null || promotional <= 0) {
    errors.promotionalPrice = "Informe um preço promocional maior que zero."
  }

  if (draft.hasPreviousPrice) {
    if (previous === null || previous <= 0) {
      errors.previousPrice = "Informe o preço cheio ou desative esta opção."
    } else if (promotional !== null && previous <= promotional) {
      errors.previousPrice = "O preço cheio precisa ser maior que o promocional."
    }
  }

  return errors
}

export function normalizeOffer(draft: OfferDraft): Offer {
  const errors = validateOfferDraft(draft)
  if (Object.keys(errors).length > 0) {
    throw new Error("A oferta contém dados inválidos.")
  }

  const promotionalPriceCents = parseMoneyToCents(draft.promotionalPrice)!
  const previousPriceCents = draft.hasPreviousPrice
    ? parseMoneyToCents(draft.previousPrice)!
    : undefined

  return {
    productName: draft.productName.trim(),
    quantity: Number(draft.quantity.replace(",", ".")),
    unit: draft.unit,
    promotionalPriceCents,
    previousPriceCents,
  }
}

export function offerForPreview(draft: OfferDraft): Offer {
  const quantity = Number(draft.quantity.replace(",", "."))
  const promotionalPriceCents = parseMoneyToCents(draft.promotionalPrice)
  const previousPriceCents = draft.hasPreviousPrice
    ? parseMoneyToCents(draft.previousPrice)
    : undefined

  return {
    productName: draft.productName.trim() || "Produto",
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
    unit: draft.unit,
    promotionalPriceCents:
      promotionalPriceCents !== null && promotionalPriceCents > 0
        ? promotionalPriceCents
        : 0,
    previousPriceCents:
      previousPriceCents !== null && previousPriceCents !== undefined && previousPriceCents > 0
        ? previousPriceCents
        : undefined,
  }
}

export function formatPresentation(quantity: number, unit: PresentationUnit): string {
  const formattedQuantity = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(quantity)
  return `${formattedQuantity} ${PRESENTATION_UNIT_LABELS[unit].toUpperCase()}`
}
