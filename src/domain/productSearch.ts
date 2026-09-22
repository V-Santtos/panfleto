import type { ImageProvenance } from "../images/types"
import { findRegisteredProductByGtin, searchRegisteredProducts } from "../api/catalogClient"
import { classifyCatalogSearch, type CatalogProduct } from "./catalog"
import type { PresentationUnit } from "./offer"
import { lookupCosmosGtin, type CosmosResponse } from "./cosmosClient"

export const PRODUCT_CANDIDATE_LIMIT = 12

export type ProductPhotoOption = ImageProvenance & {
  id: string
  imageUrl: string
  thumbnailUrl: string
  url_original: string
  imageWidth?: number
  imageHeight?: number
}

export type ProductCandidate = ImageProvenance & {
  code: string
  productName: string
  canonicalName?: string
  brands: string[]
  quantity: string
  imageUrl?: string
  thumbnailUrl?: string
  imageWidth?: number
  imageHeight?: number
  photoOptions?: ProductPhotoOption[]
  catalogProductId?: string
  catalogImageId?: string
  catalogImageGeometry?: {
    sourceWidth: number
    sourceHeight: number
    visibleBounds: { left: number; top: number; width: number; height: number }
    hasIntrinsicContactShadow: boolean
  }
}

type ImageSize = { w?: number; h?: number }
type SelectedImage = { rev?: string | number; sizes?: Record<string, ImageSize> }

type SearchHit = {
  code?: string
  product_name?: string
  brands?: string[] | string
  quantity?: string
  image_front_url?: string
  image_front_small_url?: string
  countries_tags?: string[]
  lang?: string
  images?: Record<string, SelectedImage>
}

type BarcodeResponse = {
  product?: SearchHit | null
}

type CosmosProduct = {
  gtin?: string | number
  description?: string
  brand?: { name?: string } | null
  thumbnail?: string
}

export type ProductSearchResult = {
  candidates: ProductCandidate[]
  elapsedMs: number
  examinedCount: number
  eligibleCount: number
  sourceWarnings: ProductSearchSourceWarning[]
}

export type ProductSearchSourceWarning = {
  source: "cosmos"
  kind: "unavailable" | "invalid-response" | "different-gtin" | "missing-photo"
  message: string
}

function normalizeBrands(brands: SearchHit["brands"]): string[] {
  if (Array.isArray(brands)) return brands.filter((brand): brand is string => typeof brand === "string").map((brand) => brand.trim()).filter(Boolean)
  if (typeof brands === "string") return brands.split(",").map((brand) => brand.trim()).filter(Boolean)
  return []
}

function equivalentGtin(first: string, second: string): boolean {
  return first.padStart(14, "0") === second.padStart(14, "0")
}

// Only selected OFF fronts, never arbitrary hosts, ingredient photos or raw uploads.
function parseFront(value: unknown): URL | undefined {
  if (typeof value !== "string") return
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return
    if (!["images.openfoodfacts.org", "static.openfoodfacts.org"].includes(url.hostname)) return
    if (!/^\/images\/products\/(?:\d+\/)+front_[a-z]{2}\.\d+\.(?:100|200|400|full)\.jpg$/.test(url.pathname)) return
    url.search = ""
    url.hash = ""
    return url
  } catch {
    return
  }
}

function validSize(size: ImageSize | undefined): size is { w: number; h: number } {
  return Boolean(size && Number.isFinite(size.w) && Number.isFinite(size.h) && size.w! > 0 && size.h! > 0)
}

function selectedFront(hit: SearchHit): Pick<ProductCandidate, "imageUrl" | "thumbnailUrl" | "imageWidth" | "imageHeight"> | undefined {
  const returnedFront = parseFront(hit.image_front_url)
  const activeKey = returnedFront?.pathname.match(/(front_[a-z]{2})\.\d+\./)?.[1]
  const images = hit.images && typeof hit.images === "object" ? hit.images : {}
  const preferredKeys = [...new Set([
    "front_pt", activeKey, typeof hit.lang === "string" ? `front_${hit.lang}` : undefined,
    ...Object.keys(images).filter((key) => /^front_[a-z]{2}$/.test(key)).sort(),
  ])]

  for (const key of preferredKeys) {
    if (!key || !/^front_[a-z]{2}$/.test(key)) continue
    const selected = images[key]
    if (!selected || !/^\d+$/.test(String(selected.rev)) || !selected.sizes) continue
    const sizes = Object.entries(selected.sizes)
      .filter(([name, size]) => /^(100|200|400|full)$/.test(name) && validSize(size))
      .sort(([a, sa], [b, sb]) => a === "full" ? -1 : b === "full" ? 1 : Math.max(sb.w!, sb.h!) - Math.max(sa.w!, sa.h!))
    if (!sizes.length) continue
    const [sizeName, dimensions] = sizes[0]
    const folder = hit.code!.length > 8 ? hit.code!.replace(/^(\d{3})(\d{3})(\d{3})(\d+)$/, "$1/$2/$3/$4") : hit.code!
    const base = `https://images.openfoodfacts.org/images/products/${folder}/${key}.${selected.rev}`
    const imageUrl = `${base}.${sizeName}.jpg`
    const thumbSize = validSize(selected.sizes["200"]) ? "200" : validSize(selected.sizes["400"]) ? "400" : sizeName
    return { imageUrl, thumbnailUrl: `${base}.${thumbSize}.jpg`, imageWidth: dimensions.w, imageHeight: dimensions.h }
  }

  if (!returnedFront) return
  // OFF documents .full.jpg for the same selected front/revision. No extension guessing.
  const imageUrl = returnedFront.href.replace(/\.(100|200|400)\.jpg$/, ".full.jpg")
  const thumbnail = parseFront(hit.image_front_small_url)
  const sameFront = thumbnail?.href.replace(/\.(100|200|400|full)\.jpg$/, ".full.jpg") === imageUrl
  return { imageUrl, thumbnailUrl: sameFront ? thumbnail!.href : returnedFront.href }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object")
}

function cosmosProduct(response: CosmosResponse | undefined, code: string): {
  product?: CosmosProduct
  warning?: ProductSearchSourceWarning
} {
  if (!response || !isRecord(response.data)) {
    return {
      warning: { source: "cosmos", kind: "invalid-response", message: "O Cosmos não devolveu dados válidos para este GTIN." },
    }
  }
  const product = response.data as CosmosProduct
  const gtin = typeof product.gtin === "number" || typeof product.gtin === "string" ? String(product.gtin) : ""
  if (!gtin) {
    return {
      warning: { source: "cosmos", kind: "invalid-response", message: "O Cosmos não devolveu um GTIN confirmável para este produto." },
    }
  }
  if (!equivalentGtin(gtin, code)) {
    return {
      warning: { source: "cosmos", kind: "different-gtin", message: "O Cosmos devolveu um produto de outro GTIN; a foto foi ignorada." },
    }
  }
  return { product }
}

function cosmosThumbnail(value: unknown, code: string): ProductPhotoOption | undefined {
  if (typeof value !== "string") return
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || url.hostname !== "cdn-cosmos.bluesoft.com.br"
      || url.pathname !== `/products/${code}`
    ) return
    url.search = ""
    url.hash = ""
    return { id: "cosmos", origem: "cosmos", url_original: url.href, imageUrl: url.href, thumbnailUrl: url.href }
  } catch {
    return
  }
}

function mergedExactCandidate(code: string, freeHit: SearchHit | undefined, cosmos: CosmosProduct | undefined): ProductCandidate | undefined {
  const free = freeHit && typeof freeHit.code === "string" && equivalentGtin(freeHit.code, code) ? freeHit : undefined
  if (!free && !cosmos) return

  const freeName = typeof free?.product_name === "string" ? free.product_name.trim() : ""
  const freeBrands = normalizeBrands(free?.brands)
  const cosmosName = typeof cosmos?.description === "string" ? cosmos.description.trim() : ""
  const cosmosBrand = cosmos?.brand && typeof cosmos.brand.name === "string" ? cosmos.brand.name.trim() : ""
  const front = free ? selectedFront(free) : undefined
  const photos: ProductPhotoOption[] = []
  if (front?.imageUrl && front.thumbnailUrl) {
    photos.push({
      id: "openfoodfacts",
      origem: "openfoodfacts",
      url_original: front.imageUrl,
      imageUrl: front.imageUrl,
      thumbnailUrl: front.thumbnailUrl,
      imageWidth: front.imageWidth,
      imageHeight: front.imageHeight,
    })
  }
  const cosmosPhoto = cosmosThumbnail(cosmos?.thumbnail, code)
  if (cosmosPhoto && !photos.some((photo) => photo.url_original === cosmosPhoto.url_original)) photos.push(cosmosPhoto)
  const primaryPhoto = photos[0]
  const quantity = typeof free?.quantity === "string" && free.quantity.trim() ? free.quantity.trim() : "Quantidade não informada"

  return {
    code,
    productName: freeName || cosmosName || "Produto sem descrição",
    canonicalName: freeName || cosmosName || "Produto sem descrição",
    brands: freeBrands.length ? freeBrands : cosmosBrand ? [cosmosBrand] : [],
    quantity,
    origem: primaryPhoto?.origem ?? (free ? "openfoodfacts" : "cosmos"),
    ...(primaryPhoto ? {
      url_original: primaryPhoto.url_original,
      imageUrl: primaryPhoto.imageUrl,
      thumbnailUrl: primaryPhoto.thumbnailUrl,
      imageWidth: primaryPhoto.imageWidth,
      imageHeight: primaryPhoto.imageHeight,
      photoOptions: photos,
    } : { photoOptions: photos }),
  }
}

export function productCandidateFromCatalog(product: CatalogProduct): ProductCandidate {
  const image = product.primaryImage
  return {
    code: product.gtin ?? `catalog:${product.id}`,
    productName: product.displayName,
    canonicalName: product.canonicalName,
    brands: product.brandName ? [product.brandName] : [],
    quantity: `${product.defaultQuantity} ${product.defaultUnit}`,
    origem: image?.sourceOrigin ?? "curadoria_interna",
    catalogProductId: product.id,
    ...(image ? {
      catalogImageId: image.id,
      url_original: image.url,
      imageUrl: image.url,
      thumbnailUrl: image.url,
      imageWidth: image.widthPx,
      imageHeight: image.heightPx,
      photoOptions: [{
        id: `catalog:${image.id}`,
        origem: image.sourceOrigin,
        url_original: image.url,
        imageUrl: image.url,
        thumbnailUrl: image.url,
        imageWidth: image.widthPx,
        imageHeight: image.heightPx,
      }],
      catalogImageGeometry: {
        sourceWidth: image.widthPx,
        sourceHeight: image.heightPx,
        visibleBounds: {
          left: image.visibleLeftPx,
          top: image.visibleTopPx,
          width: image.visibleWidthPx,
          height: image.visibleHeightPx,
        },
        hasIntrinsicContactShadow: image.hasIntrinsicContactShadow,
      },
    } : {}),
  }
}

export async function searchProductCandidates(query: string, options: { signal?: AbortSignal } = {}): Promise<ProductSearchResult> {
  if (query.length > 160) throw new Error("Digite uma busca com até 160 caracteres.")
  const input = classifyCatalogSearch(query)
  if (input.kind === "invalid_numeric") {
    throw new Error("Confira o GTIN/EAN: use 8, 12, 13 ou 14 dígitos com o dígito verificador correto.")
  }
  const startedAt = performance.now()
  if (input.kind === "registered_name") {
    if (input.query.length < 2) throw new Error("Digite pelo menos 2 caracteres do nome ou da marca do produto.")
    const products = await searchRegisteredProducts(input.query, { signal: options.signal })
    options.signal?.throwIfAborted()
    const candidates = products.map(productCandidateFromCatalog).slice(0, PRODUCT_CANDIDATE_LIMIT)
    return {
      candidates,
      elapsedMs: Math.round(performance.now() - startedAt),
      examinedCount: products.length,
      eligibleCount: products.length,
      sourceWarnings: [],
    }
  }

  const registered = await findRegisteredProductByGtin(input.gtin, { signal: options.signal })
  options.signal?.throwIfAborted()
  if (registered) {
    return {
      candidates: [productCandidateFromCatalog(registered)],
      elapsedMs: Math.round(performance.now() - startedAt),
      examinedCount: 1,
      eligibleCount: 1,
      sourceWarnings: [],
    }
  }

  const params = new URLSearchParams({
    fields: "code,product_name,brands,quantity,countries_tags,lang,images,image_front_small_url,image_front_url",
  })
  {
    const freeUrl = `/api/product-by-barcode/${input.gtin}?${params}`
    const [freeResult, cosmosResult] = await Promise.allSettled([
      (async () => {
        const response = await fetch(freeUrl, { signal: options.signal })
        if (!response.ok) throw new Error(`A busca gratuita falhou (HTTP ${response.status}).`)
        const data = await response.json() as BarcodeResponse
        if (!data || !("product" in data)) throw new Error("A busca gratuita retornou uma resposta inválida.")
        return data.product ?? undefined
      })(),
      lookupCosmosGtin(input.gtin, { signal: options.signal }),
    ])
    options.signal?.throwIfAborted()

    const freeHit = freeResult.status === "fulfilled" ? freeResult.value : undefined
    const cosmosLookup = cosmosResult.status === "fulfilled" ? cosmosProduct(cosmosResult.value, input.gtin) : undefined
    const cosmosHit = cosmosLookup?.product
    const sourceWarnings: ProductSearchSourceWarning[] = []
    if (cosmosResult.status === "rejected") {
      sourceWarnings.push({ source: "cosmos", kind: "unavailable", message: "Não foi possível consultar o Cosmos nesta busca." })
    } else if (cosmosLookup?.warning) {
      sourceWarnings.push(cosmosLookup.warning)
    } else if (cosmosHit && !cosmosThumbnail(cosmosHit.thumbnail, input.gtin)) {
      sourceWarnings.push({ source: "cosmos", kind: "missing-photo", message: "O Cosmos confirmou o produto, mas não forneceu uma foto utilizável." })
    }
    const candidate = mergedExactCandidate(input.gtin, freeHit, cosmosHit)
    if (!candidate && freeResult.status === "rejected") throw freeResult.reason
    if (!candidate && cosmosResult.status === "rejected") throw cosmosResult.reason
    return {
      candidates: candidate ? [candidate] : [],
      elapsedMs: Math.round(performance.now() - startedAt),
      examinedCount: Number(Boolean(freeHit)) + Number(Boolean(cosmosHit)),
      eligibleCount: candidate ? 1 : 0,
      sourceWarnings,
    }
  }
}

export function presentationFromQuantity(quantity: string): { quantity: number; unit: PresentationUnit } | null {
  const match = quantity.match(/([\d.,]+)\s*(kg|g|ml|l|unidades?|un\.?|und\.?)\b/i)
  if (!match) return null
  const parsedQuantity = Number(match[1].replace(",", "."))
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return null

  const rawUnit = match[2].toLowerCase().replace(/\.$/, "")
  const unit: PresentationUnit = rawUnit === "l"
    ? "L"
    : rawUnit === "un" || rawUnit === "und" || rawUnit.startsWith("unidade")
      ? "unidade"
      : rawUnit as Exclude<PresentationUnit, "L" | "unidade">

  return { quantity: parsedQuantity, unit }
}
