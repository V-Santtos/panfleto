import { afterEach, describe, expect, it, vi } from "vitest"

import { getKieBackgroundRemovalTask, importKieResultImage, KIE_MAX_IMAGE_BYTES, requestKieBackgroundRemoval, urlAsKieDataUrl } from "./kieClient"

afterEach(() => vi.unstubAllGlobals())

describe("Kie client", () => {
  it("uses the local API route and never sends a provider key from the browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ taskId: "task_recraft_123" }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestKieBackgroundRemoval("data:image/png;base64,AAAA")).resolves.toEqual({ taskId: "task_recraft_123" })
    expect(fetchMock).toHaveBeenCalledWith("/api/kie/remove-background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/png;base64,AAAA" }),
    })
  })

  it("uses the same-origin relay returned for a successful task result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["/api/kie/remove-background/recraft_123/image"] }) } }),
    }))

    await expect(getKieBackgroundRemovalTask("recraft_123")).resolves.toEqual({ state: "success", resultUrl: "/api/kie/remove-background/recraft_123/image" })
  })

  it("imports an already completed result through the local relay", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["png"], { type: "image/png" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(importKieResultImage("https://img-relay.kieops.com/o/result.png")).resolves.toMatchObject({ type: "image/png" })
    expect(fetchMock).toHaveBeenCalledWith("/api/kie/remove-background/import?url=https%3A%2F%2Fimg-relay.kieops.com%2Fo%2Fresult.png")
  })
  it("converte a foto de uma URL em data URL para a Kie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(urlAsKieDataUrl("/api/product-image/cosmos/7891000053508")).resolves.toMatch(/^data:image\/jpeg;base64,/)
    expect(fetchMock).toHaveBeenCalledWith("/api/product-image/cosmos/7891000053508")
  })

  it("recusa uma foto acima do limite antes de falar com a Kie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => ({ size: KIE_MAX_IMAGE_BYTES + 1, type: "image/png" }) as Blob,
    }))

    await expect(urlAsKieDataUrl("/api/product-image/cosmos/7891000053508")).rejects.toThrow(/5 MB/)
  })

  it("avisa quando a foto da busca não pode ser carregada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))

    await expect(urlAsKieDataUrl("/api/product-image/cosmos/7891000053508")).rejects.toThrow(/carregar a foto/)
  })
})
