import { afterEach, describe, expect, it, vi } from "vitest"

import { CatalogClientError, findRegisteredProductByGtin, searchRegisteredProducts, updateProductDisplayName, validateProductWithImage } from "./catalogClient"

afterEach(() => vi.unstubAllGlobals())

describe("cliente do catálogo próprio", () => {
  it("envia nome somente à API local", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) })
    vi.stubGlobal("fetch", fetchMock)
    await searchRegisteredProducts("café pilão")
    expect(fetchMock).toHaveBeenCalledWith("/api/catalogo/products?name=caf%C3%A9%20pil%C3%A3o", { signal: undefined })
  })

  it("traduz somente PRODUCT_NOT_FOUND em ausência local", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ code: "PRODUCT_NOT_FOUND", message: "Produto ainda não cadastrado." }),
    }))
    await expect(findRegisteredProductByGtin("7891000379691")).resolves.toBeUndefined()
  })

  it("não transforma indisponibilidade do banco em miss", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ code: "SUPABASE_NOT_CONFIGURED", message: "Banco indisponível." }),
    }))
    await expect(findRegisteredProductByGtin("7891000379691")).rejects.toMatchObject({
      name: CatalogClientError.name,
      status: 503,
    })
  })

  it("envia a foto validada como bytes somente para a API local", async () => {
    const product = { id: "10000000-0000-4000-8000-000000000001", status: "active" }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ product }) })
    vi.stubGlobal("fetch", fetchMock)
    const image = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
    const input = {
      gtin: "7891000379691",
      canonicalName: "Nescau",
      displayName: "Nescau 2.0",
      brandName: "Nestlé",
      defaultQuantity: 370,
      defaultUnit: "g" as const,
      registrationMethod: "gtin_lookup" as const,
      metadataOrigin: "openfoodfacts" as const,
      sourceOrigin: "upload_usuario" as const,
      processingMethod: "kie" as const,
      pipelineVersion: "manual-export-validation-v1",
      sourceWidthPx: 1000,
      sourceHeightPx: 1000,
      visibleLeftPx: 200,
      visibleTopPx: 100,
      visibleWidthPx: 500,
      visibleHeightPx: 800,
      hasIntrinsicContactShadow: false,
    }

    await expect(validateProductWithImage(input, image)).resolves.toEqual(product)
    expect(fetchMock).toHaveBeenCalledWith("/api/catalogo/products/validate", expect.objectContaining({
      method: "POST",
      body: image,
      headers: expect.objectContaining({ "Content-Type": "image/png" }),
    }))
    const metadata = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(JSON.parse(decodeURIComponent(metadata["X-Catalog-Metadata"]))).toEqual(input)
  })

  it("atualiza o nome exibido sem enviar a foto novamente", async () => {
    const product = { id: "10000000-0000-4000-8000-000000000001", displayName: "Nescau da semana" }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ product }) })
    vi.stubGlobal("fetch", fetchMock)
    await expect(updateProductDisplayName(product.id, product.displayName)).resolves.toEqual(product)
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/catalogo/products/${product.id}/display-name`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ displayName: "Nescau da semana" }),
      }),
    )
  })
})
