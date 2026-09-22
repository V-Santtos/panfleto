import { afterEach, describe, expect, it, vi } from "vitest"

import { getCosmosStatus, lookupCosmosGtin } from "./cosmosClient"

afterEach(() => vi.unstubAllGlobals())

describe("cliente Cosmos no navegador", () => {
  it("fala somente com a rota local, sem expor token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { product: { gtin: "7891000370100" } }, usage: { date: "2026-09-05", used: 1 }, remaining: 24 }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(lookupCosmosGtin("7891000370100")).resolves.toMatchObject({ remaining: 24 })
    expect(fetchMock).toHaveBeenCalledWith("/api/cosmos/gtins/7891000370100", { signal: undefined })
  })

  it("consulta o status sem consumir a cota", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: true, dailyLimit: 25, used: 0, remaining: 25 }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(getCosmosStatus()).resolves.toMatchObject({ configured: true, remaining: 25 })
    expect(fetchMock).toHaveBeenCalledWith("/api/cosmos/status", { signal: undefined })
  })
})
