import { describe, expect, it } from "vitest"

import { classifyCatalogSearch, isValidGtin, validateDraftProduct, validateProductDisplayName, validateValidatedProduct } from "./catalog"

describe("entrada da busca do catálogo", () => {
  it("separa nome cadastrado de GTIN exato antes de qualquer rede", () => {
    expect(classifyCatalogSearch(" Nescau 2.0 ")).toEqual({ kind: "registered_name", query: "Nescau 2.0" })
    expect(classifyCatalogSearch("7891-0003 79691")).toEqual({ kind: "exact_gtin", gtin: "7891000379691" })
  })

  it("marca sequências numéricas inválidas sem tratá-las como nome", () => {
    expect(classifyCatalogSearch("7891000379692")).toEqual({ kind: "invalid_numeric", value: "7891000379692" })
    expect(isValidGtin("7891000379691")).toBe(true)
  })
})

describe("rascunho de produto", () => {
  it("aceita cadastro manual sem GTIN", () => {
    expect(() => validateDraftProduct({
      canonicalName: "Café da casa",
      displayName: "Café especial",
      defaultQuantity: 500,
      defaultUnit: "g",
      registrationMethod: "manual",
      metadataOrigin: "manual",
    })).not.toThrow()
  })

  it("exige GTIN válido quando o produto veio de consulta externa", () => {
    expect(() => validateDraftProduct({
      canonicalName: "Café",
      displayName: "Café",
      defaultQuantity: 500,
      defaultUnit: "g",
      registrationMethod: "gtin_lookup",
      metadataOrigin: "openfoodfacts",
    })).toThrow(/exige GTIN/i)
  })
})

describe("validação final de produto", () => {
  const input = {
    gtin: "7891000379691",
    canonicalName: "Nescau",
    displayName: "Nescau 2.0",
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

  it("aceita metadados e geometria consistentes", () => {
    expect(() => validateValidatedProduct(input)).not.toThrow()
  })

  it("recusa uma silhueta fora dos bytes da imagem", () => {
    expect(() => validateValidatedProduct({ ...input, visibleHeightPx: 901 })).toThrow(/geometria/i)
  })
})

describe("nome exibido no cartaz", () => {
  it("aceita um nome válido e recusa conteúdo vazio ou longo", () => {
    expect(() => validateProductDisplayName(" Nescau 2.0 ")).not.toThrow()
    expect(() => validateProductDisplayName("   ")).toThrow(/nome para o cartaz/i)
    expect(() => validateProductDisplayName("x".repeat(201))).toThrow(/até 200/i)
  })
})
