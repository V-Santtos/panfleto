import type { IncomingMessage, ServerResponse } from "node:http"

import { createCatalogApiHandler } from "./catalogApi.js"
import { createCatalogRepository, type CatalogRepository } from "./catalogRepository.js"
import { createCosmosProxyHandler } from "./cosmosProxy.js"
import { createKieBackgroundRemovalHandler } from "./kieBackgroundRemoval.js"
import { createProductByBarcodeHandler } from "./productByBarcode.js"
import { createProductImageHandler } from "./productImageProxy.js"

type Handler = (request: IncomingMessage, response: ServerResponse, next: () => void) => Promise<void>
type Environment = Record<string, string | undefined>

const REWRITE_PARAM = "__path"

// A Vercel entrega a chamada reescrita como /api?__path=<resto>; o handler de
// cada integração espera o caminho original /api/<resto>.
export function requestPathFromRewrite(rawUrl: string): string {
  const url = new URL(rawUrl, "http://127.0.0.1")
  const rewritten = url.searchParams.get(REWRITE_PARAM)
  if (rewritten === null) return rawUrl
  url.searchParams.delete(REWRITE_PARAM)
  const query = url.searchParams.toString()
  // Vercel may preserve the original /api/... path while appending rewrite
  // parameters. In that case the original path is authoritative.
  if (url.pathname !== "/api") return `${url.pathname}${query ? `?${query}` : ""}`
  return `/api/${rewritten.replace(/^\/+/, "")}${query ? `?${query}` : ""}`
}

export function createApiRouter(environment: Environment) {
  let repository: CatalogRepository | undefined
  const repositoryProvider = () => (repository ??= createCatalogRepository({
    url: environment.SUPABASE_URL,
    serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
  }))
  const handlers: Handler[] = [
    createCatalogApiHandler(repositoryProvider),
    createProductImageHandler(),
    createProductByBarcodeHandler(),
    createKieBackgroundRemovalHandler(environment.KIE_API_KEY),
    createCosmosProxyHandler(environment.COSMOS_TOKEN, environment.COSMOS_USER_AGENT, repositoryProvider),
  ]

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    request.url = requestPathFromRewrite(request.url ?? "/")
    for (const handler of handlers) {
      let passed = false
      await handler(request, response, () => { passed = true })
      if (!passed) return
    }
    response.statusCode = 404
    response.setHeader("Content-Type", "application/json; charset=utf-8")
    response.setHeader("Cache-Control", "no-store")
    response.end(JSON.stringify({ code: "ROUTE_NOT_FOUND", message: "Rota da API não encontrada." }))
  }
}
