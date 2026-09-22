import { describe, expect, it } from "vitest"

import { inspectImageBytes } from "./imageMetadata"

describe("inspeção dos bytes da foto", () => {
  it("lê dimensões diretamente do cabeçalho PNG", () => {
    const bytes = new Uint8Array(24)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
    bytes.set([73, 72, 68, 82], 12)
    new DataView(bytes.buffer).setUint32(16, 1080)
    new DataView(bytes.buffer).setUint32(20, 1920)

    expect(inspectImageBytes(bytes, "image/png")).toEqual({
      mimeType: "image/png",
      extension: "png",
      width: 1080,
      height: 1920,
    })
  })

  it("recusa MIME disfarçado e arquivos inválidos", () => {
    const bytes = new Uint8Array(24)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
    bytes.set([73, 72, 68, 82], 12)
    new DataView(bytes.buffer).setUint32(16, 500)
    new DataView(bytes.buffer).setUint32(20, 500)
    expect(() => inspectImageBytes(bytes, "image/jpeg")).toThrow(/não corresponde/i)
    expect(() => inspectImageBytes(new Uint8Array([1, 2, 3]))).toThrow(/válido/i)
  })
})
