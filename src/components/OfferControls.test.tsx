import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { OfferDraft } from "../domain/offer"
import { OfferControls } from "./OfferControls"

const draft: OfferDraft = {
  productName: "Produto",
  quantity: "1",
  unit: "unidade",
  promotionalPrice: "12,99",
  hasPreviousPrice: false,
  previousPrice: "",
}

describe("OfferControls", () => {
  it("uses the compact UN label in the unit selector", async () => {
    const user = userEvent.setup()
    render(<OfferControls draft={draft} errors={{}} onChange={() => undefined} />)

    const trigger = screen.getByRole("button", { name: "Unidade da apresentação" })
    expect(trigger).toHaveTextContent("UN")
    expect(trigger).not.toHaveTextContent("unidade")

    await user.click(trigger)
    expect(screen.getByRole("option", { name: "UN" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "unidade" })).not.toBeInTheDocument()
  })
})
