import type { IncomingMessage, ServerResponse } from "node:http"

import type { Plugin } from "vite"

const PREFIX = "/api/kie/remove-background"
const IMPORT_PATH = `${PREFIX}/import`
const STATUS_PATH = "/api/kie/status"
const KIE_API_ORIGIN = "https://api.kie.ai"
const KIE_UPLOAD_ORIGIN = "https://kieai.redpandaai.co"
const ROUTE_REVISION = "kie-manual-upload-v4"
const MAX_BODY_BYTES = 7 * 1024 * 1024
const MAX_KIE_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_KIE_RESULT_BYTES = 12 * 1024 * 1024
const MAX_KIE_RESULT_REDIRECTS = 3
const KIE_TIMEOUT_MS = 20_000
const PUBLIC_IMAGE_HOSTS = new Set(["images.openfoodfacts.org", "static.openfoodfacts.org"])

type KieUploadResponse = {
  success?: boolean
  data?: { downloadUrl?: string }
}

type KieTaskCreationDiagnostic = {
  httpStatus: number
  providerCode?: number | string
  providerMessage?: string
  dataKeys: string[]
  taskIdType: string
}

type KieResultImage = {
  url: string
  resultJson: Record<string, unknown>
  resultJsonWasString: boolean
}

// Um crédito da Kie é gasto na criação da tarefa. Quando algo falha depois disso, a
// etapa precisa aparecer no erro: sem ela o operador vê apenas "fetch failed" e não
// há como saber se o problema foi o provedor, o download ou os bytes recebidos.
export type KieStage = "upload" | "createTask" | "recordInfo" | "download"

export class KieStageError extends Error {
  constructor(readonly stage: KieStage, message: string) {
    super(message)
    this.name = "KieStageError"
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function providerMessage(body: unknown, fallback: string): string {
  const response = record(body)
  if (typeof response?.msg === "string" && response.msg.trim()) {
    return `${fallback} (${response.msg.trim()})`
  }
  return fallback
}

export function uploadFileName(dataUrl: string): string {
  const mime = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,/i)?.[1]?.toLowerCase()
  const extension = mime === "jpeg" ? "jpg" : mime === "webp" ? "webp" : "png"
  return `embalagem-manual.${extension}`
}

export function isAllowedKieSourceUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password && !url.port && PUBLIC_IMAGE_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

export function isAllowedKieDataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match || match[2].length % 4 !== 0) return false
  return Buffer.from(match[2], "base64").byteLength <= MAX_KIE_UPLOAD_BYTES
}

export function isKieTaskId(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 512 && !/[\u0000-\u001F\u007F]/.test(value)
}

export function taskIdFromCreateResponse(body: unknown): string | undefined {
  const data = record(record(body)?.data)
  return isKieTaskId(data?.taskId) ? data.taskId : undefined
}

export function createTaskDiagnostic(httpStatus: number, body: unknown): KieTaskCreationDiagnostic {
  const response = record(body)
  const data = record(response?.data)
  const taskId = data?.taskId
  const diagnostic: KieTaskCreationDiagnostic = {
    httpStatus,
    dataKeys: data ? Object.keys(data).sort() : [],
    taskIdType: taskId === undefined ? "absent" : Array.isArray(taskId) ? "array" : typeof taskId,
  }
  if (typeof response?.code === "number" || typeof response?.code === "string") diagnostic.providerCode = response.code
  if (typeof response?.msg === "string" && response.msg.trim()) diagnostic.providerMessage = response.msg.trim()
  return diagnostic
}

function taskCreationFailureMessage(diagnostic: KieTaskCreationDiagnostic): string {
  const dataShape = diagnostic.dataKeys.length ? `campos em data: ${diagnostic.dataKeys.join(", ")}` : "sem objeto data"
  return `A Kie respondeu à criação sem um data.taskId utilizável (HTTP ${diagnostic.httpStatus}; ${dataShape}).`
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
  let source = ""
  for await (const chunk of request) {
    source += Buffer.from(chunk).toString("utf8")
    if (Buffer.byteLength(source, "utf8") > MAX_BODY_BYTES) throw new Error("O pedido é grande demais.")
  }
  try {
    return JSON.parse(source) as unknown
  } catch {
    throw new Error("O pedido precisa ser JSON válido.")
  }
}

async function callKie(apiKey: string, origin: string, path: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), KIE_TIMEOUT_MS)
  try {
    const response = await fetch(`${origin}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...init.headers,
      },
    })
    const text = await response.text()
    let body: unknown
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = { message: "A Kie retornou uma resposta inválida." }
    }
    return { status: response.status, body }
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

function resultImageMime(bytes: Uint8Array): string | undefined {
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp = bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80
  return png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : undefined
}

// O destino de um redirecionamento é resolvido aqui, e não pelo `fetch`, para que
// cada salto passe pela mesma guarda da URL original. `redirect: "error"` recusava
// qualquer 3xx do CDN da Kie e derrubava o resultado já pago com um `fetch failed`
// sem diagnóstico.
export function nextKieResultHop(status: number, location: string | null, current: string): string | undefined {
  if (status < 300 || status >= 400 || !location) return undefined
  let resolved: string
  try {
    resolved = new URL(location, current).href
  } catch {
    return undefined
  }
  return isKieResultUrl(resolved) ? resolved : undefined
}

async function downloadKieResultImage(source: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), KIE_TIMEOUT_MS)
  try {
    let target = source
    for (let hop = 0; hop <= MAX_KIE_RESULT_REDIRECTS; hop++) {
      const response = await fetch(target, {
        headers: { Accept: "image/png,image/jpeg,image/webp" },
        redirect: "manual",
        signal: controller.signal,
      })
      if (response.status >= 300 && response.status < 400) {
        const next = nextKieResultHop(response.status, response.headers.get("location"), target)
        if (!next) throw new KieStageError("download", `A Kie redirecionou o resultado para um destino não permitido (HTTP ${response.status}).`)
        target = next
        continue
      }
      if (!response.ok) throw new KieStageError("download", `A imagem de resultado da Kie não pôde ser baixada (HTTP ${response.status}).`)
      const declaredLength = Number(response.headers.get("content-length"))
      if (Number.isFinite(declaredLength) && declaredLength > MAX_KIE_RESULT_BYTES) throw new KieStageError("download", "A imagem de resultado da Kie é grande demais.")
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.byteLength > MAX_KIE_RESULT_BYTES) throw new KieStageError("download", "A imagem de resultado da Kie é grande demais.")
      const mimeType = resultImageMime(bytes)
      if (!mimeType) throw new KieStageError("download", "A Kie retornou um resultado que não é uma imagem PNG, JPEG ou WebP.")
      return { bytes, mimeType }
    }
    throw new KieStageError("download", "A imagem de resultado da Kie passou por redirecionamentos demais.")
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

export function isKieTemporaryImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (url.hostname === "kieai.redpandaai.co" || url.hostname.endsWith(".redpandaai.co"))
  } catch {
    return false
  }
}

export function isKieResultUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const privateIpv4 = /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    return url.protocol === "https:" && !url.username && !url.password && !url.port && host !== "localhost" && host !== "::1" && !privateIpv4
  } catch {
    return false
  }
}

export function isKieHostedResultUrl(value: unknown): value is string {
  if (!isKieResultUrl(value)) return false
  const host = new URL(value).hostname.toLowerCase()
  return host === "img-relay.kieops.com" || host.endsWith(".kieops.com")
}

function kieResultImage(body: unknown): KieResultImage | undefined {
  const data = record(record(body)?.data)
  if (data?.state !== "success") return
  const source = data.resultJson
  let resultJson: Record<string, unknown> | undefined
  try {
    resultJson = record(typeof source === "string" ? JSON.parse(source) as unknown : source)
  } catch {
    return
  }
  const firstUrl = Array.isArray(resultJson?.resultUrls) ? resultJson.resultUrls[0] : undefined
  return resultJson && isKieResultUrl(firstUrl) ? { url: firstUrl, resultJson, resultJsonWasString: typeof source === "string" } : undefined
}

export function localizeKieTaskResult(body: unknown, taskId: string): unknown {
  const response = record(body)
  const data = record(response?.data)
  const result = kieResultImage(body)
  if (!response || !data || !result) return body
  const localizedResult = { ...result.resultJson, resultUrls: [`${PREFIX}/${encodeURIComponent(taskId)}/image`] }
  return {
    ...response,
    data: {
      ...data,
      resultJson: result.resultJsonWasString ? JSON.stringify(localizedResult) : localizedResult,
    },
  }
}

function uploadedKieFile(body: unknown): body is KieUploadResponse & { success: true; data: { downloadUrl: string } } {
  return Boolean(
    body
      && typeof body === "object"
      && "success" in body
      && body.success === true
      && "data" in body
      && body.data
      && typeof body.data === "object"
      && "downloadUrl" in body.data
      && isKieTemporaryImageUrl(body.data.downloadUrl),
  )
}

function sendImage(response: ServerResponse, mimeType: string, bytes: Buffer): void {
  if (response.writableEnded || response.destroyed) return
  response.statusCode = 200
  response.setHeader("Content-Type", mimeType)
  response.setHeader("Content-Length", bytes.byteLength)
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.end(bytes)
}

export function createKieBackgroundRemovalHandler(apiKey: string | undefined) {
  const key = apiKey?.trim()
  return async (request: IncomingMessage, response: ServerResponse, next: () => void = () => undefined): Promise<void> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname !== PREFIX && url.pathname !== STATUS_PATH && !url.pathname.startsWith(`${PREFIX}/`)) {
      next()
      return
    }

    if (url.pathname === STATUS_PATH) {
      if (request.method !== "GET") { sendJson(response, 405, { message: "Método não permitido." }); return }
      sendJson(response, 200, { configured: Boolean(key), revision: ROUTE_REVISION })
      return
    }

    if (!key) {
      sendJson(response, 503, { message: "A integração Kie não está configurada. Defina KIE_API_KEY no .env.local e reinicie o servidor." })
      return
    }

    try {
      if (url.pathname === IMPORT_PATH) {
        if (request.method !== "GET") { sendJson(response, 405, { message: "Método não permitido." }); return }
        const source = url.searchParams.get("url")
        if (!isKieHostedResultUrl(source)) {
          sendJson(response, 400, { message: "Envie uma URL de resultado hospedada pela Kie." })
          return
        }
        const downloaded = await downloadKieResultImage(source)
        sendImage(response, downloaded.mimeType, downloaded.bytes)
        return
      }

      if (url.pathname === PREFIX) {
        if (request.method !== "POST") { sendJson(response, 405, { message: "Método não permitido." }); return }
        const body = await readJsonBody(request)
        const image = body && typeof body === "object" && "image" in body ? body.image : undefined
        if (!isAllowedKieSourceUrl(image) && !isAllowedKieDataUrl(image)) {
          sendJson(response, 400, { message: "Envie uma foto aprovada do catálogo ou um PNG, JPEG ou WebP local de até 5 MB." })
          return
        }
        let sourceImage = image
        if (isAllowedKieDataUrl(image)) {
          const upload = await callKie(key, KIE_UPLOAD_ORIGIN, "/api/file-base64-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Data: image, uploadPath: "images/catalogo-local", fileName: uploadFileName(image) }),
          })
          if (upload.status < 200 || upload.status >= 300 || !uploadedKieFile(upload.body)) {
            console.error("[kie] upload recusado", { httpStatus: upload.status })
            sendJson(response, 502, { message: providerMessage(upload.body, "A Kie não aceitou a foto para o teste de recorte."), stage: "upload" })
            return
          }
          sourceImage = upload.body.data.downloadUrl
        }
        const result = await callKie(key, KIE_API_ORIGIN, "/api/v1/jobs/createTask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "recraft/remove-background", input: { image: sourceImage } }),
        })
        const taskId = taskIdFromCreateResponse(result.body)
        if (result.status < 200 || result.status >= 300 || !taskId) {
          const diagnostic = createTaskDiagnostic(result.status, result.body)
          console.error("[kie] criação de tarefa recusada", diagnostic)
          sendJson(response, 502, { message: taskCreationFailureMessage(diagnostic), diagnostic, stage: "createTask" })
          return
        }
        // Este é o único ponto do fluxo que gasta crédito. O identificador vai para
        // o terminal do Vite porque ele sobrevive ao navegador: se a exibição falhar,
        // o resultado já pago continua acessível por
        // `GET /api/kie/remove-background/<taskId>/image`, que não cobra de novo.
        console.info(`[kie] tarefa criada (crédito gasto) taskId=${taskId}`)
        sendJson(response, 201, { taskId })
        return
      }

      const routeTail = url.pathname.slice(`${PREFIX}/`.length)
      const isImageRequest = routeTail.endsWith("/image")
      const encodedTaskId = isImageRequest ? routeTail.slice(0, -"/image".length) : routeTail
      const taskId = decodeURIComponent(encodedTaskId)
      if (request.method !== "GET" || !isKieTaskId(taskId)) {
        sendJson(response, 400, { message: "Tarefa de recorte inválida." })
        return
      }
      const result = await callKie(key, KIE_API_ORIGIN, `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: "GET" })
      if (!isImageRequest) {
        sendJson(response, result.status, localizeKieTaskResult(result.body, taskId))
        return
      }
      if (result.status < 200 || result.status >= 300) {
        sendJson(response, result.status, result.body)
        return
      }
      const image = kieResultImage(result.body)
      if (!image) {
        sendJson(response, 409, { message: "A Kie ainda não disponibilizou uma imagem de resultado utilizável." })
        return
      }
      const downloaded = await downloadKieResultImage(image.url)
      sendImage(response, downloaded.mimeType, downloaded.bytes)
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "A Kie demorou demais para responder."
        : error instanceof Error ? error.message : "Não foi possível falar com a Kie."
      const stage = error instanceof KieStageError ? error.stage : undefined
      // `fetch` do Node esconde a causa real dentro de `cause`. Sem isto, uma falha
      // de rede chega ao operador como "fetch failed" e não diz nada.
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined
      console.error("[kie] falha na rota local", { stage, message, cause })
      sendJson(response, 502, stage ? { message, stage, cause } : { message, cause })
    }
  }
}

export function kieBackgroundRemoval(apiKey: string | undefined): Plugin {
  const handler = createKieBackgroundRemovalHandler(apiKey)
  return {
    name: "local-kie-background-removal",
    configureServer(server) {
      server.middlewares.use(handler)
    },
  }
}
