export type InspectedImage = {
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  extension: "png" | "jpg" | "webp"
  width: number
  height: number
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

function uint16(bytes: Uint8Array, offset: number, littleEndian = false): number {
  return littleEndian
    ? bytes[offset] | bytes[offset + 1] << 8
    : bytes[offset] << 8 | bytes[offset + 1]
}

function uint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16
}

function inspectPng(bytes: Uint8Array): InspectedImage | undefined {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value) || ascii(bytes, 12, 4) !== "IHDR") return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { mimeType: "image/png", extension: "png", width: view.getUint32(16), height: view.getUint32(20) }
}

function inspectJpeg(bytes: Uint8Array): InspectedImage | undefined {
  if (bytes.length < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
  let offset = 2
  while (offset + 8 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if (marker === 0xd8 || marker === 0xd9) continue
    if (offset + 2 > bytes.length) return
    const length = uint16(bytes, offset)
    if (length < 2 || offset + length > bytes.length) return
    if (frameMarkers.has(marker)) {
      return {
        mimeType: "image/jpeg",
        extension: "jpg",
        height: uint16(bytes, offset + 3),
        width: uint16(bytes, offset + 5),
      }
    }
    offset += length
  }
}

function inspectWebp(bytes: Uint8Array): InspectedImage | undefined {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return
  const chunk = ascii(bytes, 12, 4)
  if (chunk === "VP8X") {
    return {
      mimeType: "image/webp",
      extension: "webp",
      width: uint24LittleEndian(bytes, 24) + 1,
      height: uint24LittleEndian(bytes, 27) + 1,
    }
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const b1 = bytes[21], b2 = bytes[22], b3 = bytes[23], b4 = bytes[24]
    return {
      mimeType: "image/webp",
      extension: "webp",
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    }
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      mimeType: "image/webp",
      extension: "webp",
      width: uint16(bytes, 26, true) & 0x3fff,
      height: uint16(bytes, 28, true) & 0x3fff,
    }
  }
}

export function inspectImageBytes(bytes: Uint8Array, declaredType?: string): InspectedImage {
  const inspected = inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes)
  if (!inspected || inspected.width <= 0 || inspected.height <= 0 || inspected.width > 10_000 || inspected.height > 10_000) {
    throw new Error("A foto enviada não é um PNG, JPEG ou WebP válido.")
  }
  const normalizedDeclaredType = declaredType?.split(";", 1)[0].trim().toLowerCase()
  if (normalizedDeclaredType?.startsWith("image/") && normalizedDeclaredType !== inspected.mimeType) {
    throw new Error("O tipo declarado da foto não corresponde aos bytes enviados.")
  }
  return inspected
}
