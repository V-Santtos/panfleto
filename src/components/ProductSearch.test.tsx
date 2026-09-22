import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { searchProductCandidates, type ProductSearchResult } from "../domain/productSearch"
import { ProductSearch } from "./ProductSearch"
import { qualifyCandidates } from "../images/qualificationClient"

vi.mock("../domain/productSearch", () => ({ searchProductCandidates: vi.fn() }))
vi.mock("../images/qualificationClient", () => ({ qualifyCandidates: vi.fn() }))
const search = vi.mocked(searchProductCandidates)

function result(name: string): ProductSearchResult {
  return {
    elapsedMs: 100, examinedCount: 3, eligibleCount: 1, sourceWarnings: [],
    candidates: [{ code: name, productName: name, brands: [], quantity: "370 g", imageUrl: "https://images.openfoodfacts.org/front.full.jpg", thumbnailUrl: "https://images.openfoodfacts.org/front.200.jpg", origem: "openfoodfacts", url_original: "https://images.openfoodfacts.org/front.full.jpg" }],
  }
}

function deferred() {
  let resolve!: (value: ProductSearchResult) => void
  let reject!: (error: Error) => void
  const promise = new Promise<ProductSearchResult>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  search.mockReset()
  vi.mocked(qualifyCandidates).mockReset().mockImplementation(async (candidates, options) => {
    const evaluations = candidates.map((candidate) => ({ ...candidate, qualification: { accepted: true, score: 90, background: "white" as const, reasons: [], metrics: { borderMean: 255, borderDeviation: 0, transparentBorder: 0, whiteBorder: 1, occupancy: 0.5, silhouetteFill: 0.8, sharpness: 300 } } }))
    const progress = { candidates: evaluations, evaluations, evaluatedCount: candidates.length, totalCount: candidates.length, approvedCount: candidates.length }
    options.onProgress(progress)
    return progress
  })
})

describe("product search UI", () => {
  it("busca produtos cadastrados após dois caracteres e mostra a miniatura verde", async () => {
    vi.useFakeTimers()
    try {
      search.mockResolvedValue({
        elapsedMs: 10,
        examinedCount: 1,
        eligibleCount: 1,
        sourceWarnings: [],
        candidates: [{
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
        }],
      })
      const onSelect = vi.fn()
      const onClearSelection = vi.fn()
      render(<ProductSearch onSelect={onSelect} onClearSelection={onClearSelection} />)
      const input = screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")
      fireEvent.change(input, { target: { value: "n" } })
      await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve() })
      expect(search).not.toHaveBeenCalled()
      fireEvent.change(input, { target: { value: "ne" } })
      expect(screen.getByRole("button", { name: "Abrir cadastro manual" })).toBeDisabled()
      await act(async () => {
        vi.advanceTimersByTime(300)
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(search).toHaveBeenCalledTimes(1)
      expect(search).toHaveBeenCalledWith("ne", expect.objectContaining({ signal: expect.any(AbortSignal) }))
      const suggestion = screen.getByRole("option", { name: /Nescau 2.0/ })
      const card = suggestion.closest("article")
      expect(card).toHaveClass("is-registered")
      expect(card).not.toHaveClass("is-highlighted")
      expect(card?.querySelector("img")).toHaveAttribute("src", "https://project.supabase.co/nescau.png")
      expect(screen.getByRole("listbox").parentElement).toHaveClass("search-combobox")
      expect(input).toHaveAttribute("aria-expanded", "true")
      fireEvent.keyDown(input, { key: "Enter" })
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: "7891000053508" }))
      expect(input).toHaveValue("Nescau 2.0")
      expect(input).toHaveAttribute("aria-expanded", "false")
      await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve() })
      expect(search).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      fireEvent.change(input, { target: { value: "" } })
      expect(onClearSelection).toHaveBeenCalledTimes(1)
      expect(screen.getByRole("button", { name: "Abrir cadastro manual" })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("nunca dispara busca automática para entrada numérica", async () => {
    vi.useFakeTimers()
    try {
      render(<ProductSearch onSelect={vi.fn()} />)
      const input = screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")
      fireEvent.change(input, { target: { value: "7891000053508" } })
      await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve() })
      expect(search).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("mantém o campo coerente com uma seleção existente e a desfaz ao apagar", () => {
    const onClearSelection = vi.fn()
    render(
      <ProductSearch
        selectedCode="7891000053508"
        selectedLabel="Nestlé Nescau 2.0"
        onSelect={vi.fn()}
        onClearSelection={onClearSelection}
      />,
    )
    const input = screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")
    expect(input).toHaveValue("Nestlé Nescau 2.0")
    fireEvent.change(input, { target: { value: "" } })
    expect(onClearSelection).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue("")
  })

  it("limpa a pesquisa e devolve o foco ao receber uma nova oferta", async () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<ProductSearch resetVersion={0} onSelect={vi.fn()} />)
      const input = screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")
      fireEvent.change(input, { target: { value: "n" } })
      rerender(<ProductSearch resetVersion={1} onSelect={vi.fn()} />)
      await act(async () => { vi.advanceTimersByTime(0); await Promise.resolve() })
      expect(input).toHaveValue("")
      expect(input).toHaveFocus()
    } finally {
      vi.useRealTimers()
    }
  })

  it("torna busca e cadastro manual mutuamente exclusivos", async () => {
    const user = userEvent.setup()
    render(<ProductSearch onSelect={vi.fn()} />)
    const input = screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")
    await user.click(screen.getByRole("button", { name: "Abrir cadastro manual" }))
    expect(input).toBeDisabled()
    expect(screen.getByRole("button", { name: "Buscar" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Fechar" }))
    expect(input).toBeEnabled()
  })

  it("explains the current and planned product-source states", () => {
    render(<ProductSearch onSelect={vi.fn()} />)

    const registered = screen.getByText("Já cadastrado", { exact: true }).closest("li")
    const external = screen.getByText("Novo por EAN/GTIN", { exact: true }).closest("li")
    const manual = screen.getByText("Cadastro manual", { exact: true }).closest("li")

    expect(registered).toHaveTextContent(/nome ou marca consulta somente o catálogo próprio/i)
    expect(registered?.querySelector(".search-status-dot")).toHaveClass("search-status-dot-registered")
    expect(external).toHaveTextContent(/fontes externas/i)
    expect(external?.querySelector(".search-status-dot")).toHaveClass("search-status-dot-default")
    expect(manual?.querySelector(".search-status-dot")).toHaveClass("search-status-dot-manual")
  })

  it("keeps the product available while never displaying a raw or rejected photo", async () => {
    search.mockResolvedValue(result("Foto informal"))
    let finish!: () => void
    vi.mocked(qualifyCandidates).mockImplementation((_candidates, options) => new Promise((resolve) => {
      finish = () => {
        const progress = { candidates: [], evaluations: [], evaluatedCount: 1, totalCount: 1, approvedCount: 0 }
        options.onProgress(progress)
        resolve(progress)
      }
    }))
    const user = userEvent.setup()
    render(<ProductSearch onSelect={vi.fn()} />)
    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "nescau{Enter}")
    expect(screen.getByRole("option", { name: /Foto informal/ })).toBeVisible()
    expect(screen.getByText("Sem foto")).toBeVisible()
    expect(screen.getByRole("button", { name: "Verificando fotos…" })).toBeDisabled()
    await act(async () => finish())
    expect(screen.getByRole("option", { name: /Foto informal/ })).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent("1 produtos encontrados")
  })
  it("shows the filtered result and selects the full image with its provenance", async () => {
    const onSelect = vi.fn()
    search.mockResolvedValue(result("Nescau"))
    const user = userEvent.setup()
    render(<ProductSearch onSelect={onSelect} />)
    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "nescau{Enter}")
    await user.click(await screen.findByRole("option", { name: /Nescau/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ origem: "openfoodfacts", imageUrl: expect.stringContaining("full.jpg") }))
    expect(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")).toHaveValue("Nescau")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("shows each available source photo for an exact product and lets the operator choose one", async () => {
    const cosmosImage = "https://cdn-cosmos.bluesoft.com.br/products/7891000379691"
    const onSelect = vi.fn()
    search.mockResolvedValue({
      elapsedMs: 100, examinedCount: 2, eligibleCount: 1, sourceWarnings: [],
      candidates: [{
        code: "7891000379691", productName: "Nescau", brands: ["Nestlé"], quantity: "370 g", origem: "openfoodfacts",
        imageUrl: "https://images.openfoodfacts.org/front.full.jpg", thumbnailUrl: "https://images.openfoodfacts.org/front.200.jpg", url_original: "https://images.openfoodfacts.org/front.full.jpg",
        photoOptions: [
          { id: "openfoodfacts", origem: "openfoodfacts", imageUrl: "https://images.openfoodfacts.org/front.full.jpg", thumbnailUrl: "https://images.openfoodfacts.org/front.200.jpg", url_original: "https://images.openfoodfacts.org/front.full.jpg" },
          { id: "cosmos", origem: "cosmos", imageUrl: cosmosImage, thumbnailUrl: cosmosImage, url_original: cosmosImage },
        ],
      }],
    })
    const user = userEvent.setup()
    render(<ProductSearch onSelect={onSelect} />)

    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "7891000379691{Enter}")
    expect(await screen.findByRole("button", { name: "Usar foto do Cosmos" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Usar foto do Cosmos" }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ origem: "cosmos", imageUrl: cosmosImage }))
  })

  it("mantém a foto do Cosmos selecionável quando a análise visual traz avisos", async () => {
    const cosmosImage = "https://cdn-cosmos.bluesoft.com.br/products/7896877500919"
    const onSelect = vi.fn()
    search.mockResolvedValue({
      elapsedMs: 100, examinedCount: 1, eligibleCount: 1, sourceWarnings: [],
      candidates: [{
        code: "7896877500919", productName: "Pururuca Croques", brands: ["Croques"], quantity: "40 g", origem: "cosmos",
        imageUrl: cosmosImage, thumbnailUrl: cosmosImage, url_original: cosmosImage,
        photoOptions: [{ id: "cosmos", origem: "cosmos", imageUrl: cosmosImage, thumbnailUrl: cosmosImage, url_original: cosmosImage }],
      }],
    })
    vi.mocked(qualifyCandidates).mockImplementation(async (candidates, options) => {
      const evaluations = candidates.map((candidate) => ({
        ...candidate,
        qualification: { accepted: false, score: 0, background: "other" as const, reasons: ["background" as const, "framing" as const], metrics: { borderMean: 0, borderDeviation: 0, transparentBorder: 0, whiteBorder: 0, occupancy: 1, silhouetteFill: 1, sharpness: 300 } },
      }))
      const progress = { candidates: [], evaluations, evaluatedCount: candidates.length, totalCount: candidates.length, approvedCount: 0 }
      options.onProgress(progress)
      return progress
    })
    const user = userEvent.setup()
    render(<ProductSearch onSelect={onSelect} />)

    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "7896877500919{Enter}")
    const cosmosButton = await screen.findByRole("button", { name: "Usar foto do Cosmos" })
    expect(cosmosButton).toBeEnabled()
    expect(screen.queryByText("Sem foto aprovada")).not.toBeInTheDocument()
    await user.click(cosmosButton)

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ origem: "cosmos", imageUrl: cosmosImage }))
  })

  it("continua bloqueando a foto do Cosmos quando ela não carrega", async () => {
    const cosmosImage = "https://cdn-cosmos.bluesoft.com.br/products/7896877500919"
    search.mockResolvedValue({
      elapsedMs: 100, examinedCount: 1, eligibleCount: 1, sourceWarnings: [],
      candidates: [{
        code: "7896877500919", productName: "Pururuca Croques", brands: ["Croques"], quantity: "40 g", origem: "cosmos",
        imageUrl: cosmosImage, thumbnailUrl: cosmosImage, url_original: cosmosImage,
      }],
    })
    vi.mocked(qualifyCandidates).mockImplementation(async (candidates, options) => {
      const evaluations = candidates.map((candidate) => ({
        ...candidate,
        qualification: { accepted: false, score: 0, background: "other" as const, reasons: ["load" as const], metrics: { borderMean: 0, borderDeviation: 0, transparentBorder: 0, whiteBorder: 0, occupancy: 0, silhouetteFill: 0, sharpness: 0 } },
      }))
      const progress = { candidates: [], evaluations, evaluatedCount: candidates.length, totalCount: candidates.length, approvedCount: 0 }
      options.onProgress(progress)
      return progress
    })
    const user = userEvent.setup()
    render(<ProductSearch onSelect={vi.fn()} />)

    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "7896877500919{Enter}")
    expect(await screen.findByRole("button", { name: "Foto do Cosmos não aprovada" })).toBeDisabled()
    expect(screen.getByText("Não carregou")).toBeVisible()
  })

  it("explica a reprovação de uma foto genérica sem permitir seu uso", async () => {
    const onSelect = vi.fn()
    search.mockResolvedValue(result("Foto genérica"))
    vi.mocked(qualifyCandidates).mockImplementation(async (candidates, options) => {
      const evaluations = candidates.map((candidate) => ({
        ...candidate,
        qualification: { accepted: false, score: 0, background: "white" as const, reasons: ["generic-illustration" as const], metrics: { borderMean: 255, borderDeviation: 0, transparentBorder: 0, whiteBorder: 1, occupancy: 0.4, silhouetteFill: 0.7, sharpness: 300 } },
      }))
      const progress = { candidates: [], evaluations, evaluatedCount: candidates.length, totalCount: candidates.length, approvedCount: 0 }
      options.onProgress(progress)
      return progress
    })
    const user = userEvent.setup()
    render(<ProductSearch onSelect={onSelect} />)

    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "7891000379691{Enter}")

    expect(await screen.findByText(/imagem genérica/i)).toBeVisible()
    expect(screen.getByRole("button", { name: "Foto do Open Food Facts não aprovada" })).toBeDisabled()
    await user.click(screen.getByRole("option", { name: /Foto genérica/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: undefined }))
  })

  it("mantém um aviso do Cosmos visível quando o OFF ainda devolve o produto", async () => {
    search.mockResolvedValue({
      ...result("Nescau"),
      sourceWarnings: [{ source: "cosmos", kind: "unavailable", message: "O Cosmos não ficou disponível nesta busca." }],
    })
    const user = userEvent.setup()
    render(<ProductSearch onSelect={vi.fn()} />)

    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "7891000379691{Enter}")

    expect(await screen.findByText("O Cosmos não ficou disponível nesta busca.")).toBeVisible()
  })

  it("aborts a superseded search and ignores a late success even if fetch ignores cancellation", async () => {
    const older = deferred()
    const newer = deferred()
    search.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const user = userEvent.setup()
    render(<ProductSearch onSelect={vi.fn()} />)
    const input = screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")
    await user.type(input, "nescau{Enter}")
    const oldSignal = search.mock.calls[0][1]!.signal!
    await user.clear(input)
    expect(oldSignal.aborted).toBe(true)
    await user.type(input, "leite{Enter}")
    await act(async () => older.resolve(result("Nescau antigo")))
    expect(screen.queryByText("Nescau antigo")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Buscando…" })).toBeDisabled()
    await act(async () => newer.resolve(result("Leite integral")))
    expect(screen.getByRole("option", { name: /Leite integral/ })).toBeVisible()
  })

  it("does not replace a newer result with an old error", async () => {
    const older = deferred()
    search.mockReturnValueOnce(older.promise).mockResolvedValueOnce(result("Leite"))
    const user = userEvent.setup()
    render(<ProductSearch onSelect={vi.fn()} />)
    const input = screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN")
    await user.type(input, "nescau{Enter}")
    await user.clear(input)
    await user.type(input, "leite{Enter}")
    await act(async () => older.reject(new Error("Falha antiga")))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Leite/ })).toBeVisible()
  })

  it("explains empty results and allows retry after a current error", async () => {
    search.mockRejectedValueOnce(new Error("A busca falhou (HTTP 503)."))
      .mockResolvedValueOnce({ candidates: [], elapsedMs: 10, examinedCount: 0, eligibleCount: 0, sourceWarnings: [] })
    const user = userEvent.setup()
    render(<ProductSearch onSelect={vi.fn()} />)
    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "nescau{Enter}")
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503")
    await user.click(screen.getByRole("button", { name: "Buscar" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Use outro produto já cadastrado")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("cancels pending work on unmount", async () => {
    const pending = deferred()
    search.mockReturnValue(pending.promise)
    const user = userEvent.setup()
    const view = render(<ProductSearch onSelect={vi.fn()} />)
    await user.type(screen.getByLabelText("Pesquisar produto por nome ou GTIN/EAN"), "nescau{Enter}")
    const signal = search.mock.calls[0][1]!.signal!
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(result("Nescau")))
  })
})
