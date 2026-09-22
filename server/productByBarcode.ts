import type { IncomingMessage, ServerResponse } from "node:http"

import type { Plugin } from "vite"

const PREFIX = "/api/product-by-barcode/"
const REMOTE_ORIGIN = "https://world.openfoodfacts.org/api/v2/product/"
const USER_AGENT = "OfertaLab/0.1 (product lookup)"
const TIMEOUT_MS = 15_000

export function createProductByBarcodeHandler() {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void = () => undefined): Promise<void> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (!url.pathname.startsWith(PREFIX)) { next(); return }
    const gtin = url.pathname.slice(PREFIX.length)
    if (request.method !== "GET" || !/^\d{8,14}$/.test(gtin)) {
      response.statusCode = 400
      response.setHeader("Content-Type", "application/json; charset=utf-8")
      response.end(JSON.stringify({ message: "Informe um GTIN/EAN válido." }))
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const remote = await fetch(`${REMOTE_ORIGIN}${gtin}${url.search}`, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: controller.signal,
      })
      const body = Buffer.from(await remote.arrayBuffer())
      response.statusCode = remote.status
      response.setHeader("Content-Type", remote.headers.get("content-type") ?? "application/json; charset=utf-8")
      response.setHeader("Cache-Control", "no-store")
      response.end(body)
    } catch {
      if (!response.writableEnded) {
        response.statusCode = 502
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        response.end(JSON.stringify({ message: "Não foi possível consultar o Open Food Facts." }))
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function productByBarcode(): Plugin {
  const handler = createProductByBarcodeHandler()
  return {
    name: "local-product-by-barcode",
    configureServer(server) {
      server.middlewares.use(handler)
    },
  }
}
