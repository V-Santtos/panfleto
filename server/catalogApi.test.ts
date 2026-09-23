import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { CatalogRepository } from "./catalogRepository"
import { createCatalogApiHandler } from "./catalogApi"

const product = {
  id: "10000000-0000-0000-0000-000000000001",
  gtin: "7891000379691",
  canonicalName: "Nescau 2.0",
  displayName: "Nescau 2.0",
  brandName: "Nestlé",
  defaultQuantity: 370,
  defaultUnit: "g" as const,
  status: "active" as const,
}

function fakeRepository(): CatalogRepository {
  return {
    searchActiveProducts: vi.fn().mockResolvedValue([product]),
    findProductByGtin: vi.fn().mockResolvedValue(undefined),
    createDraftProduct: vi.fn().mockImplementation(async (input) => ({ ...product, ...input, status: "draft" })),
    validateProductWithImage: vi.fn().mockResolvedValue(product),
    updateProductDisplayName: vi.fn().mockResolvedValue(product),
    reserveIntegrationUsage: vi.fn(),
    getIntegrationUsage: vi.fn(),
  }
}

const servers: Server[] = []

async function withServer(repository: CatalogRepository): Promise<string> {
  const handler = createCatalogApiHandler(() => repository)
  const server = createServer((request, response) => void handler(request, response))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))))
})

describe("API local do catálogo", () => {
  it("limita a pesquisa por nome ao catálogo ativo", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const response = await fetch(`${origin}/api/catalogo/products?name=NÉScau`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ products: [product] })
    expect(repository.searchActiveProducts).toHaveBeenCalledWith("NÉScau", 12)
  })

  it("não aceita GTIN na rota de pesquisa por nome", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const response = await fetch(`${origin}/api/catalogo/products?name=7891000379691`)
    expect(response.status).toBe(400)
    expect(repository.searchActiveProducts).not.toHaveBeenCalled()
  })

  it("retorna 404 limpo quando o GTIN ainda não existe localmente", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const response = await fetch(`${origin}/api/catalogo/products/by-gtin/7891000379691`)
    expect(response.status).toBe(404)
    expect(repository.findProductByGtin).toHaveBeenCalledWith("7891000379691")
  })

  it("recusa cadastro manual sem foto", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const response = await fetch(`${origin}/api/catalogo/products/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonicalName: "Café", defaultQuantity: 500, defaultUnit: "g" }),
    })
    expect(response.status).toBe(400)
    expect(repository.createDraftProduct).not.toHaveBeenCalled()
  })

  it("recusa corpo malformado e método incorreto", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const malformed = await fetch(`${origin}/api/catalogo/products/from-gtin`, { method: "POST", body: "{" })
    expect(malformed.status).toBe(400)
    const method = await fetch(`${origin}/api/catalogo/products`, { method: "POST" })
    expect(method.status).toBe(405)
  })

  it("valida os bytes da foto antes de ativar o produto", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const png = new Uint8Array(24)
    png.set([137, 80, 78, 71, 13, 10, 26, 10])
    png.set([73, 72, 68, 82], 12)
    new DataView(png.buffer).setUint32(16, 1000)
    new DataView(png.buffer).setUint32(20, 1000)
    const metadata = {
      gtin: "7891000379691",
      canonicalName: "Nescau",
      displayName: "Nescau 2.0",
      defaultQuantity: 370,
      defaultUnit: "g",
      registrationMethod: "gtin_lookup",
      metadataOrigin: "openfoodfacts",
      sourceOrigin: "upload_usuario",
      processingMethod: "kie",
      pipelineVersion: "manual-export-validation-v1",
      sourceWidthPx: 1000,
      sourceHeightPx: 1000,
      visibleLeftPx: 200,
      visibleTopPx: 100,
      visibleWidthPx: 500,
      visibleHeightPx: 800,
      hasIntrinsicContactShadow: false,
    }
    const response = await fetch(`${origin}/api/catalogo/products/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "X-Catalog-Metadata": encodeURIComponent(JSON.stringify(metadata)),
      },
      body: png,
    })

    expect(response.status).toBe(200)
    expect(repository.validateProductWithImage).toHaveBeenCalledTimes(1)
    const [savedMetadata, savedImage] = vi.mocked(repository.validateProductWithImage).mock.calls[0]
    expect(savedMetadata).toEqual(expect.objectContaining({ canonicalName: "Nescau", displayName: "Nescau 2.0", visibleHeightPx: 800 }))
    expect(savedImage).toEqual(expect.objectContaining({ mimeType: "image/png", width: 1000, height: 1000 }))
    expect(Array.from(savedImage.bytes)).toEqual(Array.from(png))
  })

  it("não grava uma foto cujas dimensões não conferem", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const png = new Uint8Array(24)
    png.set([137, 80, 78, 71, 13, 10, 26, 10])
    png.set([73, 72, 68, 82], 12)
    new DataView(png.buffer).setUint32(16, 500)
    new DataView(png.buffer).setUint32(20, 500)
    const metadata = {
      gtin: "7891000379691", canonicalName: "Nescau", displayName: "Nescau", defaultQuantity: 370, defaultUnit: "g",
      registrationMethod: "gtin_lookup", metadataOrigin: "openfoodfacts", sourceOrigin: "upload_usuario",
      processingMethod: "kie", pipelineVersion: "manual-export-validation-v1",
      sourceWidthPx: 1000, sourceHeightPx: 1000, visibleLeftPx: 0, visibleTopPx: 0,
      visibleWidthPx: 1000, visibleHeightPx: 1000, hasIntrinsicContactShadow: false,
    }
    const response = await fetch(`${origin}/api/catalogo/products/validate`, {
      method: "POST",
      headers: { "Content-Type": "image/png", "X-Catalog-Metadata": encodeURIComponent(JSON.stringify(metadata)) },
      body: png,
    })
    expect(response.status).toBe(400)
    expect(repository.validateProductWithImage).not.toHaveBeenCalled()
  })

  it("atualiza somente o nome exibido por uma rota local específica", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const response = await fetch(`${origin}/api/catalogo/products/10000000-0000-4000-8000-000000000001/display-name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Nescau da semana" }),
    })
    expect(response.status).toBe(200)
    expect(repository.updateProductDisplayName).toHaveBeenCalledWith(
      "10000000-0000-4000-8000-000000000001",
      "Nescau da semana",
    )
  })

  it("recusa identificador ou nome exibido inválidos", async () => {
    const repository = fakeRepository()
    const origin = await withServer(repository)
    const invalidId = await fetch(`${origin}/api/catalogo/products/invalido/display-name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Nescau" }),
    })
    expect(invalidId.status).toBe(400)
    const emptyName = await fetch(`${origin}/api/catalogo/products/10000000-0000-4000-8000-000000000001/display-name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "   " }),
    })
    expect(emptyName.status).toBe(400)
    expect(repository.updateProductDisplayName).not.toHaveBeenCalled()
  })
})
