import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createApiRouter, requestPathFromRewrite } from "./apiRouter"
import { isAllowedMutationOrigin } from "./catalogApi"

const servers: Server[] = []

async function withRouter(env: Record<string, string | undefined>): Promise<string> {
  const router = createApiRouter(env)
  const server = createServer((request, response) => void router(request, response))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
})

describe("roteador da API em produção", () => {
  it("encaminha cada prefixo para o handler certo", async () => {
    const origin = await withRouter({})
    const kie = await fetch(`${origin}/api/kie/status`)
    expect(kie.status).toBe(200)
    expect(await kie.json()).toEqual(expect.objectContaining({ configured: false }))
  })

  it("responde 503 do catálogo quando o Supabase não está configurado, e não 404", async () => {
    const origin = await withRouter({})
    const response = await fetch(`${origin}/api/catalogo/products?name=nescau`)
    expect(response.status).toBe(503)
  })

  it("responde 404 em JSON para rota desconhecida", async () => {
    const origin = await withRouter({})
    const response = await fetch(`${origin}/api/nao-existe`)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual(expect.objectContaining({ code: "ROUTE_NOT_FOUND" }))
  })

  it("aceita o caminho original vindo da reescrita da Vercel", async () => {
    const origin = await withRouter({})
    const response = await fetch(`${origin}/api?__path=kie/status`)
    expect(response.status).toBe(200)
  })

  it("entrega a foto quando a reescrita preserva o caminho e acrescenta o parâmetro", async () => {
    const image = new Uint8Array([255, 216, 255, 217])
    const nativeFetch = globalThis.fetch
    const upstream = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (String(input).startsWith("http://127.0.0.1:")) return nativeFetch(input, init)
      return Promise.resolve(new Response(image, { headers: { "Content-Type": "image/jpeg" } }))
    })
    try {
      const origin = await withRouter({})
      const response = await fetch(`${origin}/api/product-image/cosmos/7896102501872?__path=product-image%2Fcosmos%2F7896102501872&vercelRewrite=1`)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("image/jpeg")
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(image)
      expect(upstream).toHaveBeenCalledWith("https://cdn-cosmos.bluesoft.com.br/products/7896102501872", expect.any(Object))
    } finally {
      upstream.mockRestore()
    }
  })
})

describe("caminho da requisição após reescrita", () => {
  it("mantém a URL quando ela já é a original", () => {
    expect(requestPathFromRewrite("/api/catalogo/products?name=cafe")).toBe("/api/catalogo/products?name=cafe")
  })

  it("reconstrói o caminho e preserva os demais parâmetros", () => {
    expect(requestPathFromRewrite("/api?__path=catalogo%2Fproducts&name=caf%C3%A9"))
      .toBe("/api/catalogo/products?name=caf%C3%A9")
  })

  it("remove o parâmetro da reescrita quando a Vercel preserva o caminho original", () => {
    expect(requestPathFromRewrite("/api/product-image/cosmos/7896102501872?__path=product-image%2Fcosmos%2F7896102501872"))
      .toBe("/api/product-image/cosmos/7896102501872")
  })
})

describe("origem permitida para gravar no catálogo", () => {
  it("aceita a interface local sem Origin ou com Origin http igual", () => {
    expect(isAllowedMutationOrigin("127.0.0.1:4173", undefined)).toBe(true)
    expect(isAllowedMutationOrigin("localhost:4173", "http://localhost:4173")).toBe(true)
  })

  it("aceita o próprio domínio publicado via https", () => {
    expect(isAllowedMutationOrigin("panfleto.vercel.app", "https://panfleto.vercel.app")).toBe(true)
  })

  it("recusa domínio publicado sem Origin ou com Origin de outro site", () => {
    expect(isAllowedMutationOrigin("panfleto.vercel.app", undefined)).toBe(false)
    expect(isAllowedMutationOrigin("panfleto.vercel.app", "https://outro.site")).toBe(false)
    expect(isAllowedMutationOrigin("panfleto.vercel.app", "http://panfleto.vercel.app")).toBe(false)
  })
})
