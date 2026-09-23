import type { IncomingMessage, ServerResponse } from "node:http"

import type { Plugin } from "vite"

import {
  CATALOG_NAME_RESULT_LIMIT,
  classifyCatalogSearch,
  validateDraftProduct,
  validateProductDisplayName,
  validateValidatedProduct,
  type DraftProductInput,
  type ValidatedProductInput,
} from "../src/domain/catalog.js"
import {
  CatalogRepositoryError,
  createCatalogRepository,
  type CatalogRepository,
} from "./catalogRepository.js"
import { inspectImageBytes } from "./imageMetadata.js"
import { SupabaseConfigurationError, type SupabaseServerConfig } from "./supabaseClient.js"

const PREFIX = "/api/catalogo"
const MAX_JSON_BODY_BYTES = 64 * 1024
const MAX_IMAGE_BODY_BYTES = 12 * 1024 * 1024

type RepositoryProvider = () => CatalogRepository

class RequestValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RequestValidationError"
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.writableEnded || response.destroyed) return
  response.statusCode = status
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.end(JSON.stringify(body))
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) throw new RequestValidationError("O corpo da requisição excede 64 KB.")
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  } catch {
    throw new RequestValidationError("Envie um objeto JSON válido.")
  }
}

async function readImageBody(request: IncomingMessage): Promise<Uint8Array> {
  const declaredLength = Number(request.headers["content-length"] ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BODY_BYTES) {
    throw new RequestValidationError("A foto excede o limite de 12 MB.")
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_IMAGE_BODY_BYTES) throw new RequestValidationError("A foto excede o limite de 12 MB.")
    chunks.push(buffer)
  }
  if (!size) throw new RequestValidationError("Envie a foto validada do produto.")
  return Buffer.concat(chunks)
}

// Fora da máquina local o navegador sempre envia Origin em POST/PATCH; exigi-lo
// impede que outro site dispare gravações usando o domínio publicado.
export function isAllowedMutationOrigin(hostHeader: string | undefined, origin: string | undefined): boolean {
  const host = hostHeader?.toLowerCase() ?? ""
  if (!host) return false
  const isLocal = /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)
  if (!origin) return isLocal
  try {
    const parsed = new URL(origin)
    return parsed.protocol === (isLocal ? "http:" : "https:") && parsed.host.toLowerCase() === host
  } catch {
    return false
  }
}

function assertSameOriginMutation(request: IncomingMessage): void {
  if (!isAllowedMutationOrigin(request.headers.host, request.headers.origin)) {
    throw new RequestValidationError("A origem da gravação do catálogo é inválida.")
  }
}

function draftProductInput(value: unknown, method: "manual" | "gtin_lookup"): DraftProductInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestValidationError("Envie os dados do produto.")
  const record = value as Record<string, unknown>
  const gtin = typeof record.gtin === "string" ? record.gtin.trim() : undefined
  const canonicalName = typeof record.canonicalName === "string" ? record.canonicalName : ""
  const input: DraftProductInput = {
    ...(gtin ? { gtin } : {}),
    canonicalName,
    displayName: typeof record.displayName === "string" ? record.displayName : canonicalName,
    ...(typeof record.brandName === "string" && record.brandName.trim() ? { brandName: record.brandName } : {}),
    defaultQuantity: typeof record.defaultQuantity === "number" ? record.defaultQuantity : Number.NaN,
    defaultUnit: record.defaultUnit as DraftProductInput["defaultUnit"],
    registrationMethod: method,
    metadataOrigin: method === "manual"
      ? "manual"
      : record.metadataOrigin === "cosmos" ? "cosmos" : "openfoodfacts",
  }
  try {
    validateDraftProduct(input)
  } catch (error) {
    throw new RequestValidationError(error instanceof Error ? error.message : "Dados de produto inválidos.")
  }
  return input
}

function productDisplayNameInput(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestValidationError("Envie o nome do cartaz.")
  const displayName = typeof (value as Record<string, unknown>).displayName === "string"
    ? (value as Record<string, unknown>).displayName as string
    : ""
  try {
    validateProductDisplayName(displayName)
  } catch (error) {
    throw new RequestValidationError(error instanceof Error ? error.message : "O nome do cartaz é inválido.")
  }
  return displayName.trim().replace(/\s+/g, " ")
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function validatedProductInput(request: IncomingMessage): ValidatedProductInput {
  const encoded = request.headers["x-catalog-metadata"]
  if (typeof encoded !== "string" || encoded.length > 16 * 1024) {
    throw new RequestValidationError("Envie os metadados da validação do produto.")
  }
  let value: unknown
  try {
    value = JSON.parse(decodeURIComponent(encoded)) as unknown
  } catch {
    throw new RequestValidationError("Os metadados da validação são inválidos.")
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestValidationError("Envie os dados do produto validado.")
  const record = value as Record<string, unknown>
  const method = record.registrationMethod === "manual" ? "manual" : "gtin_lookup"
  const draft = draftProductInput(record, method)
  const sourceOrigins = ["openfoodfacts", "gs1", "cosmos", "curadoria_interna", "upload_usuario"] as const
  const processingMethods = ["alpha_preserved", "deterministic_cutout", "kie"] as const
  const sourceOrigin = sourceOrigins.find((item) => item === record.sourceOrigin)
  const processingMethod = processingMethods.find((item) => item === record.processingMethod)
  if (!sourceOrigin || !processingMethod) throw new RequestValidationError("A procedência ou o processamento da foto é inválido.")
  const input: ValidatedProductInput = {
    ...draft,
    ...(typeof record.catalogProductId === "string" ? { catalogProductId: record.catalogProductId } : {}),
    sourceOrigin,
    ...(typeof record.sourceUrl === "string" && record.sourceUrl.trim() ? { sourceUrl: record.sourceUrl.trim() } : {}),
    processingMethod,
    pipelineVersion: typeof record.pipelineVersion === "string" ? record.pipelineVersion : "",
    sourceWidthPx: Number(record.sourceWidthPx),
    sourceHeightPx: Number(record.sourceHeightPx),
    visibleLeftPx: Number(record.visibleLeftPx),
    visibleTopPx: Number(record.visibleTopPx),
    visibleWidthPx: Number(record.visibleWidthPx),
    visibleHeightPx: Number(record.visibleHeightPx),
    hasIntrinsicContactShadow: record.hasIntrinsicContactShadow === true,
  }
  try {
    validateValidatedProduct(input)
  } catch (error) {
    throw new RequestValidationError(error instanceof Error ? error.message : "Dados do produto validado são inválidos.")
  }
  return input
}

export function createCatalogApiHandler(repositoryProvider: RepositoryProvider) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void = () => undefined): Promise<void> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (!url.pathname.startsWith(PREFIX)) { next(); return }

    try {
      const repository = repositoryProvider()
      if (url.pathname === `${PREFIX}/status`) {
        if (request.method !== "GET") { sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }); return }
        sendJson(response, 200, { configured: true })
        return
      }

      if (url.pathname === `${PREFIX}/products`) {
        if (request.method !== "GET") { sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }); return }
        const name = url.searchParams.get("name") ?? ""
        const classified = classifyCatalogSearch(name)
        if (classified.kind !== "registered_name" || classified.query.length < 2 || classified.query.length > 160) {
          throw new RequestValidationError("A busca por nome precisa ter entre 2 e 160 caracteres.")
        }
        const products = await repository.searchActiveProducts(classified.query, CATALOG_NAME_RESULT_LIMIT)
        sendJson(response, 200, { products: products.slice(0, CATALOG_NAME_RESULT_LIMIT) })
        return
      }

      if (url.pathname === `${PREFIX}/products/validate`) {
        if (request.method !== "POST") { sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }); return }
        assertSameOriginMutation(request)
        const input = validatedProductInput(request)
        const bytes = await readImageBody(request)
        let inspected: ReturnType<typeof inspectImageBytes>
        try {
          inspected = inspectImageBytes(bytes, request.headers["content-type"])
        } catch (error) {
          throw new RequestValidationError(error instanceof Error ? error.message : "A foto enviada é inválida.")
        }
        if (inspected.width !== input.sourceWidthPx || inspected.height !== input.sourceHeightPx) {
          throw new RequestValidationError("As dimensões medidas não correspondem aos bytes da foto.")
        }
        const product = await repository.validateProductWithImage(input, { bytes, ...inspected })
        sendJson(response, 200, { product })
        return
      }

      const displayNameMatch = url.pathname.match(/^\/api\/catalogo\/products\/([^/]+)\/display-name$/)
      if (displayNameMatch) {
        if (request.method !== "PATCH") { sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }); return }
        assertSameOriginMutation(request)
        const productId = decodeURIComponent(displayNameMatch[1])
        if (!isUuid(productId)) throw new RequestValidationError("O identificador do produto cadastrado é inválido.")
        const product = await repository.updateProductDisplayName(productId, productDisplayNameInput(await readJsonBody(request)))
        sendJson(response, 200, { product })
        return
      }

      const gtinMatch = url.pathname.match(/^\/api\/catalogo\/products\/by-gtin\/([^/]+)$/)
      if (gtinMatch) {
        if (request.method !== "GET") { sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }); return }
        const classified = classifyCatalogSearch(decodeURIComponent(gtinMatch[1]))
        if (classified.kind !== "exact_gtin") throw new RequestValidationError("Informe um GTIN/EAN válido.")
        const product = await repository.findProductByGtin(classified.gtin)
        if (!product) { sendJson(response, 404, { code: "PRODUCT_NOT_FOUND", message: "Produto ainda não cadastrado." }); return }
        sendJson(response, 200, { product })
        return
      }

      if (url.pathname === `${PREFIX}/products/manual`) {
        if (request.method !== "POST") { sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }); return }
        throw new RequestValidationError("Envie uma foto ao cadastrar manualmente o produto.")
      }
      const creationMethod = url.pathname === `${PREFIX}/products/from-gtin` ? "gtin_lookup" : undefined
      if (creationMethod) {
        if (request.method !== "POST") { sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }); return }
        const product = await repository.createDraftProduct(draftProductInput(await readJsonBody(request), creationMethod))
        sendJson(response, 201, { product })
        return
      }

      sendJson(response, 404, { code: "ROUTE_NOT_FOUND", message: "Rota do catálogo não encontrada." })
    } catch (error) {
      if (error instanceof SupabaseConfigurationError) {
        sendJson(response, 503, { code: error.code, message: error.message }); return
      }
      if (error instanceof RequestValidationError) {
        sendJson(response, 400, { code: "VALIDATION_ERROR", message: error.message }); return
      }
      if (error instanceof CatalogRepositoryError) {
        const status = error.kind === "conflict" ? 409 : error.kind === "not_found" ? 404 : error.kind === "unavailable" ? 503 : 500
        sendJson(response, status, { code: `CATALOG_${error.kind.toUpperCase()}`, message: error.message }); return
      }
      sendJson(response, 500, { code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação do catálogo." })
    }
  }
}

export function catalogApi(config: SupabaseServerConfig, repository?: CatalogRepository): Plugin {
  let configuredRepository = repository
  const handler = createCatalogApiHandler(() => {
    configuredRepository ??= createCatalogRepository(config)
    return configuredRepository
  })
  return {
    name: "local-catalog-api",
    configureServer(server) {
      server.middlewares.use(handler)
    },
  }
}
