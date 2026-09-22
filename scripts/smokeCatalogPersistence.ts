import { createClient } from "@supabase/supabase-js"
import { loadEnv } from "vite"

const PROJECT_REF = "ytwbhphmsdntrxfyzhtt"
const GTIN = "9999999999994"
const NAME = "OfertaLab Smoke Produto 20260907"
const API_ORIGIN = "http://127.0.0.1:4173"
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

const env = loadEnv("development", process.cwd(), "")
const url = env.SUPABASE_URL?.trim()
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key || !new URL(url).hostname.startsWith(PROJECT_REF)) {
  throw new Error("O smoke test não encontrou a configuração do projeto Supabase esperado.")
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
let productId: string | undefined
let searched = false
let assetFetched = false

async function cleanup(): Promise<void> {
  const { data: product } = await supabase.from("products").select("id,canonical_name").eq("gtin", GTIN).maybeSingle()
  if (!product) return
  if (product.canonical_name !== NAME) throw new Error("O GTIN técnico pertence a outro registro; limpeza interrompida.")
  productId = String(product.id)
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("processed_asset_id")
    .eq("product_id", productId)
  if (imagesError) throw imagesError
  const assetIds = (images ?? []).map((image) => String(image.processed_asset_id))
  const { data: assets, error: assetsError } = assetIds.length
    ? await supabase.from("assets").select("id,bucket,object_path").in("id", assetIds)
    : { data: [], error: null }
  if (assetsError) throw assetsError
  if ((assets ?? []).some((asset) => asset.bucket !== "catalog-assets" || !String(asset.object_path).startsWith(`products/${productId}/`))) {
    throw new Error("A limpeza encontrou um caminho fora do produto técnico.")
  }
  const { error: imageDeleteError } = await supabase.from("product_images").delete().eq("product_id", productId)
  if (imageDeleteError) throw imageDeleteError
  if (assetIds.length) {
    const { error: assetDeleteError } = await supabase.from("assets").delete().in("id", assetIds)
    if (assetDeleteError) throw assetDeleteError
  }
  const { error: productDeleteError } = await supabase.from("products").delete().eq("id", productId).eq("canonical_name", NAME)
  if (productDeleteError) throw productDeleteError
  for (const asset of assets ?? []) {
    const { error } = await supabase.storage.from(String(asset.bucket)).remove([String(asset.object_path)])
    if (error) throw error
  }
}

try {
  await cleanup()
  const metadata = {
    gtin: GTIN,
    canonicalName: NAME,
    displayName: NAME,
    brandName: "OfertaLab",
    defaultQuantity: 1,
    defaultUnit: "unidade",
    registrationMethod: "gtin_lookup",
    metadataOrigin: "openfoodfacts",
    sourceOrigin: "upload_usuario",
    processingMethod: "alpha_preserved",
    pipelineVersion: "remote-smoke-v1",
    sourceWidthPx: 1,
    sourceHeightPx: 1,
    visibleLeftPx: 0,
    visibleTopPx: 0,
    visibleWidthPx: 1,
    visibleHeightPx: 1,
    hasIntrinsicContactShadow: false,
  }
  const response = await fetch(`${API_ORIGIN}/api/catalogo/products/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "X-Catalog-Metadata": encodeURIComponent(JSON.stringify(metadata)),
    },
    body: PNG_1X1,
  })
  if (!response.ok) throw new Error(`A ativação remota respondeu HTTP ${response.status}: ${await response.text()}`)
  const saved = await response.json() as { product: { id: string; status: string; primaryImage?: { url?: string } } }
  productId = saved.product.id
  if (saved.product.status !== "active" || !saved.product.primaryImage?.url) throw new Error("O produto não voltou ativo com imagem primária.")

  const search = await fetch(`${API_ORIGIN}/api/catalogo/products?name=${encodeURIComponent(NAME)}`)
  if (!search.ok) throw new Error(`A busca local respondeu HTTP ${search.status}.`)
  const result = await search.json() as { products: Array<{ id: string }> }
  searched = result.products.some((product) => product.id === productId)
  if (!searched) throw new Error("O produto ativo não reapareceu na busca por nome.")

  const asset = await fetch(saved.product.primaryImage.url)
  assetFetched = asset.ok && (await asset.arrayBuffer()).byteLength === PNG_1X1.byteLength
  if (!assetFetched) throw new Error("A foto persistida não pôde ser recuperada do Storage.")
} finally {
  await cleanup()
}

const { count, error: countError } = await supabase
  .from("products")
  .select("id", { count: "exact", head: true })
if (countError) throw countError

process.stdout.write(JSON.stringify({ activated: Boolean(productId), searched, assetFetched, productsAfterCleanup: count }))
