import type { SupabaseClient } from "@supabase/supabase-js"
import { createHash } from "node:crypto"

import type { CatalogProduct, CatalogProductImage, DraftProductInput, ValidatedProductInput } from "../src/domain/catalog.js"
import { createServerSupabase, type SupabaseServerConfig } from "./supabaseClient.js"

export type ValidatedImageBytes = {
  bytes: Uint8Array
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  extension: "png" | "jpg" | "webp"
  width: number
  height: number
}

type ProductRow = {
  id: string
  registration_method?: "gtin_lookup" | "manual"
  gtin: string | null
  canonical_name: string
  display_name: string
  brand_name: string | null
  default_quantity: number | string
  default_unit: CatalogProduct["defaultUnit"]
  status: CatalogProduct["status"]
}

type ImageRow = {
  id: string
  product_id: string
  source_origin: CatalogProductImage["sourceOrigin"]
  source_width_px: number
  source_height_px: number
  visible_left_px: number
  visible_top_px: number
  visible_width_px: number
  visible_height_px: number
  has_intrinsic_contact_shadow: boolean
  processed_asset: {
    bucket: string
    object_path: string
    width_px: number
    height_px: number
  } | Array<{
    bucket: string
    object_path: string
    width_px: number
    height_px: number
  }> | null
}

export type IntegrationUsageReservation = {
  allowed: boolean
  usageDate: string
  usedCount: number
  dailyLimit: number
  remaining: number
}

export interface CatalogRepository {
  searchActiveProducts(name: string, limit?: number): Promise<CatalogProduct[]>
  findProductByGtin(gtin: string): Promise<CatalogProduct | undefined>
  createDraftProduct(input: DraftProductInput): Promise<CatalogProduct>
  validateProductWithImage(input: ValidatedProductInput, image: ValidatedImageBytes): Promise<CatalogProduct>
  updateProductDisplayName(productId: string, displayName: string): Promise<CatalogProduct>
  reserveIntegrationUsage(provider: "cosmos"): Promise<IntegrationUsageReservation>
  getIntegrationUsage(provider: "cosmos"): Promise<Omit<IntegrationUsageReservation, "allowed">>
}

export class CatalogRepositoryError extends Error {
  constructor(
    message: string,
    readonly kind: "conflict" | "not_found" | "unavailable" | "internal" = "internal",
  ) {
    super(message)
    this.name = "CatalogRepositoryError"
  }
}

function databaseError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "23505") throw new CatalogRepositoryError("Já existe um produto com este GTIN/EAN.", "conflict")
  throw new CatalogRepositoryError("O catálogo persistente está indisponível no momento.", "unavailable")
}

function productFromRow(row: ProductRow, primaryImage?: CatalogProductImage): CatalogProduct {
  const quantity = Number(row.default_quantity)
  if (!Number.isFinite(quantity)) throw new CatalogRepositoryError("O banco retornou uma quantidade inválida.")
  return {
    id: row.id,
    registrationMethod: row.registration_method === "manual" ? "manual" : "gtin_lookup",
    ...(row.gtin ? { gtin: row.gtin } : {}),
    canonicalName: row.canonical_name,
    displayName: row.display_name,
    ...(row.brand_name ? { brandName: row.brand_name } : {}),
    defaultQuantity: quantity,
    defaultUnit: row.default_unit,
    status: row.status,
    ...(primaryImage ? { primaryImage } : {}),
  }
}

function relatedAsset(row: ImageRow): Exclude<ImageRow["processed_asset"], null | Array<unknown>> | undefined {
  if (!row.processed_asset) return
  return Array.isArray(row.processed_asset) ? row.processed_asset[0] : row.processed_asset
}

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private async hydrateProducts(rows: ProductRow[]): Promise<CatalogProduct[]> {
    if (!rows.length) return []
    const ids = rows.map((row) => row.id)
    const { data, error } = await this.supabase
      .from("product_images")
      .select("id,product_id,source_origin,source_width_px,source_height_px,visible_left_px,visible_top_px,visible_width_px,visible_height_px,has_intrinsic_contact_shadow,processed_asset:assets!processed_asset_id(bucket,object_path,width_px,height_px)")
      .in("product_id", ids)
      .eq("association_status", "approved")
      .eq("is_primary", true)
    if (error) databaseError(error)

    const images = new Map<string, CatalogProductImage>()
    for (const rawImage of data ?? []) {
      const image = rawImage as unknown as ImageRow
      const asset = relatedAsset(image)
      if (!asset) continue
      const { data: signed, error: signedError } = await this.supabase.storage
        .from(asset.bucket)
        .createSignedUrl(asset.object_path, 300)
      if (signedError || !signed?.signedUrl) databaseError(signedError)
      images.set(image.product_id, {
        id: image.id,
        sourceOrigin: image.source_origin,
        url: signed.signedUrl,
        widthPx: asset.width_px,
        heightPx: asset.height_px,
        visibleLeftPx: image.visible_left_px,
        visibleTopPx: image.visible_top_px,
        visibleWidthPx: image.visible_width_px,
        visibleHeightPx: image.visible_height_px,
        hasIntrinsicContactShadow: image.has_intrinsic_contact_shadow,
      })
    }
    return rows.map((row) => productFromRow(row, images.get(row.id)))
  }

  async searchActiveProducts(name: string, limit = 12): Promise<CatalogProduct[]> {
    const { data, error } = await this.supabase.rpc("search_active_products", {
      query_value: name,
      result_limit: Math.min(Math.max(limit, 1), 12),
    })
    if (error) databaseError(error)
    return this.hydrateProducts((data ?? []) as ProductRow[])
  }

  async findProductByGtin(gtin: string): Promise<CatalogProduct | undefined> {
    const { data, error } = await this.supabase
      .from("products")
      .select("id,gtin,canonical_name,display_name,brand_name,default_quantity,default_unit,registration_method,status")
      .eq("gtin", gtin)
      .maybeSingle()
    if (error) databaseError(error)
    if (!data) return
    return (await this.hydrateProducts([data as ProductRow]))[0]
  }

  async createDraftProduct(input: DraftProductInput): Promise<CatalogProduct> {
    const { data, error } = await this.supabase
      .from("products")
      .insert({
        gtin: input.gtin ?? null,
        canonical_name: input.canonicalName.trim(),
        display_name: input.displayName.trim().replace(/\s+/g, " "),
        brand_name: input.brandName?.trim() || null,
        default_quantity: input.defaultQuantity,
        default_unit: input.defaultUnit,
        registration_method: input.registrationMethod,
        metadata_origin: input.metadataOrigin,
        status: "draft",
      })
      .select("id,gtin,canonical_name,display_name,brand_name,default_quantity,default_unit,registration_method,status")
      .single()
    if (error || !data) databaseError(error)
    return productFromRow(data as ProductRow)
  }

  async validateProductWithImage(input: ValidatedProductInput, image: ValidatedImageBytes): Promise<CatalogProduct> {
    const productSelection = "id,gtin,canonical_name,display_name,brand_name,default_quantity,default_unit,registration_method,status"
    let productRow: ProductRow | undefined
    let createdProduct = false

    if (input.catalogProductId) {
      const { data, error } = await this.supabase.from("products").select(productSelection).eq("id", input.catalogProductId).maybeSingle()
      if (error) databaseError(error)
      productRow = data as ProductRow | undefined
    } else if (input.gtin) {
      const { data, error } = await this.supabase.from("products").select(productSelection).eq("gtin", input.gtin).maybeSingle()
      if (error) databaseError(error)
      if (data && data.status === "active" && input.registrationMethod === "manual") {
        throw new CatalogRepositoryError("Já existe um produto com este GTIN/EAN.", "conflict")
      }
      productRow = data as ProductRow | undefined
    }

    if (!productRow) {
      const { data, error } = await this.supabase
        .from("products")
        .insert({
          gtin: input.gtin ?? null,
          canonical_name: input.canonicalName.trim(),
          display_name: input.displayName.trim().replace(/\s+/g, " "),
          brand_name: input.brandName?.trim() || null,
          default_quantity: input.defaultQuantity,
          default_unit: input.defaultUnit,
          registration_method: input.registrationMethod,
          metadata_origin: input.metadataOrigin,
          status: "draft",
        })
        .select(productSelection)
        .single()
      if (error || !data) databaseError(error)
      productRow = data as ProductRow
      createdProduct = true
    } else if (productRow.status !== "active") {
      const { data, error } = await this.supabase
        .from("products")
        .update({
          canonical_name: input.canonicalName.trim(),
          display_name: input.displayName.trim().replace(/\s+/g, " "),
          brand_name: input.brandName?.trim() || null,
          default_quantity: input.defaultQuantity,
          default_unit: input.defaultUnit,
          metadata_origin: input.metadataOrigin,
        })
        .eq("id", productRow.id)
        .select(productSelection)
        .single()
      if (error || !data) databaseError(error)
      productRow = data as ProductRow
    }

    const sha256 = createHash("sha256").update(image.bytes).digest("hex")
    const objectPath = `products/${productRow.id}/${sha256}.${image.extension}`
    let assetId: string | undefined
    let createdAsset = false
    let uploadedObject = false
    let createdImageId: string | undefined
    let retiredPrimaryId: string | undefined

    const { data: existingAsset, error: existingAssetError } = await this.supabase
      .from("assets")
      .select("id,sha256,mime_type,width_px,height_px")
      .eq("bucket", "catalog-assets")
      .eq("object_path", objectPath)
      .maybeSingle()
    if (existingAssetError) databaseError(existingAssetError)
    if (existingAsset) {
      if (existingAsset.sha256 !== sha256
        || existingAsset.mime_type !== image.mimeType
        || existingAsset.width_px !== image.width
        || existingAsset.height_px !== image.height) {
        throw new CatalogRepositoryError("O ativo existente não corresponde à foto validada.", "conflict")
      }
      assetId = String(existingAsset.id)
    } else {
      const { error: uploadError } = await this.supabase.storage
        .from("catalog-assets")
        .upload(objectPath, image.bytes, { contentType: image.mimeType, upsert: false })
      if (uploadError && String((uploadError as { statusCode?: string | number }).statusCode) !== "409") databaseError(uploadError)
      uploadedObject = !uploadError

      const { data: asset, error: assetError } = await this.supabase
        .from("assets")
        .insert({
          kind: "product_processed",
          bucket: "catalog-assets",
          object_path: objectPath,
          mime_type: image.mimeType,
          byte_size: image.bytes.byteLength,
          sha256,
          width_px: image.width,
          height_px: image.height,
        })
        .select("id")
        .single()
      if (assetError || !asset) {
        if (uploadedObject) await this.supabase.storage.from("catalog-assets").remove([objectPath])
        databaseError(assetError)
      }
      assetId = String(asset.id)
      createdAsset = true
    }

    try {
      const { data: currentPrimary, error: primaryError } = await this.supabase
        .from("product_images")
        .select("id,processed_asset_id")
        .eq("product_id", productRow.id)
        .eq("association_status", "approved")
        .eq("is_primary", true)
        .maybeSingle()
      if (primaryError) databaseError(primaryError)

      const { data: sameImage, error: sameImageError } = await this.supabase
        .from("product_images")
        .select("id")
        .eq("processed_asset_id", assetId)
        .maybeSingle()
      if (sameImageError) databaseError(sameImageError)

      let imageId = sameImage?.id as string | undefined
      if (currentPrimary && currentPrimary.id !== imageId) {
        const { error } = await this.supabase
          .from("product_images")
          .update({ is_primary: false, association_status: "retired" })
          .eq("id", currentPrimary.id)
        if (error) databaseError(error)
        retiredPrimaryId = String(currentPrimary.id)
      }

      const imageValues = {
        product_id: productRow.id,
        source_origin: input.sourceOrigin,
        source_url: input.sourceUrl ?? null,
        processed_asset_id: assetId,
        processing_method: input.processingMethod,
        pipeline_version: input.pipelineVersion,
        source_width_px: image.width,
        source_height_px: image.height,
        visible_left_px: input.visibleLeftPx,
        visible_top_px: input.visibleTopPx,
        visible_width_px: input.visibleWidthPx,
        visible_height_px: input.visibleHeightPx,
        has_intrinsic_contact_shadow: input.hasIntrinsicContactShadow,
        is_primary: true,
        association_status: "approved",
        usage_rights_status: "unknown",
        approved_at: new Date().toISOString(),
      }
      if (imageId) {
        const { error } = await this.supabase.from("product_images").update(imageValues).eq("id", imageId)
        if (error) databaseError(error)
      } else {
        const { data, error } = await this.supabase.from("product_images").insert(imageValues).select("id").single()
        if (error || !data) databaseError(error)
        imageId = String(data.id)
        createdImageId = imageId
      }

      const { data: activated, error: activationError } = await this.supabase.rpc("activate_product", { product_id_value: productRow.id })
      if (activationError || !activated) databaseError(activationError)
      const activatedRow = (Array.isArray(activated) ? activated[0] : activated) as ProductRow
      return (await this.hydrateProducts([activatedRow]))[0]
    } catch (error) {
      if (createdImageId) await this.supabase.from("product_images").delete().eq("id", createdImageId)
      if (retiredPrimaryId) {
        await this.supabase
          .from("product_images")
          .update({ is_primary: true, association_status: "approved" })
          .eq("id", retiredPrimaryId)
      }
      if (createdAsset && assetId) {
        const { error: assetDeleteError } = await this.supabase.from("assets").delete().eq("id", assetId)
        if (!assetDeleteError) await this.supabase.storage.from("catalog-assets").remove([objectPath])
      }
      if (createdProduct) await this.supabase.from("products").delete().eq("id", productRow.id)
      throw error
    }
  }

  async updateProductDisplayName(productId: string, displayName: string): Promise<CatalogProduct> {
    const { data, error } = await this.supabase
      .from("products")
      .update({ display_name: displayName.trim().replace(/\s+/g, " ") })
      .eq("id", productId)
      .eq("status", "active")
      .select("id,gtin,canonical_name,display_name,brand_name,default_quantity,default_unit,registration_method,status")
      .maybeSingle()
    if (error) databaseError(error)
    if (!data) throw new CatalogRepositoryError("Produto ativo não encontrado.", "not_found")
    return (await this.hydrateProducts([data as ProductRow]))[0]
  }

  async reserveIntegrationUsage(provider: "cosmos"): Promise<IntegrationUsageReservation> {
    const { data, error } = await this.supabase.rpc("reserve_integration_usage", { provider_value: provider })
    if (error) databaseError(error)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new CatalogRepositoryError("O banco não confirmou a reserva da cota.")
    return {
      allowed: Boolean(row.allowed),
      usageDate: String(row.usage_date),
      usedCount: Number(row.used_count),
      dailyLimit: Number(row.daily_limit),
      remaining: Number(row.remaining),
    }
  }

  async getIntegrationUsage(provider: "cosmos"): Promise<Omit<IntegrationUsageReservation, "allowed">> {
    const { data, error } = await this.supabase.rpc("get_integration_usage", { provider_value: provider })
    if (error) databaseError(error)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new CatalogRepositoryError("O banco não retornou o estado da cota.")
    return {
      usageDate: String(row.usage_date),
      usedCount: Number(row.used_count),
      dailyLimit: Number(row.daily_limit),
      remaining: Number(row.remaining),
    }
  }
}

export function createCatalogRepository(config: SupabaseServerConfig): CatalogRepository {
  return new SupabaseCatalogRepository(createServerSupabase(config))
}
