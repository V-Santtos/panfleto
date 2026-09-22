import type { CatalogProduct, DraftProductInput, ValidatedProductInput } from "../domain/catalog"

type ErrorBody = { code?: string; message?: string }

export class CatalogClientError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message)
    this.name = "CatalogClientError"
  }
}

async function catalogRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    let body: ErrorBody = {}
    try { body = await response.json() as ErrorBody } catch { /* resposta sem JSON */ }
    throw new CatalogClientError(
      body.message || `O catálogo respondeu HTTP ${response.status}.`,
      body.code || "CATALOG_REQUEST_FAILED",
      response.status,
    )
  }
  return response.json() as Promise<T>
}

export async function searchRegisteredProducts(name: string, options: { signal?: AbortSignal } = {}): Promise<CatalogProduct[]> {
  const result = await catalogRequest<{ products: CatalogProduct[] }>(
    `/api/catalogo/products?name=${encodeURIComponent(name)}`,
    { signal: options.signal },
  )
  return result.products
}

export async function findRegisteredProductByGtin(gtin: string, options: { signal?: AbortSignal } = {}): Promise<CatalogProduct | undefined> {
  try {
    const result = await catalogRequest<{ product: CatalogProduct }>(
      `/api/catalogo/products/by-gtin/${encodeURIComponent(gtin)}`,
      { signal: options.signal },
    )
    return result.product
  } catch (error) {
    if (error instanceof CatalogClientError && error.status === 404 && error.code === "PRODUCT_NOT_FOUND") return
    throw error
  }
}

export async function createDraftProduct(input: DraftProductInput, options: { signal?: AbortSignal } = {}): Promise<CatalogProduct> {
  const path = input.registrationMethod === "manual"
    ? "/api/catalogo/products/manual"
    : "/api/catalogo/products/from-gtin"
  const result = await catalogRequest<{ product: CatalogProduct }>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: options.signal,
  })
  return result.product
}

export async function validateProductWithImage(
  input: ValidatedProductInput,
  image: Blob,
  options: { signal?: AbortSignal } = {},
): Promise<CatalogProduct> {
  const response = await fetch("/api/catalogo/products/validate", {
    method: "POST",
    headers: {
      "Content-Type": image.type || "application/octet-stream",
      "X-Catalog-Metadata": encodeURIComponent(JSON.stringify(input)),
    },
    body: image,
    signal: options.signal,
  })
  if (!response.ok) {
    let body: ErrorBody = {}
    try { body = await response.json() as ErrorBody } catch { /* resposta sem JSON */ }
    throw new CatalogClientError(
      body.message || `O catálogo respondeu HTTP ${response.status}.`,
      body.code || "CATALOG_REQUEST_FAILED",
      response.status,
    )
  }
  return (await response.json() as { product: CatalogProduct }).product
}

export async function updateProductDisplayName(
  productId: string,
  displayName: string,
  options: { signal?: AbortSignal } = {},
): Promise<CatalogProduct> {
  const result = await catalogRequest<{ product: CatalogProduct }>(
    `/api/catalogo/products/${encodeURIComponent(productId)}/display-name`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
      signal: options.signal,
    },
  )
  return result.product
}
