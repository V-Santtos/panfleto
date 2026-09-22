import { describe, expect, it } from "vitest"

import { hasSoftContactShadow, hasTransparentBackground, visibleAlphaBounds, visibleContentBounds } from "./cutout"

describe("medição da embalagem", () => {
  it("measures the visible product while ignoring a faint transparent shadow", () => {
    const width = 8, height = 10
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 2; y <= 7; y++) for (let x = 2; x <= 5; x++) data.set([80, 20, 20, 255], (y * width + x) * 4)
    for (let x = 1; x <= 6; x++) data.set([0, 0, 0, 20], (8 * width + x) * 4)

    expect(visibleAlphaBounds({ data, width, height })).toEqual({ left: 2, top: 2, width: 4, height: 6 })
  })

  it("detects an existing soft contact shadow below the physical product", () => {
    const width = 10, height = 12
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 2; y <= 7; y++) for (let x = 3; x <= 6; x++) data.set([80, 20, 20, 255], (y * width + x) * 4)
    for (let x = 2; x <= 7; x++) data.set([0, 0, 0, 20], (8 * width + x) * 4)
    const bounds = visibleAlphaBounds({ data, width, height })

    expect(bounds).toEqual({ left: 3, top: 2, width: 4, height: 6 })
    expect(hasSoftContactShadow({ data, width, height }, bounds!)).toBe(true)
  })

  it("mede a caixa de um produto opaco em fundo branco", () => {
    const width = 20, height = 20
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    for (let y = 4; y <= 15; y++) for (let x = 6; x <= 13; x++) data.set([180, 30, 30, 255], (y * width + x) * 4)

    expect(visibleContentBounds({ data, width, height })).toEqual({ left: 6, top: 4, width: 8, height: 12 })
  })

  it("ignora ruído de compressão isolado ao medir a caixa", () => {
    const width = 20, height = 20
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    for (let y = 8; y <= 11; y++) for (let x = 8; x <= 11; x++) data.set([180, 30, 30, 255], (y * width + x) * 4)
    // Dois pixels soltos na borda não podem esticar a medição.
    data.set([200, 195, 198, 255], (0 * width + 1) * 4)
    data.set([200, 195, 198, 255], (19 * width + 18) * 4)

    expect(visibleContentBounds({ data, width, height })).toEqual({ left: 8, top: 8, width: 4, height: 4 })
  })

  it("enquadra a mesma silhueta com fundo branco e com alfa, para o produto não saltar", () => {
    const width = 24, height = 24
    const opaca = new Uint8ClampedArray(width * height * 4).fill(255)
    const comAlfa = new Uint8ClampedArray(width * height * 4)
    for (let y = 5; y <= 18; y++) for (let x = 7; x <= 16; x++) {
      opaca.set([180, 30, 30, 255], (y * width + x) * 4)
      comAlfa.set([180, 30, 30, 255], (y * width + x) * 4)
    }

    // Esta é a garantia central do desenho: a mesma embalagem, antes e depois
    // da Kie, precisa ser medida na mesma caixa.
    expect(visibleContentBounds({ data: opaca, width, height }))
      .toEqual(visibleAlphaBounds({ data: comAlfa, width, height }))
  })

  it("não mede nada em imagem inteiramente branca", () => {
    const data = new Uint8ClampedArray(12 * 12 * 4).fill(255)
    expect(visibleContentBounds({ data, width: 12, height: 12 })).toBeUndefined()
  })

  it("trata pixel quase branco como fundo, não como produto", () => {
    const width = 12, height = 12
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    // 241 é o piso de ruído JPEG medido no CDN do Cosmos; fica acima do limiar.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([241, 244, 243, 255], (y * width + x) * 4)
    for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) data.set([20, 40, 90, 255], (y * width + x) * 4)

    expect(visibleContentBounds({ data, width, height })).toEqual({ left: 5, top: 5, width: 3, height: 3 })
  })
  it("não trata foto em fundo branco como já recortada por causa de um pixel solto", () => {
    const width = 16, height = 16
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) data.set([180, 30, 30, 255], (y * width + x) * 4)
    // Um único pixel quase opaco no meio não significa fundo removido.
    data[(8 * width + 8) * 4 + 3] = 249

    expect(hasTransparentBackground({ data, width, height })).toBe(false)
  })

  it("reconhece como recortada a imagem cuja borda é transparente", () => {
    const width = 16, height = 16
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) data.set([180, 30, 30, 255], (y * width + x) * 4)

    expect(hasTransparentBackground({ data, width, height })).toBe(true)
  })

  it("não trata como recortada a imagem cuja embalagem toca a borda opaca", () => {
    const width = 16, height = 16
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([180, 30, 30, 255], (y * width + x) * 4)

    expect(hasTransparentBackground({ data, width, height })).toBe(false)
  })
})
