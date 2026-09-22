import { describe, expect, it } from "vitest"

import {
  formatMoney,
  formatPresentation,
  normalizeOffer,
  parseMoneyToCents,
  validateOfferDraft,
  type OfferDraft,
} from "./offer"

const validDraft: OfferDraft = {
  productName: "Nescau 2.0",
  quantity: "400",
  unit: "g",
  promotionalPrice: "12,99",
  hasPreviousPrice: false,
  previousPrice: "",
}

describe("money", () => {
  it.each([
    ["0,99", 99],
    ["R$ 99,99", 9999],
    ["999,99", 99999],
    ["1.299,90", 129990],
  ])("converts %s to integer cents", (value, expected) => {
    expect(parseMoneyToCents(value)).toBe(expected)
  })

  it("formats BRL using pt-BR", () => {
    expect(formatMoney(1299)).toBe("R$ 12,99")
  })

  it("uses the compact UN label for a unit presentation", () => {
    expect(formatPresentation(1, "unidade")).toBe("1 UN")
  })
})

describe("offer validation", () => {
  it("accepts the minimum Nescau offer", () => {
    expect(validateOfferDraft(validDraft)).toEqual({})
    expect(normalizeOffer(validDraft)).toEqual({
      productName: "Nescau 2.0",
      quantity: 400,
      unit: "g",
      promotionalPriceCents: 1299,
      previousPriceCents: undefined,
    })
  })

  it("requires the previous price to be greater than the promotional price", () => {
    const errors = validateOfferDraft({
      ...validDraft,
      hasPreviousPrice: true,
      previousPrice: "10,00",
    })
    expect(errors.previousPrice).toMatch(/maior/)
  })

  it("accepts a decimal volume and preserves its unit", () => {
    expect(normalizeOffer({ ...validDraft, quantity: "1,5", unit: "L" })).toMatchObject({
      quantity: 1.5,
      unit: "L",
    })
  })

  it("rejects an invalid quantity", () => {
    const errors = validateOfferDraft({ ...validDraft, quantity: "0" })
    expect(errors.quantity).toMatch(/quantidade/i)
  })

  it("rejects a word that cannot fit even at the minimum readable size", () => {
    const errors = validateOfferDraft({
      ...validDraft,
      productName: "A".repeat(17),
    })

    expect(errors.productName).toMatch(/cada palavra/i)
  })
})
