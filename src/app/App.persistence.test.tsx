import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { App } from "./App"

const { updateDisplayName, validateProduct, downloadPng, measure } = vi.hoisted(() => ({
  updateDisplayName: vi.fn(),
  validateProduct: vi.fn(),
  downloadPng: vi.fn(),
  measure: vi.fn(),
}))

vi.mock("../api/catalogClient", () => ({
  updateProductDisplayName: updateDisplayName,
  validateProductWithImage: validateProduct,
}))
vi.mock("../export/svgToPng", () => ({
  downloadSvgAsPng: downloadPng,
  downloadSvgAsPdf: vi.fn(),
}))
vi.mock("../images/processingClient", () => ({ measureProductPlacement: measure }))
vi.mock("../components/ProductSearch", () => ({
  ProductSearch: ({ onSelect, onClearSelection, resetVersion }: { onSelect: (candidate: object) => void; onClearSelection: () => void; resetVersion: number }) => (
    <div>
      <span data-testid="search-reset-version">{resetVersion}</span>
      <button type="button" onClick={onClearSelection}>Alterar busca de teste</button>
      <button type="button" onClick={() => onSelect({
        code: "7891000379691",
        productName: "Nescau 2.0",
        canonicalName: "Nestlé Nescau",
        brands: ["Nestlé"],
        quantity: "370 g",
        origem: "openfoodfacts",
        imageUrl: "blob:produto",
        thumbnailUrl: "blob:produto",
        url_original: "https://images.openfoodfacts.org/produto.png",
      })}>Selecionar produto de teste</button>
      <button type="button" onClick={() => onSelect({
        code: "7891000053508",
        productName: "Nescau 2.0",
        canonicalName: "Nestlé Nescau 2.0",
        brands: ["Nestlé"],
        quantity: "400 g",
        origem: "upload_usuario",
        catalogProductId: "10000000-0000-4000-8000-000000000001",
        catalogImageId: "20000000-0000-4000-8000-000000000001",
        imageUrl: "https://project.supabase.co/nescau.png",
        thumbnailUrl: "https://project.supabase.co/nescau.png",
        url_original: "https://project.supabase.co/nescau.png",
        catalogImageGeometry: {
          sourceWidth: 500,
          sourceHeight: 700,
          visibleBounds: { left: 20, top: 30, width: 450, height: 640 },
          hasIntrinsicContactShadow: true,
        },
      })}>Selecionar produto cadastrado</button>
    </div>
  ),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("persistência no download", () => {
  it("remove a foto da prévia e limpa a oferta ao alterar a busca", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Selecionar produto cadastrado" }))
    expect(screen.getByRole("button", { name: "Remover foto" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Alterar busca de teste" }))
    expect(screen.queryByRole("button", { name: "Remover foto" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Nome no cartaz")).toHaveValue("")
    expect(within(screen.getByRole("region", { name: "Prévia do Story" })).queryByRole("img", { name: /Nescau/i })).not.toBeInTheDocument()
  })

  it("remove a foto selecionada também do cartaz", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Selecionar produto cadastrado" }))
    await user.click(screen.getByRole("button", { name: "Remover foto" }))
    expect(screen.queryByRole("button", { name: "Remover foto" })).not.toBeInTheDocument()
    expect(screen.getByText(/Envie a foto da embalagem/)).toBeVisible()
  })

  it("ativa produto e foto antes de iniciar o PNG", async () => {
    const geometry = {
      sourceWidth: 1000,
      sourceHeight: 1000,
      visibleBounds: { left: 200, top: 100, width: 500, height: 800 },
      hasIntrinsicContactShadow: false,
    }
    measure.mockResolvedValue(geometry)
    validateProduct.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      canonicalName: "Nestlé Nescau",
      displayName: "Nescau 2.0",
      status: "active",
      primaryImage: { id: "20000000-0000-4000-8000-000000000001" },
    })
    downloadPng.mockResolvedValue(undefined)
    const image = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => image }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Selecionar produto de teste" }))
    await user.type(screen.getByLabelText("Preço promocional"), "9,99")
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Conferi produto/i })).toBeEnabled())
    await user.click(screen.getByRole("checkbox", { name: /Conferi produto/i }))
    await user.click(screen.getByRole("button", { name: "Baixar Story em PNG" }))

    await waitFor(() => expect(downloadPng).toHaveBeenCalledTimes(1))
    expect(validateProduct).toHaveBeenCalledWith(expect.objectContaining({
      gtin: "7891000379691",
      canonicalName: "Nestlé Nescau",
      displayName: "Nescau 2.0",
      defaultQuantity: 370,
      defaultUnit: "g",
      visibleTopPx: 100,
      sourceOrigin: "openfoodfacts",
    }), image)
    expect(validateProduct.mock.invocationCallOrder[0]).toBeLessThan(downloadPng.mock.invocationCallOrder[0])
  })

  it("atualiza somente o nome de produto cadastrado e cria uma nova oferta sob comando", async () => {
    updateDisplayName.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      canonicalName: "Nestlé Nescau 2.0",
      displayName: "Nescau da semana",
      status: "active",
    })
    downloadPng.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Páscoa" }))
    await user.click(screen.getByRole("button", { name: "Selecionar produto cadastrado" }))
    const name = screen.getByLabelText("Nome no cartaz")
    await user.clear(name)
    await user.type(name, "Nescau da semana")
    await user.type(screen.getByLabelText("Preço promocional"), "9,99")
    await user.click(screen.getByRole("checkbox", { name: /Conferi produto/i }))
    await user.click(screen.getByRole("button", { name: "Baixar Story em PNG" }))

    await waitFor(() => expect(downloadPng).toHaveBeenCalledTimes(1))
    expect(updateDisplayName).toHaveBeenCalledWith(
      "10000000-0000-4000-8000-000000000001",
      "Nescau da semana",
    )
    expect(validateProduct).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Nome no cartaz")).toHaveValue("Nescau da semana")
    expect(screen.getByRole("button", { name: "Criar nova oferta" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Criar nova oferta" }))
    expect(screen.getByLabelText("Nome no cartaz")).toHaveValue("")
    expect(screen.getByLabelText("Preço promocional")).toHaveValue("")
    expect(screen.getByRole("checkbox", { name: /Conferi produto/i })).toBeDisabled()
    expect(screen.getByTestId("search-reset-version")).toHaveTextContent("1")
    expect(screen.getByRole("button", { name: "Páscoa" })).toHaveAttribute("aria-pressed", "true")
  })

  it("não escreve no catálogo ao alterar somente o preço de um produto cadastrado", async () => {
    downloadPng.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Selecionar produto cadastrado" }))
    await user.type(screen.getByLabelText("Preço promocional"), "9,99")
    await user.click(screen.getByRole("checkbox", { name: /Conferi produto/i }))
    await user.click(screen.getByRole("button", { name: "Baixar Story em PNG" }))

    await waitFor(() => expect(downloadPng).toHaveBeenCalledTimes(1))
    expect(updateDisplayName).not.toHaveBeenCalled()
    expect(validateProduct).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Criar nova oferta" })).toBeVisible()

    await user.clear(screen.getByLabelText("Preço promocional"))
    await user.type(screen.getByLabelText("Preço promocional"), "10,99")
    expect(screen.queryByRole("button", { name: "Criar nova oferta" })).not.toBeInTheDocument()
  })

})
