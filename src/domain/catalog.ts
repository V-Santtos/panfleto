import { PRESENTATION_UNITS, type PresentationUnit } from "./offer.js"

export const CATALOG_NAME_RESULT_LIMIT = 12
export const PRODUCT_DISPLAY_NAME_MAX_LENGTH = 200

export type CatalogSearchInput =
  | { kind: "registered_name"; query: string }
  | { kind: "exact_gtin"; gtin: string }
  | { kind: "invalid_numeric"; value: string }

export type CatalogProductImage = {
  id: string
  sourceOrigin: "openfoodfacts" | "gs1" | "cosmos" | "curadoria_interna" | "upload_usuario"
  url: string
  widthPx: number
  heightPx: number
  visibleLeftPx: number
  visibleTopPx: number
  visibleWidthPx: number
  visibleHeightPx: number
  hasIntrinsicContactShadow: boolean
}

export type CatalogProduct = {
  id: string
  gtin?: string
  canonicalName: string
  displayName: string
  brandName?: string
  defaultQuantity: number
  defaultUnit: PresentationUnit
  status: "draft" | "active" | "archived"
  primaryImage?: CatalogProductImage
}

export type DraftProductInput = {
  gtin?: string
  canonicalName: string
  displayName: string
  brandName?: string
  defaultQuantity: number
  defaultUnit: PresentationUnit
  registrationMethod: "gtin_lookup" | "manual"
  metadataOrigin: "openfoodfacts" | "cosmos" | "curadoria_interna" | "manual"
}

export type ValidatedProductInput = DraftProductInput & {
  catalogProductId?: string
  sourceOrigin: CatalogProductImage["sourceOrigin"]
  sourceUrl?: string
  processingMethod: "alpha_preserved" | "deterministic_cutout" | "kie"
  pipelineVersion: string
  sourceWidthPx: number
  sourceHeightPx: number
  visibleLeftPx: number
  visibleTopPx: number
  visibleWidthPx: number
  visibleHeightPx: number
  hasIntrinsicContactShadow: boolean
}

export type ProductDisplayNameInput = {
  displayName: string
}

export function isValidGtin(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false
  const digits = [...value].map(Number)
  const expectedCheckDigit = digits.at(-1)!
  const sum = digits.slice(0, -1).reverse().reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
    0,
  )
  return (10 - (sum % 10)) % 10 === expectedCheckDigit
}

export function classifyCatalogSearch(value: string): CatalogSearchInput {
  const trimmed = value.trim()
  const compact = trimmed.replace(/[\s-]/g, "")
  if (/^[\d\s-]+$/.test(trimmed) && compact) {
    return isValidGtin(compact)
      ? { kind: "exact_gtin", gtin: compact }
      : { kind: "invalid_numeric", value: compact }
  }

  const normalized = trimmed.replace(/\s+/g, " ")
  return { kind: "registered_name", query: normalized }
}

export function validateDraftProduct(input: DraftProductInput): void {
  if (!input.canonicalName.trim() || input.canonicalName.trim().length > 200) {
    throw new Error("Informe um nome de produto com até 200 caracteres.")
  }
  if (input.brandName && input.brandName.trim().length > 120) {
    throw new Error("Informe uma marca com até 120 caracteres.")
  }
  validateProductDisplayName(input.displayName)
  if (!Number.isFinite(input.defaultQuantity) || input.defaultQuantity <= 0 || input.defaultQuantity > 9999) {
    throw new Error("Informe uma quantidade entre 0 e 9.999.")
  }
  if (!Number.isInteger(input.defaultQuantity * 1000)) {
    throw new Error("Use no máximo três casas decimais na quantidade.")
  }
  if (!PRESENTATION_UNITS.includes(input.defaultUnit)) {
    throw new Error("Informe uma unidade válida.")
  }
  if (input.gtin && !isValidGtin(input.gtin)) {
    throw new Error("Informe um GTIN/EAN válido.")
  }
  if (input.registrationMethod === "gtin_lookup" && !input.gtin) {
    throw new Error("Um cadastro originado por consulta exige GTIN/EAN.")
  }
}

export function validateProductDisplayName(value: string): void {
  const normalized = value.trim().replace(/\s+/g, " ")
  if (!normalized || normalized.length > PRODUCT_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Informe um nome para o cartaz com até ${PRODUCT_DISPLAY_NAME_MAX_LENGTH} caracteres.`)
  }
}

export function validateValidatedProduct(input: ValidatedProductInput): void {
  validateDraftProduct(input)
  if (input.catalogProductId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.catalogProductId)) {
    throw new Error("O identificador do produto cadastrado é inválido.")
  }
  if (input.sourceUrl && !/^https:\/\//i.test(input.sourceUrl)) {
    throw new Error("A procedência da foto precisa usar HTTPS.")
  }
  if (!input.pipelineVersion.trim() || input.pipelineVersion.length > 80) {
    throw new Error("A versão do processamento da foto é inválida.")
  }
  const integers = [
    input.sourceWidthPx,
    input.sourceHeightPx,
    input.visibleLeftPx,
    input.visibleTopPx,
    input.visibleWidthPx,
    input.visibleHeightPx,
  ]
  if (!integers.every(Number.isInteger)
    || input.sourceWidthPx <= 0
    || input.sourceHeightPx <= 0
    || input.visibleLeftPx < 0
    || input.visibleTopPx < 0
    || input.visibleWidthPx <= 0
    || input.visibleHeightPx <= 0
    || input.visibleLeftPx + input.visibleWidthPx > input.sourceWidthPx
    || input.visibleTopPx + input.visibleHeightPx > input.sourceHeightPx) {
    throw new Error("A geometria da foto validada é inconsistente.")
  }
}
