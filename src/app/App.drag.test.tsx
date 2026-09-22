import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { App } from "./App"

// O arraste já foi aceito no Story. Estes testes cobrem o que muda ao levá-lo
// para o Feed: cada formato guarda o seu próprio deslocamento, e soltar a
// embalagem devolve a conferência ao operador.

const { measure } = vi.hoisted(() => ({ measure: vi.fn() }))

vi.mock("../api/catalogClient", () => ({
  updateProductDisplayName: vi.fn(),
  validateProductWithImage: vi.fn(),
}))
vi.mock("../export/svgToPng", () => ({ downloadSvgAsPng: vi.fn(), downloadSvgAsPdf: vi.fn() }))
vi.mock("../images/processingClient", () => ({ measureProductPlacement: measure }))
vi.mock("../images/kieClient", () => ({
  fileAsKieDataUrl: vi.fn(),
  urlAsKieDataUrl: vi.fn(),
  requestKieBackgroundRemoval: vi.fn(),
  getKieBackgroundRemovalTask: vi.fn(),
}))
vi.mock("../components/ProductSearch", () => ({
  ProductSearch: ({ onSelect }: { onSelect: (candidate: object) => void }) => (
    <button type="button" onClick={() => onSelect({
      code: "7891000053508",
      productName: "Nescau 2.0",
      canonicalName: "Nestlé Nescau",
      brands: ["Nestlé"],
      quantity: "370 g",
      origem: "openfoodfacts",
      imageUrl: "/api/product-image/nescau.jpg",
      thumbnailUrl: "/api/product-image/nescau.jpg",
      url_original: "https://images.openfoodfacts.org/nescau.jpg",
    })}>Selecionar produto da busca</button>
  ),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function stubPointerGeometry(svg: SVGSVGElement, handle: Element): void {
  class TestPointerEvent extends MouseEvent {
    pointerId: number

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent)
  Object.defineProperty(svg, "getScreenCTM", { value: () => ({ inverse: () => ({}) }), configurable: true })
  Object.defineProperty(svg, "createSVGPoint", {
    configurable: true,
    value: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y } } }),
  })
  // O jsdom não implementa captura de ponteiro; o gesto real depende dela.
  Object.defineProperty(handle, "setPointerCapture", { value: vi.fn(), configurable: true })
  Object.defineProperty(handle, "hasPointerCapture", { value: () => true, configurable: true })
  Object.defineProperty(handle, "releasePointerCapture", { value: vi.fn(), configurable: true })
}

function dragBy(handle: Element, deltaX: number, deltaY: number): void {
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: deltaX, clientY: deltaY })
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: deltaX, clientY: deltaY })
}

async function selectMeasuredProduct() {
  measure.mockResolvedValue({
    sourceWidth: 1000,
    sourceHeight: 1000,
    visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
    hasIntrinsicContactShadow: false,
  })
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: "Selecionar produto da busca" }))
  await screen.findByTestId("story-product-image")
  return user
}

describe("arraste da embalagem no Feed", () => {
  it("move a embalagem do Feed sem deslocar a do Story", async () => {
    const user = await selectMeasuredProduct()
    await user.click(screen.getByRole("button", { name: "Feed" }))

    const handle = await screen.findByTestId("feed-product-drag-handle")
    stubPointerGeometry(screen.getByTestId("feed-poster") as unknown as SVGSVGElement, handle)
    // Posição automática do Feed: x=302,67 e y=669,67 para esta silhueta.
    expect(Number(screen.getByTestId("feed-product-image").getAttribute("x"))).toBeCloseTo(302.67, 1)

    dragBy(handle, 40, -30)

    expect(Number(screen.getByTestId("feed-product-image").getAttribute("x"))).toBeCloseTo(342.67, 1)
    expect(Number(screen.getByTestId("feed-product-image").getAttribute("y"))).toBeCloseTo(639.67, 1)

    await user.click(screen.getByRole("button", { name: "Story" }))

    // O Story continua no encaixe automático: o palco é outro, o deslocamento também.
    expect(Number(screen.getByTestId("story-product-image").getAttribute("x"))).toBeCloseTo(361.33, 1)
    expect(Number(screen.getByTestId("story-product-image").getAttribute("y"))).toBeCloseTo(1001.33, 1)
  })

  it("mantém a silhueta do Feed dentro do palco quando o gesto passa do limite", async () => {
    const user = await selectMeasuredProduct()
    await user.click(screen.getByRole("button", { name: "Feed" }))

    const handle = await screen.findByTestId("feed-product-drag-handle")
    stubPointerGeometry(screen.getByTestId("feed-poster") as unknown as SVGSVGElement, handle)

    dragBy(handle, 0, 900)

    // A base é o pedestal: empurrar para baixo não afunda a embalagem nele.
    expect(Number(screen.getByTestId("feed-product-image").getAttribute("y"))).toBeCloseTo(669.67, 1)
  })

  it("devolve a conferência ao operador depois de arrastar no Feed", async () => {
    const user = await selectMeasuredProduct()
    await user.type(screen.getByLabelText("Preço promocional"), "9,99")
    await user.click(screen.getByRole("button", { name: "Feed" }))
    await user.click(screen.getByRole("checkbox", { name: /Conferi produto/ }))
    expect(screen.getByRole("checkbox", { name: /Conferi produto/ })).toBeChecked()

    const handle = await screen.findByTestId("feed-product-drag-handle")
    stubPointerGeometry(screen.getByTestId("feed-poster") as unknown as SVGSVGElement, handle)
    dragBy(handle, 30, 0)

    expect(screen.getByRole("checkbox", { name: /Conferi produto/ })).not.toBeChecked()
  })

  it("volta ao encaixe automático quando o operador troca de produto", async () => {
    const user = await selectMeasuredProduct()
    await user.click(screen.getByRole("button", { name: "Feed" }))

    const handle = await screen.findByTestId("feed-product-drag-handle")
    stubPointerGeometry(screen.getByTestId("feed-poster") as unknown as SVGSVGElement, handle)
    dragBy(handle, 40, 0)
    expect(Number(screen.getByTestId("feed-product-image").getAttribute("x"))).toBeCloseTo(342.67, 1)

    // Selecionar de novo é o caminho de troca de produto: o encaixe automático
    // volta porque a silhueta pode ser outra.
    await user.click(screen.getByRole("button", { name: "Selecionar produto da busca" }))

    const restored = await screen.findByTestId("feed-product-image")
    expect(Number(restored.getAttribute("x"))).toBeCloseTo(302.67, 1)
  })
})
