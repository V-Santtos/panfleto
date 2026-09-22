export type ImageOrigin =
  | "openfoodfacts"
  | "gs1"
  | "cosmos"
  | "curadoria_interna"
  | "upload_usuario"

export type ImageProvenance = {
  origem: ImageOrigin
  url_original?: string
}
