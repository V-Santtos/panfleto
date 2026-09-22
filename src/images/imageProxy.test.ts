import { describe, expect, it } from "vitest"
import { detectedImageContentType, hasAllowedImageContentType, remoteProductImage } from "../../server/productImageProxy"

describe("fixed-origin image proxy", () => {
  it("only maps selected OFF front images", () => {
    expect(remoteProductImage("/api/product-image/images/products/789/123/456/7890/front_pt.3.full.jpg"))
      .toBe("https://images.openfoodfacts.org/images/products/789/123/456/7890/front_pt.3.full.jpg")
  })
  it("maps an exact Cosmos thumbnail through the same local image boundary", () => {
    expect(remoteProductImage("/api/product-image/cosmos/7891000370100"))
      .toBe("https://cdn-cosmos.bluesoft.com.br/products/7891000370100")
  })
  it("accepts a missing CDN content type only after identifying a real image signature", () => {
    expect(hasAllowedImageContentType(null)).toBe(true)
    expect(hasAllowedImageContentType("image/png")).toBe(true)
    expect(hasAllowedImageContentType("text/html")).toBe(false)
    expect(detectedImageContentType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png")
    expect(detectedImageContentType(new Uint8Array([60, 104, 116, 109, 108]))).toBeUndefined()
  })
  it.each(["/api/product-image?url=http://127.0.0.1", "/api/product-image/../../private", "/api/product-image/images/products/123/1.jpg", "/api/product-image/images/products/123/front_pt.3.full.jpg?url=other", "/api/product-image/images/products/123/ingredients_pt.3.full.jpg"])("rejects unapproved destinations: %s", (path) => {
    expect(remoteProductImage(path)).toBeUndefined()
  })
})
