import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Offer } from "../domain/offer"
import { FeedPoster } from "./FeedPoster"

const offer: Offer = {
  productName: "Nescau 2.0",
  quantity: 400,
  unit: "g",
  promotionalPriceCents: 999,
}

describe("FeedPoster", () => {
  it("renders the approved Feed canvas and base asset", () => {
    render(<FeedPoster offer={offer} />)

    expect(screen.getByTestId("feed-poster")).toHaveAttribute("viewBox", "0 0 1080 1350")
    expect(screen.getByTestId("feed-poster").querySelector("image")).toHaveAttribute(
      "href",
      "/templates/feed/single/feed-base-empty.png",
    )
    expect(screen.getByTestId("feed-sign-extension")).toHaveAttribute(
      "d",
      "M204 666H417V778L311 834L204 778Z",
    )
    expect(screen.getByTestId("feed-name")).toHaveAttribute("font-size", "32")
  })

  it("keeps the commercial data on the Feed plate", () => {
    render(<FeedPoster offer={{ ...offer, previousPriceCents: 1299 }} />)

    expect(screen.getByTestId("feed-weight")).toHaveTextContent("400 G")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("x", "311")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("y", "784")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("font-size", "35")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("fill", "#ffe229")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("text-anchor", "middle")
    expect(screen.getByTestId("feed-previous-price")).toHaveTextContent(/DE R\$\s?12,99/)
    expect(screen.getByTestId("feed-previous-price")).toHaveAttribute("x", "277")
    expect(screen.getByTestId("feed-previous-price")).toHaveAttribute("y", "856")
    expect(screen.getByTestId("feed-price")).toHaveAttribute("y", "943")
    expect(screen.getByTestId("feed-poster").querySelector("desc")).toHaveTextContent(/R\$\s?9,99/)
  })

  it("keeps a long single word whole and reduces its Feed type instead of breaking it", () => {
    render(<FeedPoster offer={{ ...offer, productName: "Ibituruninha" }} />)

    const name = screen.getByTestId("feed-name")
    expect(name.textContent).toBe("IBITURUNINHA")
    expect(name).toHaveAttribute("font-size", "24")
    expect(name.querySelectorAll("tspan")).toHaveLength(1)
  })

  it("uses the lower price baseline when no previous price needs space on the plate", () => {
    render(<FeedPoster offer={offer} />)

    expect(screen.getByTestId("feed-price")).toHaveAttribute("y", "941")
  })

  it("moves the unit to the yellow corner for a three-line name, matching the Story rule", () => {
    render(<FeedPoster offer={{ ...offer, productName: "Leite Ibituruna e Itambé" }} />)

    expect(screen.getByTestId("feed-weight")).toHaveAttribute("x", "411")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("y", "840")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("fill", "#74150f")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("text-anchor", "end")
    expect(screen.getByTestId("feed-weight")).toHaveAttribute("font-size", "22")
    expect(screen.getByTestId("feed-name").querySelectorAll("tspan")[2]).toHaveAttribute("font-size", "23")
  })

  it("scales price sizes by digits using the Story plate ratio", () => {
    const { rerender } = render(<FeedPoster offer={offer} />)
    expect(screen.getByTestId("feed-price").querySelectorAll("tspan")[1]).toHaveAttribute("font-size", "94")

    rerender(<FeedPoster offer={{ ...offer, promotionalPriceCents: 9999 }} />)
    expect(screen.getByTestId("feed-price").querySelectorAll("tspan")[1]).toHaveAttribute("font-size", "84")
  })

  it("anchors a measured product on the Feed pedestal and adds its contact shadow", () => {
    render(<FeedPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
      }}
    />)

    const image = screen.getByTestId("feed-product-image")
    expect(Number(image.getAttribute("y")) + (100 + 600) * 380 / 600).toBeCloseTo(1113)
    expect(image).toHaveAttribute("preserveAspectRatio", "none")
    expect(screen.getByTestId("feed-contact-shadow")).toHaveAttribute("cx", "556")
  })

  it("does not duplicate an image contact shadow", () => {
    render(<FeedPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
        hasIntrinsicContactShadow: true,
      }}
    />)

    expect(screen.queryByTestId("feed-contact-shadow")).not.toBeInTheDocument()
  })
  it("desenha a placa e a ponta vermelha depois do produto", () => {
    render(<FeedPoster offer={offer} productImageUrl="blob:embalagem" />)

    const produto = screen.getByTestId("feed-product-image")
    const placa = screen.getByTestId("feed-plaque-overlay")
    const ponta = screen.getByTestId("feed-sign-extension")
    // A placa vem do PNG de fundo e a ponta é do SVG; as duas precisam ficar
    // na frente da embalagem, senão o produto cobre o preço.
    expect(produto.compareDocumentPosition(placa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(produto.compareDocumentPosition(ponta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("mantém a ponta vermelha dentro da abertura da placa, nunca sobre a moldura", () => {
    render(<FeedPoster offer={offer} />)
    const svg = screen.getByTestId("feed-poster")

    // A abertura interna medida no PNG vai de x=203,5 a x=417,5 e é levemente
    // inclinada: topo de 665,5 a 667,5 e base de 954,5 a 956,5. Tudo o que for
    // desenhado além disso pinta por cima da moldura prateada.
    expect(screen.getByTestId("feed-sign-extension")).toHaveAttribute("clip-path", "url(#feed-sign-inner)")
    const points = (svg.querySelector("#feed-sign-inner polygon")?.getAttribute("points") ?? "")
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(",").map(Number))

    expect(points).toHaveLength(4)
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(203.5)
      expect(x).toBeLessThanOrEqual(417.5)
      expect(y).toBeGreaterThanOrEqual(665.4)
      expect(y).toBeLessThanOrEqual(956.6)
    }
  })

  it("aplica o deslocamento do Feed à embalagem e mantém a sombra no pedestal", () => {
    render(<FeedPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
      }}
      productPlacement={{ offsetX: 40, offsetY: -80 }}
    />)

    const image = screen.getByTestId("feed-product-image")
    expect(Number(image.getAttribute("x"))).toBeCloseTo(342.67, 1)
    expect(Number(image.getAttribute("y"))).toBeCloseTo(589.67, 1)
    // A sombra acompanha o eixo horizontal e continua na linha do pedestal.
    expect(Number(screen.getByTestId("feed-contact-shadow").getAttribute("cx"))).toBeCloseTo(596, 1)
    expect(screen.getByTestId("feed-contact-shadow")).toHaveAttribute("cy", "1118")
  })

  it("cria o alvo de arraste alinhado à silhueta apenas na prévia interativa", () => {
    const { rerender } = render(<FeedPoster
      offer={offer}
      productImageUrl="blob:produto"
      productImageGeometry={{
        sourceWidth: 1000,
        sourceHeight: 1000,
        visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
      }}
    />)

    expect(screen.queryByTestId("feed-product-drag-handle")).not.toBeInTheDocument()

    rerender(<FeedPoster
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

    const hitArea = screen.getByTestId("feed-product-drag-handle")
    expect(Number(hitArea.getAttribute("x"))).toBeCloseTo(461, 1)
    expect(Number(hitArea.getAttribute("y"))).toBeCloseTo(733, 1)
    expect(Number(hitArea.getAttribute("width"))).toBeCloseTo(190, 1)
    expect(Number(hitArea.getAttribute("height"))).toBeCloseTo(380, 1)
    expect(hitArea).toHaveAttribute("data-export-exclude", "true")
  })
})
