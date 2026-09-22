import { describe, expect, it } from "vitest"

import { cloneSvgForExport, createStoryPdf, getSvgExportDimensions } from "./svgToPng"

const renderedPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAATSURBVBhXY/jPwPAfDBkY/oMBAEnICfeW3k0uAAAAAElFTkSuQmCC"

describe("Story PDF export", () => {
  it("creates a single-page PDF from the rendered Story image", async () => {
    const pdf = await createStoryPdf(renderedPng)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(pdf)
    })
    const pdfText = atob(dataUrl.split(",")[1])

    expect(pdf.type).toBe("application/pdf")
    expect(pdfText.slice(0, 5)).toBe("%PDF-")
    expect(pdfText.match(/\/Type \/Page\b/g)).toHaveLength(1)
  })
})

describe("SVG PNG export dimensions", () => {
  it("uses the Feed SVG dimensions instead of assuming Story", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", "0 0 1080 1350")

    expect(getSvgExportDimensions(svg)).toEqual({ width: 1080, height: 1350 })
  })

  it("rejects a missing or invalid viewBox", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    expect(() => getSvgExportDimensions(svg)).toThrow(/dimensões/i)

    svg.setAttribute("viewBox", "0 0 1080 0")
    expect(() => getSvgExportDimensions(svg)).toThrow(/dimensões/i)
  })

  it("removes preview-only interaction targets from the exported SVG clone", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    const image = document.createElementNS("http://www.w3.org/2000/svg", "image")
    const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    hitArea.setAttribute("data-export-exclude", "true")
    svg.append(image, hitArea)

    const clone = cloneSvgForExport(svg)
    expect(clone.querySelector("image")).not.toBeNull()
    expect(clone.querySelector("[data-export-exclude]")).toBeNull()
    expect(svg.querySelector("[data-export-exclude]")).not.toBeNull()
  })
})
