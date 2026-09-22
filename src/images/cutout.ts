export type RgbaImage = {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type VisibleAlphaBounds = {
  left: number
  top: number
  width: number
  height: number
}

export type ProductImageGeometry = {
  sourceWidth: number
  sourceHeight: number
  visibleBounds: VisibleAlphaBounds
  hasIntrinsicContactShadow?: boolean
}

// Alpha below this threshold is typically antialiasing or a soft drop shadow.
// The physical product, not this faint fringe, determines its pedestal contact.
const PRODUCT_ALPHA_THRESHOLD = 48

export function visibleAlphaBounds(image: RgbaImage, alphaThreshold = PRODUCT_ALPHA_THRESHOLD): VisibleAlphaBounds | undefined {
  let left = image.width, top = image.height, right = -1, bottom = -1
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (image.data[(y * image.width + x) * 4 + 3] < alphaThreshold) continue
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  if (right < left || bottom < top) return
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

// Compartilhado com a qualificação: o ringing de JPEG ao redor da embalagem
// fica logo abaixo do branco puro (piso de ruído de 241 medido no CDN do
// Cosmos), então só um pixel claramente não branco conta como produto.
const PRODUCT_CONTENT_THRESHOLD = 232
// Um respingo solto não pode esticar a caixa medida.
const MINIMUM_CONTENT_PIXELS = 3

// Mede a embalagem dentro de uma foto opaca em fundo branco. Medir uma caixa
// tolera erro de alguns pixels; produzir uma máscara alfa por código, não. Esta
// função nunca altera a imagem.
export function visibleContentBounds(image: RgbaImage): VisibleAlphaBounds | undefined {
  const { data, width, height } = image
  const rowCounts = new Uint32Array(height)
  const columnCounts = new Uint32Array(width)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    if (data[offset + 3] < PRODUCT_ALPHA_THRESHOLD) continue
    if (Math.min(data[offset], data[offset + 1], data[offset + 2]) >= PRODUCT_CONTENT_THRESHOLD) continue
    rowCounts[y]++
    columnCounts[x]++
  }
  let top = -1, bottom = -1, left = -1, right = -1
  for (let y = 0; y < height; y++) if (rowCounts[y] >= MINIMUM_CONTENT_PIXELS) { if (top === -1) top = y; bottom = y }
  for (let x = 0; x < width; x++) if (columnCounts[x] >= MINIMUM_CONTENT_PIXELS) { if (left === -1) left = x; right = x }
  if (top === -1 || left === -1) return
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

// A faint band below the measured product means the source already carries a
// contact shadow. In that case the poster must not add a second one.
// Uma imagem só conta como já recortada quando sua BORDA é transparente. Um
// pixel semitransparente solto no meio de uma foto em fundo branco não
// significa fundo removido: medir essa foto pelo canal alfa devolveria a tela
// inteira como se fosse a embalagem, e o produto sairia pequeno e flutuando.
export function hasTransparentBackground(image: RgbaImage): boolean {
  const { data, width, height } = image
  const opaque = (x: number, y: number) => data[(y * width + x) * 4 + 3] >= 16
  for (let x = 0; x < width; x++) if (opaque(x, 0) || opaque(x, height - 1)) return false
  for (let y = 0; y < height; y++) if (opaque(0, y) || opaque(width - 1, y)) return false
  return true
}

export function hasSoftContactShadow(image: RgbaImage, bounds: VisibleAlphaBounds): boolean {
  const left = Math.max(0, bounds.left - Math.ceil(bounds.width * 0.2))
  const right = Math.min(image.width - 1, bounds.left + bounds.width - 1 + Math.ceil(bounds.width * 0.2))
  const startY = bounds.top + bounds.height
  const endY = Math.min(image.height - 1, startY + Math.max(4, Math.ceil(bounds.height * 0.08)))
  let softPixels = 0

  for (let y = startY; y <= endY; y++) for (let x = left; x <= right; x++) {
    const alpha = image.data[(y * image.width + x) * 4 + 3]
    if (alpha >= 8 && alpha < PRODUCT_ALPHA_THRESHOLD) softPixels++
  }

  return softPixels >= Math.max(6, Math.ceil(bounds.width * 0.012))
}
