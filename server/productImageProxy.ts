import type { IncomingMessage, ServerResponse } from "node:http"

import type { Plugin } from "vite"

const PREFIX = "/api/product-image"
const MAX_BYTES = 12 * 1024 * 1024

export function hasAllowedImageContentType(contentType: string | null): boolean {
  return !contentType || /^image\/(jpeg|png|webp)(?:;|$)/i.test(contentType)
}

export function detectedImageContentType(image: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | undefined {
  const isJpeg = image[0] === 255 && image[1] === 216 && image[2] === 255
  const isPng = image[0] === 137 && image[1] === 80 && image[2] === 78 && image[3] === 71
  const isWebp = image[0] === 82 && image[1] === 73 && image[2] === 70 && image[3] === 70 && image[8] === 87 && image[9] === 69 && image[10] === 66 && image[11] === 80
  return isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : undefined
}

export function remoteProductImage(path: string): string | undefined {
  const url = new URL(path, "http://127.0.0.1")
  // A reescrita da Vercel pode acrescentar seu parâmetro ao caminho original.
  // A origem remota continua definida somente pelo caminho validado abaixo.
  if ([...url.searchParams.keys()].some((key) => key !== "__path")) return
  const pathname = url.pathname
  if (/^\/api\/product-image\/images\/products\/(?:\d+\/)+front_[a-z]{2}\.\d+\.(?:100|200|400|full)\.jpg$/.test(pathname)) {
    return `https://images.openfoodfacts.org${pathname.slice(PREFIX.length)}`
  }
  const cosmos = pathname.match(/^\/api\/product-image\/cosmos\/(\d{8}|\d{12,14})$/)
  return cosmos ? `https://cdn-cosmos.bluesoft.com.br/products/${cosmos[1]}` : undefined
}

export function createProductImageHandler() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void = () => undefined): Promise<void> => {
        if (!req.url?.startsWith(PREFIX)) { next(); return }
        const remote = remoteProductImage(req.url)
        if (req.method !== "GET" || !remote) {
          res.statusCode = 400
          res.setHeader("X-Image-Route-Path", new URL(req.url, "http://127.0.0.1").pathname)
          res.end("Imagem não permitida.")
          return
        }
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15_000)
        res.on("close", () => controller.abort())
        try {
          const response = await fetch(remote, { signal: controller.signal, redirect: "error" })
          if (!response.ok || !response.body) throw new Error("Imagem indisponível")
          // The fixed Cosmos CDN sometimes omits Content-Type. It is still safe to
          // continue only because this proxy later verifies the binary signature.
          if (!hasAllowedImageContentType(response.headers.get("content-type"))) throw new Error("Formato não permitido")
          if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("Imagem muito grande")
          const reader = response.body.getReader()
          const chunks: Uint8Array[] = []
          let bytes = 0
          while (true) {
            const part = await reader.read()
            if (part.done) break
            bytes += part.value.byteLength
            if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error("Imagem muito grande") }
            chunks.push(part.value)
          }
          const image = new Uint8Array(bytes)
          let offset = 0
          for (const chunk of chunks) { image.set(chunk, offset); offset += chunk.byteLength }
          const imageContentType = detectedImageContentType(image)
          if (!imageContentType) throw new Error("Conteúdo inválido")
          res.setHeader("Content-Type", imageContentType)
          res.setHeader("Content-Length", image.byteLength)
          res.setHeader("Cache-Control", "private, max-age=3600")
          res.setHeader("X-Content-Type-Options", "nosniff")
          res.end(image)
        } catch {
          if (!res.writableEnded && !res.destroyed) { res.statusCode = 502; res.end("Não foi possível carregar a foto.") }
        } finally {
          clearTimeout(timeout)
          controller.abort()
        }
  }
}

export function productImageProxy(): Plugin {
  const handler = createProductImageHandler()
  return {
    name: "local-product-image-proxy",
    configureServer(server) {
      server.middlewares.use(handler)
    },
  }
}
