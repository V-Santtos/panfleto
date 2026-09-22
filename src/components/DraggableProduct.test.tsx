import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ProductPlacement } from "../domain/productPlacement"
import { DraggableProduct } from "./DraggableProduct"

const geometry = {
  sourceWidth: 1000,
  sourceHeight: 1000,
  visibleBounds: { left: 250, top: 100, width: 300, height: 600 },
}
const position = { x: 361.33, y: 1001.33, width: 866.67, height: 866.67, scale: 520 / 600 }
const stage = {
  minVisibleLeft: 430,
  minVisibleTop: 540,
  maxVisibleRight: 980,
  maxVisibleBottom: 1608,
  unmeasuredImageTopRange: { minimum: 755.05615234375, maximum: 1144.6849365234375 },
}

function setup(
  onChange = vi.fn(),
  onCommit = vi.fn(),
  productGeometry: typeof geometry | null = geometry,
  productPosition = position,
) {
  class TestPointerEvent extends MouseEvent {
    pointerId: number

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent)
  render(
    <svg viewBox="0 0 1080 1920">
      <DraggableProduct
        href="blob:produto"
        position={productPosition}
        geometry={productGeometry ?? undefined}
        placement={{ offsetX: 0, offsetY: 0 }}
        stage={stage}
        ariaLabel="Imagem selecionada de Nescau"
        imageTestId="product"
        hitAreaTestId="hit-area"
        onPlacementChange={onChange}
        onPlacementCommit={onCommit}
      />
    </svg>,
  )
  const svg = (screen.getByTestId("product") as unknown as SVGImageElement).ownerSVGElement as SVGSVGElement
  const hitArea = screen.getByTestId("hit-area") as unknown as SVGRectElement
  Object.defineProperty(svg, "getScreenCTM", { value: () => ({ inverse: () => ({}) }) })
  Object.defineProperty(svg, "createSVGPoint", { value: () => ({
    x: 0,
    y: 0,
    matrixTransform() { return { x: this.x, y: this.y } },
  }) })
  Object.defineProperty(hitArea, "setPointerCapture", { value: vi.fn() })
  Object.defineProperty(hitArea, "hasPointerCapture", { value: () => true })
  Object.defineProperty(hitArea, "releasePointerCapture", { value: vi.fn() })
  return { hitArea, onChange, onCommit }
}

afterEach(() => vi.unstubAllGlobals())

describe("DraggableProduct", () => {
  it("ignores a click and movement below the three-pixel threshold", () => {
    const { hitArea, onChange, onCommit } = setup()
    fireEvent.pointerDown(hitArea, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(hitArea, { pointerId: 1, clientX: 12, clientY: 10 })
    fireEvent.pointerUp(hitArea, { pointerId: 1, clientX: 12, clientY: 10 })
    expect(onChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("previews at most once per frame and commits the limited placement", () => {
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frame = callback; return 7 }))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    const { hitArea, onChange, onCommit } = setup()
    fireEvent.pointerDown(hitArea, { pointerId: 2, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(hitArea, { pointerId: 2, clientX: 60, clientY: -30 })
    fireEvent.pointerMove(hitArea, { pointerId: 2, clientX: 70, clientY: -40 })
    expect(onChange).not.toHaveBeenCalled()
    frame?.(0)
    expect(onChange).toHaveBeenCalledTimes(1)
    const preview = onChange.mock.calls[0][0] as ProductPlacement
    expect(preview).toEqual({ offsetX: 60, offsetY: -50 })

    fireEvent.pointerUp(hitArea, { pointerId: 2, clientX: 70, clientY: -40 })
    expect(onCommit).toHaveBeenCalledWith(preview)
  })

  it("restores the prior placement when the pointer is cancelled", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 9))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    const { hitArea, onChange, onCommit } = setup()
    fireEvent.pointerDown(hitArea, { pointerId: 3, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(hitArea, { pointerId: 3, clientX: 50, clientY: 10 })
    fireEvent.pointerCancel(hitArea, { pointerId: 3 })
    expect(onChange).toHaveBeenLastCalledWith({ offsetX: 0, offsetY: 0 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("moves an unmeasured manual image only within the calibrated vertical range", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 11))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    const fallbackPosition = { x: 428, y: 1090, width: 544, height: 566, scale: 1 }
    const { hitArea, onChange, onCommit } = setup(vi.fn(), vi.fn(), null, fallbackPosition)

    fireEvent.pointerDown(hitArea, { pointerId: 4, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(hitArea, { pointerId: 4, clientX: 110, clientY: 110 })
    fireEvent.pointerUp(hitArea, { pointerId: 4, clientX: 110, clientY: 110 })

    expect(onChange).toHaveBeenLastCalledWith({ offsetX: 100, offsetY: 54.6849365234375 })
    expect(onCommit).toHaveBeenCalledWith({ offsetX: 100, offsetY: 54.6849365234375 })

    fireEvent.pointerDown(hitArea, { pointerId: 5, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(hitArea, { pointerId: 5, clientX: 10, clientY: -990 })
    fireEvent.pointerUp(hitArea, { pointerId: 5, clientX: 10, clientY: -990 })

    expect(onChange).toHaveBeenLastCalledWith({ offsetX: 0, offsetY: -334.94384765625 })
    expect(onCommit).toHaveBeenLastCalledWith({ offsetX: 0, offsetY: -334.94384765625 })
  })
})
