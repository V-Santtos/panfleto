export type RejectionReason = "background" | "resolution" | "empty" | "framing" | "multiple" | "photo-frame" | "blur" | "generic-illustration" | "load"

export type PackshotAssessment = {
  accepted: boolean
  background: "white" | "transparent" | "other"
  score: number
  reasons: RejectionReason[]
  lowResolution?: boolean
  metrics: {
    borderMean: number
    borderDeviation: number
    transparentBorder: number
    whiteBorder: number
    occupancy: number
    silhouetteFill: number
    sharpness: number
  }
}

function hasGenericIllustrationHalo(rgba: Uint8ClampedArray, width: number, height: number, background: PackshotAssessment["background"]): boolean {
  // Cosmos placeholders frequently put a simplified colored object inside a
  // large, nearly uniform gray circle. This is deliberately a narrow visual
  // veto, not product recognition: a real white-background packshot does not
  // acquire this reason unless that halo geometry is present.
  if (background !== "white") return false
  const count = width * height
  const visited = new Uint8Array(count)
  const queue = new Int32Array(count)
  const isNeutralHalo = (index: number) => {
    const offset = index * 4
    const r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2], a = rgba[offset + 3]
    const range = Math.max(r, g, b) - Math.min(r, g, b)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return a >= 16 && range <= 14 && luminance >= 180 && luminance <= 247
  }

  for (let seed = 0; seed < count; seed++) {
    if (visited[seed] || !isNeutralHalo(seed)) continue
    let head = 0, tail = 1
    queue[0] = seed
    visited[seed] = 1
    let pixels = 0, left = width, right = 0, top = height, bottom = 0
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width)
      pixels++
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
      const add = (neighbor: number) => {
        if (!visited[neighbor] && isNeutralHalo(neighbor)) { visited[neighbor] = 1; queue[tail++] = neighbor }
      }
      if (x > 0) add(index - 1)
      if (x < width - 1) add(index + 1)
      if (index >= width) add(index - width)
      if (index < count - width) add(index + width)
    }

    const boxWidth = right - left + 1, boxHeight = bottom - top + 1
    const boxArea = boxWidth * boxHeight
    const ratio = boxWidth / boxHeight
    const fill = pixels / boxArea
    const hasMargins = left > 2 && right < width - 3 && top > 2 && bottom < height - 3
    if (
      pixels / count < 0.055
      || ratio < 0.78 || ratio > 1.28
      || fill < 0.48 || fill > 0.86
      || !hasMargins
    ) continue

    let colorfulInterior = 0
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const offset = (y * width + x) * 4
      if (rgba[offset + 3] < 16) continue
      if (Math.max(rgba[offset], rgba[offset + 1], rgba[offset + 2]) - Math.min(rgba[offset], rgba[offset + 1], rgba[offset + 2]) >= 45) colorfulInterior++
    }
    if (colorfulInterior >= Math.max(20, pixels * 0.08)) return true
  }
  return false
}

// Conservative packshot gate. All metrics run on a <=256px image. No
// modification to the candidate is made by this module.
export function analyzePackshot(
  rgba: Uint8ClampedArray, width: number, height: number, originalWidth: number, originalHeight: number,
  transparentSourceTouchesEdge?: boolean,
  whiteSourceTouchesEdge?: boolean,
): PackshotAssessment {
  if (width < 4 || height < 4 || width > 256 || height > 256 || rgba.length !== width * height * 4) {
    throw new Error("Dimensões inválidas para análise da imagem.")
  }
  const count = width * height
  const gray = new Float32Array(count)
  let borderCount = 0, alphaCount = 0, whiteCount = 0, colorfulCount = 0, sum = 0, squareSum = 0
  for (let i = 0; i < count; i++) {
    const [r, g, b, a] = rgba.subarray(i * 4, i * 4 + 4)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    gray[i] = luminance * a / 255 + 255 - a
    const x = i % width, y = Math.floor(i / width)
    if (x < 3 || y < 3 || x >= width - 3 || y >= height - 3) {
      borderCount++
      if (a < 10) alphaCount++
      if (a >= 10 && Math.max(r, g, b) - Math.min(r, g, b) > 28) colorfulCount++
      if (a < 10 || (Math.min(r, g, b) >= 240 && Math.max(r, g, b) - Math.min(r, g, b) <= 15)) whiteCount++
      sum += gray[i]
      squareSum += gray[i] ** 2
    }
  }
  const borderMean = sum / borderCount
  const borderDeviation = Math.sqrt(Math.max(0, squareSum / borderCount - borderMean ** 2))
  const transparentBorder = alphaCount / borderCount
  const whiteBorder = whiteCount / borderCount
  const background = transparentBorder > 0.9 ? "transparent"
    : borderMean > 240 && whiteBorder >= 0.85 && colorfulCount / borderCount < 0.04 ? "white" : "other"
  const reasons: RejectionReason[] = []
  if (background === "other") reasons.push("background")
  if (hasGenericIllustrationHalo(rgba, width, height, background)) reasons.push("generic-illustration")
  if (!Number.isFinite(originalWidth) || !Number.isFinite(originalHeight) || Math.max(originalWidth, originalHeight) < 200) reasons.push("resolution")

  const visited = new Uint8Array(count)
  const queue = new Int32Array(count)
  let head = 0, tail = 0
  function isBackground(i: number) {
    const offset = i * 4
    if (rgba[offset + 3] < 16) return true
    if (background === "transparent") return false
    const r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2]
    return Math.min(r, g, b) >= 248 && Math.max(r, g, b) - Math.min(r, g, b) < 12
  }
  function addBackground(i: number) {
    if (!visited[i] && isBackground(i)) { visited[i] = 1; queue[tail++] = i }
  }
  for (let x = 0; x < width; x++) { addBackground(x); addBackground((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { addBackground(y * width); addBackground(y * width + width - 1) }
  while (head < tail) {
    const i = queue[head++], x = i % width
    if (x > 0) addBackground(i - 1)
    if (x < width - 1) addBackground(i + 1)
    if (i >= width) addBackground(i - width)
    if (i < count - width) addBackground(i + width)
  }

  type Component = { pixels: number; left: number; right: number; top: number; bottom: number }
  const components: Component[] = []
  const foreground = new Uint8Array(count)
  for (let seed = 0; seed < count; seed++) {
    if (visited[seed]) continue
    head = 0; tail = 1; queue[0] = seed; visited[seed] = 1
    const component: Component = { pixels: 0, left: width, right: 0, top: height, bottom: 0 }
    const add = (i: number) => { if (!visited[i]) { visited[i] = 1; queue[tail++] = i } }
    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width)
      component.pixels++
      component.left = Math.min(component.left, x); component.right = Math.max(component.right, x)
      component.top = Math.min(component.top, y); component.bottom = Math.max(component.bottom, y)
      if (x > 0) add(i - 1)
      if (x < width - 1) add(i + 1)
      if (i >= width) add(i - width)
      if (i < count - width) add(i + width)
    }
    if (component.pixels >= Math.max(4, count * 0.0005)) {
      components.push(component)
      for (let j = 0; j < tail; j++) foreground[queue[j]] = 1
    }
  }
  components.sort((a, b) => b.pixels - a.pixels)
  const object = components[0]
  let occupancy = 0, silhouetteFill = 0
  if (!object) reasons.push("empty")
  else {
    const boxWidth = object.right - object.left + 1, boxHeight = object.bottom - object.top + 1
    occupancy = boxWidth * boxHeight / count
    silhouetteFill = object.pixels / (boxWidth * boxHeight)
    // Thin bottles are legitimate: constrain dominant-axis occupancy rather than
    // requiring a square package to occupy 30% of the entire canvas.
    // Transparent packshots may retain a one-pixel antialiasing margin around a
    // tightly cropped package. Treat an actual edge touch as a crop, but do not
    // reject that harmless transparent margin.
    // This canvas guard measures the margin in analysis pixels, so the margin it
    // demands from the source grows with the file: a tight 500px packshot would
    // need four source pixels while a 2000px one needs sixteen. It stays only as
    // the fallback for callers that cannot measure the source.
    const canvasEdgeGuard = object.left <= 1 || object.right >= width - 2 || object.top <= 1 || object.bottom >= height - 2
    const touchesSourceEdge = background === "transparent"
      // The analysis canvas may round a one-pixel transparent margin onto its
      // edge. When the worker supplies the original alpha-edge measurement,
      // trust it; standalone callers retain the conservative canvas fallback.
      ? transparentSourceTouchesEdge ?? (object.left === 0 || object.right === width - 1 || object.top === 0 || object.bottom === height - 1)
      // A small white-background packshot keeps only a few source pixels of
      // margin, which downsampling rounds onto the analysis edge and turns into
      // a false crop. Prefer the worker's full-resolution ring measurement.
      : background === "white" ? whiteSourceTouchesEdge ?? canvasEdgeGuard
        : canvasEdgeGuard
    if (occupancy < 0.12 || occupancy > 0.96 || Math.max(boxWidth / width, boxHeight / height) < 0.55 || touchesSourceEdge) reasons.push("framing")
    if (components[1] && components[1].pixels > object.pixels * 0.12) reasons.push("multiple")
    // A photo pasted inside a white margin normally forms a completely filled
    // rectangle. Keep this veto conservative; some flat rectangular packs may fail.
    if (background === "white" && silhouetteFill > 0.985) reasons.push("photo-frame")
  }

  let lapCount = 0, lapSum = 0, lapSquareSum = 0
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x
    if (!foreground[i]) continue
    const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]
    lapCount++; lapSum += lap; lapSquareSum += lap * lap
  }
  const sharpness = lapCount ? Math.max(0, lapSquareSum / lapCount - (lapSum / lapCount) ** 2) : 0
  if (object && sharpness < 18) reasons.push("blur")
  const accepted = reasons.length === 0
  const score = accepted ? Math.round(Math.min(100, 75 + Math.min(15, sharpness / 100) + (background === "transparent" ? 10 : whiteBorder * 5))) : 0
  return { accepted, background, score, reasons, lowResolution: Math.max(originalWidth, originalHeight) < 600, metrics: { borderMean, borderDeviation, transparentBorder, whiteBorder, occupancy, silhouetteFill, sharpness } }
}
