import { describe, expect, it } from "vitest"

import { isValidCosmosGtin, nextCosmosUsage } from "./cosmosProxy"

describe("recuperação local da cota Cosmos", () => {
  it("libera a 25ª consulta e bloqueia a 26ª antes do fornecedor", () => {
    expect(nextCosmosUsage({ date: "2026-09-06", used: 24 }, "2026-09-06")).toEqual({
      allowed: true,
      usage: { date: "2026-09-06", used: 25 },
      remaining: 0,
    })
    expect(nextCosmosUsage({ date: "2026-09-06", used: 25 }, "2026-09-06")).toEqual({
      allowed: false,
      usage: { date: "2026-09-06", used: 25 },
      remaining: 0,
    })
  })

  it("reinicia a contagem quando muda o dia em São Paulo", () => {
    expect(nextCosmosUsage({ date: "2026-09-05", used: 25 }, "2026-09-06")).toEqual({
      allowed: true,
      usage: { date: "2026-09-06", used: 1 },
      remaining: 24,
    })
  })
})

describe("código enviado ao Cosmos", () => {
  it.each(["7891000370100", "7891000379691", "7891910000197"])("aceita GTIN/EAN válido: %s", (code) => {
    expect(isValidCosmosGtin(code)).toBe(true)
  })

  it.each(["7891000370101", "123", "GTIN-7891000370100"])("rejeita GTIN/EAN inválido: %s", (code) => {
    expect(isValidCosmosGtin(code)).toBe(false)
  })
})
