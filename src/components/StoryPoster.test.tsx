import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Offer } from "../domain/offer"
import { StoryPoster } from "./StoryPoster"

const offer: Offer = {
  productName: "Nescau 2.0",
  quantity: 400,
  unit: "g",
  promotionalPriceCents: 999,
}

describe("StoryPoster sign states", () => {
  it("keeps the weight centered for a one-line name", () => {
    render(<StoryPoster offer={offer} />)

    expect(screen.getByTestId("story-weight")).toHaveAttribute("x", "299")
    expect(screen.getByTestId("story-weight")).toHaveAttribute("text-anchor", "middle")
  })

  it("keeps a long single word whole and reduces its type instead of breaking it", () => {
    render(<StoryPoster offer={{ ...offer, productName: "Ibituruninha" }} />)

    const name = screen.getByTestId("story-poster").querySelector("text")
    expect(name?.textContent).toBe("IBITURUNINHA")
    expect(name).toHaveAttribute("font-size", "33")
    expect(name?.querySelectorAll("tspan")).toHaveLength(1)
  })

  it("keeps a smaller weight below a two-line name", () => {
    render(<StoryPoster offer={{ ...offer, productName: "Leite e Bituruna" }} />)

    expect(screen.getByTestId("story-weight")).toHaveAttribute("x", "299")
    expect(screen.getByTestId("story-weight")).toHaveAttribute("y", "1154")
    expect(screen.getByTestId("story-weight")).toHaveAttribute("font-size", "38")
    expect(screen.getByTestId("story-weight")).toHaveAttribute("text-anchor", "middle")
  })

  it("moves the weight to the yellow corner for a three-line name", () => {
    render(<StoryPoster offer={{ ...offer, productName: "Leite Ibituruna e Itambé" }} />)

    expect(screen.getByTestId("story-weight")).toHaveAttribute("x", "445")
    expect(screen.getByTestId("story-weight")).toHaveAttribute("y", "1208")
    expect(screen.getByTestId("story-weight")).toHaveAttribute("font-size", "30")
    expect(screen.getByTestId("story-weight")).toHaveAttribute("text-anchor", "end")
  })

  it("uses the measured visible bounds to anchor the product on the pedestal", () => {
    render(<StoryPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
      }}
    />)

    const image = screen.getByTestId("story-product-image")
    expect(Number(image.getAttribute("y")) + (100 + 600) * 520 / 600).toBeCloseTo(1608)
    expect(image).toHaveAttribute("preserveAspectRatio", "none")
    expect(screen.getByTestId("story-contact-shadow")).toHaveAttribute("cx", "708")
  })

  it("does not double a contact shadow already present in the image", () => {
    render(<StoryPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
        hasIntrinsicContactShadow: true,
      }}
    />)

    expect(screen.queryByTestId("story-contact-shadow")).not.toBeInTheDocument()
  })

  it("applies the Story placement to the product while the shadow stays on the pedestal", () => {
    render(<StoryPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
      }}
      productPlacement={{ offsetX: 40, offsetY: -80 }}
    />)

    const image = screen.getByTestId("story-product-image")
    expect(Number(image.getAttribute("x"))).toBeCloseTo(401.33, 1)
    expect(Number(image.getAttribute("y"))).toBeCloseTo(921.33, 1)
    expect(screen.getByTestId("story-contact-shadow")).toHaveAttribute("cx", "748")
    expect(screen.getByTestId("story-contact-shadow")).toHaveAttribute("cy", "1614")
  })

  it("adds a silhouette-aligned drag target only to the interactive preview", () => {
    render(<StoryPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
      }}
      onProductPlacementChange={vi.fn()}
      onProductPlacementCommit={vi.fn()}
    />)

    const hitArea = screen.getByTestId("story-product-drag-handle")
    expect(Number(hitArea.getAttribute("x"))).toBeCloseTo(578, 1)
    expect(Number(hitArea.getAttribute("y"))).toBeCloseTo(1088, 1)
    expect(Number(hitArea.getAttribute("width"))).toBeCloseTo(260, 1)
    expect(Number(hitArea.getAttribute("height"))).toBeCloseTo(520, 1)
    expect(hitArea).toHaveAttribute("data-export-exclude", "true")
  })

  it("desenha a placa depois do produto, para a embalagem passar por trás", () => {
    render(<StoryPoster offer={offer} productImageUrl="blob:embalagem" />)

    const produto = screen.getByTestId("story-product-image")
    const placa = screen.getByTestId("story-plaque-overlay")
    // A placa mora dentro do PNG de fundo. Sem esta sobreposição, o produto
    // ficaria por cima dela; a ordem no documento é o que garante a hierarquia.
    expect(produto.compareDocumentPosition(placa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
