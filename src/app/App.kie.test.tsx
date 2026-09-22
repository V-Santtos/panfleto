import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "./App"

// O crédito da Kie é gasto na criação da tarefa. Tudo que acontece depois — consultar,
// baixar o PNG, medir, aprovar — é gratuito e, portanto, não pode ter poder de veto
// sobre um resultado já pago. Estes testes protegem exatamente isso.

const { measure, requestRemoval, getTask, urlAsDataUrl } = vi.hoisted(() => ({
  measure: vi.fn(),
  requestRemoval: vi.fn(),
  getTask: vi.fn(),
  urlAsDataUrl: vi.fn(),
}))

vi.mock("../api/catalogClient", () => ({
  updateProductDisplayName: vi.fn(),
  validateProductWithImage: vi.fn(),
}))
vi.mock("../export/svgToPng", () => ({ downloadSvgAsPng: vi.fn(), downloadSvgAsPdf: vi.fn() }))
vi.mock("../images/processingClient", () => ({ measureProductPlacement: measure }))
vi.mock("../images/kieClient", () => ({
  fileAsKieDataUrl: vi.fn(),
  urlAsKieDataUrl: urlAsDataUrl,
  requestKieBackgroundRemoval: requestRemoval,
  getKieBackgroundRemovalTask: getTask,
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
      imageUrl: "/api/product-image/images/products/789/front_pt.18.full.jpg",
      thumbnailUrl: "/api/product-image/images/products/789/front_pt.18.full.jpg",
      url_original: "https://images.openfoodfacts.org/images/products/789/front_pt.18.full.jpg",
    })}>Selecionar produto da busca</button>
  ),
}))

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:resultado-kie")
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

async function selectSearchPhoto(): Promise<void> {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: "Selecionar produto da busca" }))
}

describe("remoção de fundo pela Kie", () => {
  it("mantém a foto da busca no cartaz quando a medição falha, e ainda oferece a Kie", async () => {
    // Medir é o que ancora a embalagem no pedestal; não é o que autoriza a foto a
    // existir. Uma foto difícil, em fundo branco, é justamente a que precisa da Kie:
    // se a falha de medição a escondesse, o botão sumiria com ela.
    measure.mockRejectedValue(new Error("Não foi possível medir a embalagem."))

    await selectSearchPhoto()

    expect(await screen.findByRole("button", { name: "Remover fundo com Kie" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("A foto continua no cartaz")
  })

  it("mantém a foto no cartaz e oferece a Kie também quando a medição funciona", async () => {
    measure.mockResolvedValue({
      sourceWidth: 500,
      sourceHeight: 500,
      visibleBounds: { left: 10, top: 10, width: 480, height: 480 },
      hasIntrinsicContactShadow: false,
    })

    await selectSearchPhoto()

    expect(await screen.findByRole("button", { name: "Remover fundo com Kie" })).toBeInTheDocument()
  })

  it("aplica direto no cartaz o PNG já pago, mesmo quando a medição falha", async () => {
    measure.mockRejectedValue(new Error("Não foi possível medir a embalagem."))
    urlAsDataUrl.mockResolvedValue("data:image/png;base64,AAAA")
    requestRemoval.mockResolvedValue({ taskId: "9f8e7d6c" })
    getTask.mockResolvedValue({ state: "success", resultUrl: "/api/kie/remove-background/9f8e7d6c/image" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), { status: 200 })))

    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Selecionar produto da busca" }))
    await user.click(await screen.findByRole("button", { name: "Remover fundo com Kie" }))

    // O recorte chegou e entrou no cartaz mesmo sem geometria, sem etapa intermediária.
    await waitFor(() => expect(screen.getByText("Fundo removido pela Kie")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Refazer com a Kie" })).toBeInTheDocument()
  })

  it("tolera uma consulta de estado que falha antes de concluir a tarefa paga", async () => {
    measure.mockResolvedValue({
      sourceWidth: 500,
      sourceHeight: 500,
      visibleBounds: { left: 10, top: 10, width: 480, height: 480 },
      hasIntrinsicContactShadow: false,
    })
    urlAsDataUrl.mockResolvedValue("data:image/png;base64,AAAA")
    requestRemoval.mockResolvedValue({ taskId: "9f8e7d6c" })
    // Um soluço de rede na consulta não pode encerrar a tentativa e levar o crédito.
    getTask
      .mockRejectedValueOnce(new Error("Não foi possível consultar o recorte neural."))
      .mockResolvedValue({ state: "success", resultUrl: "/api/kie/remove-background/9f8e7d6c/image" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), { status: 200 })))

    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Selecionar produto da busca" }))
    await user.click(await screen.findByRole("button", { name: "Remover fundo com Kie" }))

    await waitFor(() => expect(screen.getByText("Fundo removido pela Kie")).toBeInTheDocument(), { timeout: 10_000 })
    expect(getTask).toHaveBeenCalledTimes(2)
  }, 15_000)
})
