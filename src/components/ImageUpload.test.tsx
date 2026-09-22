import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ImageUpload } from "./ImageUpload"

describe("image upload", () => {
  it("passes a valid local image to the selected product", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ImageUpload productName="Nescau" hasCatalogImage={false} onSelect={onSelect} />)
    const file = new File(["image"], "nescau.png", { type: "image/png" })
    await user.upload(screen.getByLabelText("Escolher foto"), file)
    expect(onSelect).toHaveBeenCalledWith(file)
  })

  it("shows the selected original and lets the operator remove or send it for review", async () => {
    const onRemove = vi.fn()
    const onRequestBackgroundRemoval = vi.fn()
    render(
      <ImageUpload
        productName="Leite"
        hasCatalogImage={false}
        selectedImageUrl="blob:manual-image"
        onSelect={vi.fn()}
        onRemove={onRemove}
        onRequestBackgroundRemoval={onRequestBackgroundRemoval}
        canRequestBackgroundRemoval
      />,
    )

    expect(screen.getByRole("img", { name: "Foto enviada de Leite" })).toHaveAttribute("src", "blob:manual-image")
    await userEvent.click(screen.getByRole("button", { name: "Remover foto" }))
    await userEvent.click(screen.getByRole("button", { name: "Remover fundo com Kie" }))
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onRequestBackgroundRemoval).toHaveBeenCalledOnce()
  })

  it("mostra o recorte já aplicado, sem etapa de revisão separada", () => {
    // O card de revisão foi removido de propósito: ele pintava o PNG transparente
    // sobre fundo branco, onde fica idêntico à foto original de fundo branco. A
    // conferência passou a ser o próprio cartaz, em tamanho real.
    render(
      <ImageUpload
        productName="Leite"
        hasCatalogImage={false}
        selectedImageUrl="blob:cutout"
        selectedImageLabel="Fundo removido pela Kie"
        backgroundRemoved
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole("img", { name: "Foto enviada de Leite" })).toHaveAttribute("src", "blob:cutout")
    expect(screen.getByText("Fundo removido pela Kie")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Usar resultado" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Descartar resultado" })).not.toBeInTheDocument()
  })

  it("labels the image already applied to the cartaz", () => {
    render(<ImageUpload productName="Leite" hasCatalogImage={true} selectedImageUrl="blob:approved" selectedImageLabel="Fundo removido pela Kie" onSelect={vi.fn()} />)
    expect(screen.getByRole("img", { name: "Foto enviada de Leite" })).toHaveAttribute("src", "blob:approved")
    expect(screen.getByText("Fundo removido pela Kie")).toBeInTheDocument()
  })

  it("rejects a non-image file before it reaches the poster", async () => {
    const onSelect = vi.fn()
    render(<ImageUpload productName="Nescau" hasCatalogImage={false} onSelect={onSelect} />)
    fireEvent.change(screen.getByLabelText("Escolher foto"), { target: { files: [new File(["no"], "lista.txt", { type: "text/plain" })] } })
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("arquivo de imagem")
  })
  it("oferece refazer, e não desfazer, quando o fundo já saiu", async () => {
    // Voltar ao fundo branco devolveria o operador a um estado que ele já decidiu
    // abandonar: a Kie é a única rota de saída daquele fundo. A saída para um
    // recorte ruim é refazer, sempre a partir da foto original, ou trocar a foto.
    const onRequestBackgroundRemoval = vi.fn()
    render(
      <ImageUpload
        productName="Nescau"
        hasCatalogImage={true}
        selectedImageUrl="blob:recortada"
        selectedImageLabel="Fundo removido pela Kie"
        canRequestBackgroundRemoval
        backgroundRemoved
        onSelect={vi.fn()}
        onRequestBackgroundRemoval={onRequestBackgroundRemoval}
      />,
    )

    expect(screen.queryByRole("button", { name: "Remover fundo com Kie" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Desfazer/i })).not.toBeInTheDocument()
    expect(screen.getByText(/gera um novo recorte/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Refazer com a Kie" }))
    expect(onRequestBackgroundRemoval).toHaveBeenCalledOnce()
  })
})
