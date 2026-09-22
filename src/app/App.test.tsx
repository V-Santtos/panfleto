import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { App } from "./App"

describe("minimum Story flow", () => {
  it("introduces the campaign as an intelligent poster", () => {
    render(<App />)

    expect(screen.getByRole("heading", { name: "Cartaz inteligente." })).toBeVisible()
    expect(screen.getByText(/A prévia ao lado se atualiza na hora/i)).toBeVisible()
  })

  it("offers placeholder themes without changing the poster yet", async () => {
    const user = userEvent.setup()
    render(<App />)

    const defaultTheme = screen.getByRole("button", { name: "Padrão" })
    const christmasTheme = screen.getByRole("button", { name: "Natal" })
    expect(screen.getByRole("button", { name: "Black Friday" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Dia das Crianças" })).toBeVisible()
    expect(defaultTheme).toHaveAttribute("aria-pressed", "true")
    expect(christmasTheme).toHaveAttribute("aria-pressed", "false")

    await user.click(christmasTheme)

    expect(defaultTheme).toHaveAttribute("aria-pressed", "false")
    expect(christmasTheme).toHaveAttribute("aria-pressed", "true")
  })

  it("switches to the independent Feed SVG", async () => {
    const user = userEvent.setup()
    render(<App />)

    const story = screen.getByRole("button", { name: "Story" })
    const feed = screen.getByRole("button", { name: "Feed" })
    expect(story).toHaveAttribute("aria-pressed", "true")
    expect(feed).toHaveAttribute("aria-pressed", "false")

    await user.click(feed)

    expect(story).toHaveAttribute("aria-pressed", "false")
    expect(feed).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("Feed", { selector: "strong" })).toBeVisible()
    expect(screen.getByTestId("feed-poster")).toBeVisible()
    expect(screen.queryByTestId("story-poster")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Baixar Feed em PNG" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Baixar Story em PDF" })).toBeDisabled()
  })

  it("keeps the preview toolbar focused on format selection", () => {
    render(<App />)

    expect(screen.queryByText("Ajustado à tela")).not.toBeInTheDocument()
  })

  it("keeps the editor inline and makes the previous price optional", async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Preço promocional")).toBeVisible()
    expect(screen.queryByLabelText("Preço cheio")).not.toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /Exibir preço cheio riscado/i }))
    expect(screen.getByLabelText("Preço cheio")).toBeInTheDocument()
  })

  it("updates the Story immediately while the user types", async () => {
    const user = userEvent.setup()
    render(<App />)

    const promotional = screen.getByLabelText("Preço promocional")
    await user.clear(promotional)
    await user.type(promotional, "9,99")

    expect(screen.getByTestId("story-poster").querySelector("desc")).toHaveTextContent(
      /R\$\s?9,99/,
    )
    expect(screen.getByRole("button", { name: "Baixar Story em PNG" })).toBeDisabled()
  })

  it("offers PNG and PDF downloads after the same review gate", () => {
    render(<App />)

    expect(screen.getByRole("button", { name: "Baixar Story em PNG" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Baixar Story em PDF" })).toBeDisabled()
  })

  it("lets the operator select the commercial unit manually", async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText("Quantidade"), "500")
    await user.click(screen.getByLabelText("Unidade da apresentação"))
    await user.click(screen.getByRole("option", { name: "ml" }))

    expect(screen.getByTestId("story-weight")).toHaveTextContent("500 ML")
  })
})
