import { afterEach, describe, expect, it, vi } from "vitest"

import { PRODUCT_CANDIDATE_LIMIT, presentationFromQuantity, searchProductCandidates } from "./productSearch"

const front = "https://images.openfoodfacts.org/images/products/789/100/037/9691/front_pt.18.400.jpg"

function hit(overrides: Record<string, unknown> = {}) {
  return {
    code: "7891000379691",
    product_name: "Achocolatado Nescau",
    brands: ["Nestlé"],
    quantity: "370 g",
    lang: "pt",
    image_front_url: front,
    image_front_small_url: front.replace(".400.jpg", ".200.jpg"),
    images: {
      front_pt: { rev: "18", sizes: { full: { w: 436, h: 955 }, "400": { w: 183, h: 400 }, "200": { w: 91, h: 200 } } },
    },
    ...overrides,
  }
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function registeredProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    gtin: "7891000379691",
    canonicalName: "Nescau 2.0",
    displayName: "Nescau da semana",
    brandName: "Nestlé",
    defaultQuantity: 370,
    defaultUnit: "g",
    status: "active",
    ...overrides,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("apresentação do produto", () => {
  it.each([
    ["370 g", { quantity: 370, unit: "g" }],
    ["2 L", { quantity: 2, unit: "L" }],
    ["500 ml", { quantity: 500, unit: "ml" }],
    ["1,5 kg", { quantity: 1.5, unit: "kg" }],
    ["12 unidades", { quantity: 12, unit: "unidade" }],
  ])("lê %s como apresentação comercial", (value, expected) => {
    expect(presentationFromQuantity(value)).toEqual(expected)
  })
})

describe("busca no catálogo próprio", () => {
  it("consulta texto somente no endpoint local e converte o produto ativo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ products: [registeredProduct()] }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await searchProductCandidates(" NÉScau ")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/catalogo/products?name=N%C3%89Scau", { signal: undefined })
    expect(result.candidates[0]).toMatchObject({
      code: "7891000379691",
      catalogProductId: "10000000-0000-0000-0000-000000000001",
      productName: "Nescau da semana",
      canonicalName: "Nescau 2.0",
      brands: ["Nestlé"],
      quantity: "370 g",
    })
  })

  it("não chama Open Food Facts nem Cosmos quando o nome não tem resultado local", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ products: [] }))
    vi.stubGlobal("fetch", fetchMock)
    expect((await searchProductCandidates("produto inexistente")).candidates).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api\/catalogo\/products\?name=/)
  })

  it("impõe o limite de 12 mesmo diante de resposta local excessiva", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      products: Array.from({ length: 20 }, (_, index) => registeredProduct({ id: String(index), gtin: undefined })),
    })))
    expect((await searchProductCandidates("café")).candidates).toHaveLength(PRODUCT_CANDIDATE_LIMIT)
    expect(PRODUCT_CANDIDATE_LIMIT).toBe(12)
  })

  it("preserva imagem processada e geometria já aprovadas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ products: [registeredProduct({
      primaryImage: {
        id: "image-1",
        sourceOrigin: "upload_usuario",
        url: "https://project.supabase.co/storage/v1/object/sign/catalog-assets/product.png?token=signed",
        widthPx: 500,
        heightPx: 700,
        visibleLeftPx: 20,
        visibleTopPx: 30,
        visibleWidthPx: 450,
        visibleHeightPx: 640,
        hasIntrinsicContactShadow: true,
      },
    })] })))
    const [candidate] = (await searchProductCandidates("nescau")).candidates
    expect(candidate).toMatchObject({
      catalogImageId: "image-1",
      origem: "upload_usuario",
      catalogImageGeometry: {
        sourceWidth: 500,
        sourceHeight: 700,
        visibleBounds: { left: 20, top: 30, width: 450, height: 640 },
        hasIntrinsicContactShadow: true,
      },
    })
  })

  it.each(["", "a", "  "])("rejeita nome curto sem rede: %s", async (query) => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(searchProductCandidates(query)).rejects.toThrow(/2 caracteres/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("não interpreta indisponibilidade do catálogo como ausência", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ code: "SUPABASE_NOT_CONFIGURED", message: "Catálogo indisponível." }, 503))
    vi.stubGlobal("fetch", fetchMock)
    await expect(searchProductCandidates("nescau")).rejects.toThrow("Catálogo indisponível")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("busca exata por GTIN/EAN", () => {
  it("usa o cadastro local sem consultar provedores externos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ product: registeredProduct() }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await searchProductCandidates("7891-0003 79691")
    expect(result.candidates[0]).toMatchObject({ catalogProductId: expect.any(String), code: "7891000379691" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/catalogo/products/by-gtin/7891000379691", { signal: undefined })
  })

  it("consulta OFF e Cosmos exatamente uma vez cada somente após miss local", async () => {
    const cosmosThumbnail = "https://cdn-cosmos.bluesoft.com.br/products/7891000379691"
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/catalogo/products/by-gtin/")) return response({ code: "PRODUCT_NOT_FOUND" }, 404)
      if (url.startsWith("/api/product-by-barcode/")) return response({ product: hit() })
      if (url === "/api/cosmos/gtins/7891000379691") return response({
        data: { gtin: 7891000379691, description: "Nescau", brand: { name: "Nestlé" }, thumbnail: cosmosThumbnail },
      })
      throw new Error(`Rota inesperada: ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await searchProductCandidates("7891000379691")
    const [candidate] = result.candidates
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.sourceWarnings).toEqual([])
    expect(candidate.photoOptions).toEqual([
      expect.objectContaining({ origem: "openfoodfacts" }),
      expect.objectContaining({ origem: "cosmos", imageUrl: cosmosThumbnail }),
    ])
  })

  it("descarta códigos divergentes retornados por provedores externos", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/catalogo/")) return response({ code: "PRODUCT_NOT_FOUND" }, 404)
      if (url.startsWith("/api/product-by-barcode/")) return response({ product: hit({ code: "7891000370100" }) })
      return response({ data: { gtin: "7891000370100", description: "Outro produto" } })
    })
    vi.stubGlobal("fetch", fetchMock)
    expect((await searchProductCandidates("7891000379691")).candidates).toEqual([])
  })

  it("continua com OFF quando a cota Cosmos terminou", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/catalogo/")) return response({ code: "PRODUCT_NOT_FOUND" }, 404)
      if (url.startsWith("/api/product-by-barcode/")) return response({ product: hit() })
      return response({ message: "Limite atingido" }, 429)
    })
    vi.stubGlobal("fetch", fetchMock)
    const result = await searchProductCandidates("7891000379691")
    const [candidate] = result.candidates
    expect(candidate).toMatchObject({ origem: "openfoodfacts" })
    expect(result.sourceWarnings).toEqual([expect.objectContaining({ source: "cosmos", kind: "unavailable" })])
  })

  it("mantém o produto do OFF e torna visível a falha do Cosmos", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/catalogo/")) return response({ code: "PRODUCT_NOT_FOUND" }, 404)
      if (url.startsWith("/api/product-by-barcode/")) return response({ product: hit() })
      return response({ message: "Não foi possível consultar o Cosmos." }, 502)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(searchProductCandidates("7891000379691")).resolves.toMatchObject({
      candidates: [expect.objectContaining({ productName: "Achocolatado Nescau" })],
      sourceWarnings: [{ source: "cosmos", kind: "unavailable" }],
    })
  })

  it("informa quando o Cosmos confirmou o produto, mas não forneceu uma foto utilizável", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/catalogo/")) return response({ code: "PRODUCT_NOT_FOUND" }, 404)
      if (url.startsWith("/api/product-by-barcode/")) return response({ product: hit({ image_front_url: undefined, image_front_small_url: undefined, images: undefined }) })
      return response({ data: { gtin: 7891000379691, description: "Nescau", brand: { name: "Nestlé" } } })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(searchProductCandidates("7891000379691")).resolves.toMatchObject({
      candidates: [expect.objectContaining({ productName: "Achocolatado Nescau", photoOptions: [] })],
      sourceWarnings: [{ source: "cosmos", kind: "missing-photo" }],
    })
  })

  it("rejeita GTIN inválido antes de qualquer rede", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(searchProductCandidates("7891000379692")).rejects.toThrow(/dígito verificador/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("não usa os provedores quando a verificação local falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ code: "CATALOG_UNAVAILABLE", message: "Banco offline." }, 503))
    vi.stubGlobal("fetch", fetchMock)
    await expect(searchProductCandidates("7891000379691")).rejects.toThrow("Banco offline")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("preserva cancelamento em todas as chamadas", async () => {
    const abortError = new DOMException("Aborted", "AbortError")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))
    await expect(searchProductCandidates("nescau", { signal: new AbortController().signal })).rejects.toMatchObject({ name: "AbortError" })
  })
})
