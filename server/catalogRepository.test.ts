import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import { SupabaseCatalogRepository } from "./catalogRepository"

describe("SupabaseCatalogRepository.updateProductDisplayName", () => {
  it("atualiza somente display_name no produto ativo", async () => {
    const row = {
      id: "10000000-0000-4000-8000-000000000001",
      gtin: "7891000053508",
      canonical_name: "Nestlé Nescau 2.0",
      display_name: "Nescau da semana",
      brand_name: "Nestlé",
      default_quantity: 400,
      default_unit: "g",
      status: "active",
    }
    const productsQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    }
    productsQuery.update.mockReturnValue(productsQuery)
    productsQuery.eq.mockReturnValue(productsQuery)
    productsQuery.select.mockReturnValue(productsQuery)

    const productImagesQuery = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
    }
    productImagesQuery.select.mockReturnValue(productImagesQuery)
    productImagesQuery.in.mockReturnValue(productImagesQuery)
    productImagesQuery.eq
      .mockReturnValueOnce(productImagesQuery)
      .mockResolvedValueOnce({ data: [], error: null })

    const supabase = {
      from: vi.fn((table: string) => table === "products" ? productsQuery : productImagesQuery),
    } as unknown as SupabaseClient
    const repository = new SupabaseCatalogRepository(supabase)

    await expect(repository.updateProductDisplayName(row.id, "  Nescau   da semana  ")).resolves.toEqual({
      id: row.id,
      registrationMethod: "gtin_lookup",
      gtin: row.gtin,
      canonicalName: row.canonical_name,
      displayName: row.display_name,
      brandName: row.brand_name,
      defaultQuantity: row.default_quantity,
      defaultUnit: row.default_unit,
      status: row.status,
    })

    expect(productsQuery.update).toHaveBeenCalledOnce()
    expect(productsQuery.update).toHaveBeenCalledWith({ display_name: "Nescau da semana" })
    expect(productsQuery.eq).toHaveBeenNthCalledWith(1, "id", row.id)
    expect(productsQuery.eq).toHaveBeenNthCalledWith(2, "status", "active")
  })
})
