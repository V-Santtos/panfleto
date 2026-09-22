function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível incorporar o template."))
    reader.readAsDataURL(blob)
  })
}

export type SvgExportDimensions = {
  width: number
  height: number
}

export function getSvgExportDimensions(svg: SVGSVGElement): SvgExportDimensions {
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/).map(Number)
  if (!viewBox || viewBox.length !== 4) {
    throw new Error("O cartaz não possui dimensões de exportação válidas.")
  }

  const [, , width, height] = viewBox
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("O cartaz não possui dimensões de exportação válidas.")
  }

  return { width, height }
}

export function cloneSvgForExport(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll("[data-export-exclude]").forEach((element) => element.remove())
  return clone
}

async function renderSvgAsPng(svg: SVGSVGElement): Promise<Blob> {
  await document.fonts.ready
  await nextFrame()

  const { width, height } = getSvgExportDimensions(svg)
  const clone = cloneSvgForExport(svg)
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))

  const fontResponse = await fetch("/fonts/KomikaAxis-Regular.ttf")
  if (!fontResponse.ok) throw new Error("Não foi possível carregar a fonte do cartaz.")
  const fontDataUrl = await blobToDataUrl(await fontResponse.blob())
  const fontStyle = document.createElementNS("http://www.w3.org/2000/svg", "style")
  fontStyle.textContent = `@font-face { font-family: 'Komika Axis'; src: url('${fontDataUrl}') format('truetype'); font-weight: 400; font-style: normal; }`
  clone.prepend(fontStyle)

  await Promise.all(
    Array.from(clone.querySelectorAll("image")).map(async (image) => {
      const href = image.getAttribute("href")
      if (!href || href.startsWith("data:")) return

      const response = await fetch(new URL(href, window.location.href))
      if (!response.ok) throw new Error("Não foi possível carregar o template para exportação.")
      image.setAttribute("href", await blobToDataUrl(await response.blob()))
    }),
  )

  const source = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const rendered = new Image()
    rendered.decoding = "async"
    rendered.src = svgUrl
    await rendered.decode()

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Não foi possível preparar a exportação.")

    context.drawImage(rendered, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Não foi possível gerar o PNG."))
      }, "image/png")
    })

    return png
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
  downloadBlob(await renderSvgAsPng(svg), filename)
}

export async function createStoryPdf(pngDataUrl: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf")
  // A 9:16 page keeps the full Story, with no crop or independent PDF layout.
  const widthMm = 101.25
  const heightMm = 180
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [widthMm, heightMm],
    compress: true,
  })
  pdf.addImage(pngDataUrl, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST")
  return new Blob([pdf.output("arraybuffer")], { type: "application/pdf" })
}

export async function downloadSvgAsPdf(svg: SVGSVGElement, filename: string): Promise<void> {
  const png = await renderSvgAsPng(svg)
  downloadBlob(await createStoryPdf(await blobToDataUrl(png)), filename)
}
