import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { validateProductWithImage } from "../api/catalogClient"
import { measureProductPlacement } from "../images/processingClient"
import { ManualProductForm } from "./ManualProductForm"

vi.mock("../api/catalogClient", () => ({ validateProductWithImage: vi.fn() }))
vi.mock("../images/processingClient", () => ({ measureProductPlacement: vi.fn() }))

const photo = new File(["photo"], "cafe.png", { type: "image/png" })
const geometry = { sourceWidth: 500, sourceHeight: 500, visibleBounds: { left: 100, top: 50, width: 300, height: 400 }, hasIntrinsicContactShadow: false }

describe("cadastro manual de produto", () => {
  it("exige foto antes de cadastrar", async () => {
    const user = userEvent.setup()
    render(<ManualProductForm open onCreated={vi.fn()} onOpenChange={vi.fn()} />)
    await user.type(screen.getByLabelText("Nome do produto manual"), "Café")
    await user.click(screen.getByRole("button", { name: "Cadastrar produto" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha uma foto")
    expect(validateProductWithImage).not.toHaveBeenCalled()
  })

  it("cadastra com foto medida", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() })
    vi.mocked(measureProductPlacement).mockResolvedValue(geometry)
    vi.mocked(validateProductWithImage).mockResolvedValue({
      id: "product-1",
      canonicalName: "Café da casa",
      displayName: "Café da casa",
      brandName: "Marca local",
      defaultQuantity: 500,
      defaultUnit: "g",
      status: "active",
      registrationMethod: "manual",
      primaryImage: {
        id: "image-1", sourceOrigin: "upload_usuario", url: "/api/catalogo/assets/1",
        widthPx: 500, heightPx: 500, visibleLeftPx: 100, visibleTopPx: 50,
        visibleWidthPx: 300, visibleHeightPx: 400, hasIntrinsicContactShadow: false,
      },
    })
    render(<ManualProductForm open onCreated={onCreated} onOpenChange={vi.fn()} />)
    await user.type(screen.getByLabelText("Nome do produto manual"), "Café da casa")
    await user.type(screen.getByLabelText("Marca do produto manual"), "Marca local")
    await user.clear(screen.getByLabelText("Quantidade do produto manual"))
    await user.type(screen.getByLabelText("Quantidade do produto manual"), "500")
    await user.selectOptions(screen.getByLabelText("Unidade do produto manual"), "g")
    await user.upload(screen.getByLabelText("Foto do produto manual"), photo)
    await user.click(screen.getByRole("button", { name: "Cadastrar produto" }))

    expect(validateProductWithImage).toHaveBeenCalledWith(expect.objectContaining({
      canonicalName: "Café da casa",
      displayName: "Café da casa",
      defaultQuantity: 500,
      defaultUnit: "g",
      registrationMethod: "manual",
      visibleWidthPx: 300,
    }), photo)
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      catalogProductId: "product-1",
      code: "catalog:product-1",
      productName: "Café da casa",
      registrationMethod: "manual",
      catalogImageGeometry: geometry,
    }))
  })

  it("mantém o formulário aberto e mostra falha do catálogo", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() })
    vi.mocked(measureProductPlacement).mockResolvedValue(geometry)
    vi.mocked(validateProductWithImage).mockRejectedValue(new Error("Catálogo indisponível."))
    render(<ManualProductForm open onCreated={vi.fn()} onOpenChange={vi.fn()} />)
    await user.type(screen.getByLabelText("Nome do produto manual"), "Café")
    await user.upload(screen.getByLabelText("Foto do produto manual"), photo)
    await user.click(screen.getByRole("button", { name: "Cadastrar produto" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Catálogo indisponível")
  })

  it("mantém a entrada manual visível e desabilitada quando a pesquisa está ocupada", () => {
    render(<ManualProductForm open={false} disabled disabledDescriptionId="manual-help" onCreated={vi.fn()} onOpenChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Abrir cadastro manual" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Abrir cadastro manual" })).toHaveAttribute("aria-describedby", "manual-help")
  })
})
