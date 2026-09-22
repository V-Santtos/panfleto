import { useId, useState } from "react"

type ImageUploadProps = {
  productName: string
  hasCatalogImage: boolean
  selectedImageUrl?: string
  selectedImageLabel?: string
  isRemovingBackground?: boolean
  canRequestBackgroundRemoval?: boolean
  backgroundRemoved?: boolean
  onSelect: (file: File) => void
  onRemove?: () => void
  onRequestBackgroundRemoval?: () => void
}

export function ImageUpload({
  productName,
  hasCatalogImage,
  selectedImageUrl,
  selectedImageLabel = "Foto selecionada",
  isRemovingBackground = false,
  canRequestBackgroundRemoval = false,
  backgroundRemoved = false,
  onSelect,
  onRemove,
  onRequestBackgroundRemoval,
}: ImageUploadProps) {
  const inputId = useId()
  const [error, setError] = useState("")

  const selectFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem (PNG, JPEG ou WebP).")
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 12 MB.")
      return
    }
    setError("")
    onSelect(file)
  }

  return (
    <section className="image-upload" aria-labelledby={`${inputId}-title`}>
      <div>
        <span className="product-lockup-label">Embalagem do produto</span>
        <strong id={`${inputId}-title`}>{hasCatalogImage ? "Foto encontrada" : "Envie a foto da embalagem"}</strong>
        <p>{hasCatalogImage ? "Você pode trocar a foto encontrada por outra mais fiel ao produto vendido." : `Encontramos ${productName}, mas não uma foto aprovada. Envie a embalagem correta para completar o cartaz.`}</p>
      </div>
      {selectedImageUrl ? (
        <div className="uploaded-image-preview">
          <img src={selectedImageUrl} alt={`Foto enviada de ${productName}`} />
          <span>{selectedImageLabel}</span>
        </div>
      ) : null}
      <div className="image-upload-actions">
        <label className="button button-secondary image-upload-button" htmlFor={inputId}>
          {selectedImageUrl || hasCatalogImage ? "Trocar foto" : "Escolher foto"}
        </label>
        {selectedImageUrl && onRemove ? (
          <button className="button button-secondary image-upload-button" type="button" onClick={onRemove} disabled={isRemovingBackground}>
            Remover foto
          </button>
        ) : null}
        {selectedImageUrl && canRequestBackgroundRemoval && onRequestBackgroundRemoval ? (
          <button
            className={`button image-upload-button ${backgroundRemoved ? "button-secondary" : "button-primary"}`}
            type="button"
            onClick={onRequestBackgroundRemoval}
            disabled={isRemovingBackground}
          >
            {isRemovingBackground
              ? "Enviando para a Kie…"
              : backgroundRemoved ? "Refazer com a Kie" : "Remover fundo com Kie"}
          </button>
        ) : null}
      </div>
      {backgroundRemoved ? (
        // Refazer não é desfazer: gera um recorte novo, sempre a partir da foto
        // original. Tentar de novo é uso normal da ferramenta, não incidente — o
        // texto informa o que o botão faz, sem transformar isso em alarme.
        <p className="image-upload-hint">Refazer gera um novo recorte na Kie, a partir da foto original.</p>
      ) : null}
      <input
        id={inputId}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => selectFile(event.currentTarget.files?.[0])}
      />
      {error ? <p className="search-error" role="alert">{error}</p> : null}
    </section>
  )
}
