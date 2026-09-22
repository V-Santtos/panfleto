import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { createDraftProduct } from "../api/catalogClient"
import { ManualProductForm } from "./ManualProductForm"

vi.mock("../api/catalogClient", () => ({ createDraftProduct: vi.fn() }))

describe("cadastro manual de produto", () => {
  it("cria rascunho separado sem exigir GTIN", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    vi.mocked(createDraftProduct).mockResolvedValue({
      id: "product-1",
      canonicalName: "Café da casa",
      displayName: "Café da casa",
      brandName: "Marca local",
      defaultQuantity: 500,
      defaultUnit: "g",
      status: "draft",
    })
    render(<ManualProductForm open onCreated={onCreated} onOpenChange={vi.fn()} />)
    await user.type(screen.getByLabelText("Nome do produto manual"), "Café da casa")
    await user.type(screen.getByLabelText("Marca do produto manual"), "Marca local")
    await user.clear(screen.getByLabelText("Quantidade do produto manual"))
    await user.type(screen.getByLabelText("Quantidade do produto manual"), "500")
    await user.selectOptions(screen.getByLabelText("Unidade do produto manual"), "g")
    await user.click(screen.getByRole("button", { name: "Criar rascunho" }))

    expect(createDraftProduct).toHaveBeenCalledWith(expect.objectContaining({
      canonicalName: "Café da casa",
      displayName: "Café da casa",
      defaultQuantity: 500,
      defaultUnit: "g",
      registrationMethod: "manual",
    }))
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      catalogProductId: "product-1",
      code: "catalog:product-1",
      productName: "Café da casa",
    }))
  })

  it("mantém o formulário aberto e mostra falha do catálogo", async () => {
    const user = userEvent.setup()
    vi.mocked(createDraftProduct).mockRejectedValue(new Error("Catálogo indisponível."))
    render(<ManualProductForm open onCreated={vi.fn()} onOpenChange={vi.fn()} />)
    await user.type(screen.getByLabelText("Nome do produto manual"), "Café")
    await user.click(screen.getByRole("button", { name: "Criar rascunho" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Catálogo indisponível")
  })

  it("mantém a entrada manual visível e desabilitada quando a pesquisa está ocupada", () => {
    render(<ManualProductForm open={false} disabled disabledDescriptionId="manual-help" onCreated={vi.fn()} onOpenChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Abrir cadastro manual" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Abrir cadastro manual" })).toHaveAttribute("aria-describedby", "manual-help")
  })
})
