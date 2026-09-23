import { useEffect, useMemo, useRef, useState } from "react"

import { ImageUpload } from "../components/ImageUpload"
import { FeedPoster } from "../components/FeedPoster"
import { OfferControls } from "../components/OfferControls"
import { ProductSearch } from "../components/ProductSearch"
import { StoryPoster } from "../components/StoryPoster"
import { updateProductDisplayName, validateProductWithImage } from "../api/catalogClient"
import { isValidGtin, type ValidatedProductInput } from "../domain/catalog"
import {
  normalizeOffer,
  offerForPreview,
  validateOfferDraft,
  type OfferDraft,
} from "../domain/offer"
import { AUTOMATIC_PRODUCT_PLACEMENT, type ProductPlacement } from "../domain/productPlacement"
import { presentationFromQuantity, type ProductCandidate } from "../domain/productSearch"
import { downloadSvgAsPdf, downloadSvgAsPng } from "../export/svgToPng"
import type { ProductImageGeometry } from "../images/cutout"
import { fileAsKieDataUrl, getKieBackgroundRemovalTask, type KieRemovalStatus, requestKieBackgroundRemoval, urlAsKieDataUrl } from "../images/kieClient"
import { measureProductPlacement } from "../images/processingClient"

const KIE_POLL_INTERVAL_MS = 2_500
const KIE_MAX_POLLS = 40
const KIE_MAX_CONSECUTIVE_POLL_FAILURES = 3
const THEME_OPTIONS = [
  "Padrão",
  "Dia das Mães",
  "Dia dos Pais",
  "Natal",
  "Páscoa",
  "Festa Junina",
  "Carnaval",
  "Dia dos Namorados",
  "Dia das Crianças",
  "Black Friday",
  "Ano-Novo",
] as const

type ThemeOption = typeof THEME_OPTIONS[number]
type PreviewFormat = "story" | "feed"

const EMPTY_OFFER_DRAFT: OfferDraft = {
  productName: "",
  quantity: "",
  unit: "g",
  promotionalPrice: "",
  hasPreviousPrice: false,
  previousPrice: "",
}

export function App() {
  const [draft, setDraft] = useState<OfferDraft>(EMPTY_OFFER_DRAFT)
  const [selectedProduct, setSelectedProduct] = useState<ProductCandidate>()
  const [manualImageFile, setManualImageFile] = useState<File>()
  const [manualImageUrl, setManualImageUrl] = useState<string>()
  const [manualImageGeometry, setManualImageGeometry] = useState<ProductImageGeometry>()
  const [kieImageUrl, setKieImageUrl] = useState<string>()
  const [kieGeometry, setKieGeometry] = useState<ProductImageGeometry>()
  const [removingBackgroundWithKie, setRemovingBackgroundWithKie] = useState(false)
  const [kieError, setKieError] = useState("")
  const [processedImageUrl, setProcessedImageUrl] = useState<string>()
  const [processedImageGeometry, setProcessedImageGeometry] = useState<ProductImageGeometry>()
  const [processingImage, setProcessingImage] = useState(false)
  const [processingError, setProcessingError] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<"png" | "pdf">()
  const [exportError, setExportError] = useState("")
  const [exportSuccess, setExportSuccess] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>("Padrão")
  const [selectedPreviewFormat, setSelectedPreviewFormat] = useState<PreviewFormat>("story")
  const [storyProductPlacement, setStoryProductPlacement] = useState<ProductPlacement>(AUTOMATIC_PRODUCT_PLACEMENT)
  // Um deslocamento por formato: o Story e o Feed têm palcos, placas e pedestais
  // próprios, então arrastar em um nunca move a embalagem no outro.
  const [feedProductPlacement, setFeedProductPlacement] = useState<ProductPlacement>(AUTOMATIC_PRODUCT_PLACEMENT)
  const [searchResetVersion, setSearchResetVersion] = useState(0)
  const storyRef = useRef<SVGSVGElement>(null)
  const feedRef = useRef<SVGSVGElement>(null)
  const activeProcessing = useRef<AbortController | null>(null)
  const activeKieProcessing = useRef<AbortController | null>(null)
  const ownedObjectUrls = useRef(new Set<string>())
  const trackObjectUrl = (url: string) => {
    ownedObjectUrls.current.add(url)
    return url
  }
  const revokeObjectUrl = (url: string | undefined) => {
    if (!url || !ownedObjectUrls.current.delete(url)) return
    URL.revokeObjectURL(url)
  }
  // Trocar produto ou foto devolve os dois cartazes ao encaixe automático. Zerar
  // um só deixaria o outro formato com o deslocamento de uma embalagem que já
  // não está mais ali.
  const resetProductPlacements = () => {
    setStoryProductPlacement(AUTOMATIC_PRODUCT_PLACEMENT)
    setFeedProductPlacement(AUTOMATIC_PRODUCT_PLACEMENT)
  }
  const errors = useMemo(() => validateOfferDraft(draft), [draft])
  const offer = useMemo(() => offerForPreview(draft), [draft])
  const productImageUrl = kieImageUrl ?? manualImageUrl ?? processedImageUrl
  const productImageGeometry = kieGeometry ?? manualImageGeometry ?? processedImageGeometry
  const isValid = Object.keys(errors).length === 0 && Boolean(selectedProduct && productImageUrl) && !processingImage

  useEffect(() => () => {
    activeProcessing.current?.abort()
    activeKieProcessing.current?.abort()
    for (const url of ownedObjectUrls.current) URL.revokeObjectURL(url)
    ownedObjectUrls.current.clear()
  }, [])

  const updateDraft = <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setConfirmed(false)
    setExportError("")
    setExportSuccess(false)
  }

  const selectProduct = (candidate: ProductCandidate) => {
    const presentation = presentationFromQuantity(candidate.quantity)
    const brandName = candidate.brands.join(" ")
    const candidateName = candidate.productName === "Produto sem descrição"
      ? brandName || "Produto"
      : candidate.productName
    const safeName = candidateName.length <= 27 ? candidateName : brandName || candidateName

    activeProcessing.current?.abort()
    activeProcessing.current = null
    activeKieProcessing.current?.abort()
    activeKieProcessing.current = null
    revokeObjectUrl(manualImageUrl)
    revokeObjectUrl(kieImageUrl)
    revokeObjectUrl(processedImageUrl)
    setSelectedProduct(candidate)
    setManualImageFile(undefined)
    setManualImageUrl(undefined)
    setManualImageGeometry(undefined)
    setKieImageUrl(undefined)
    setKieGeometry(undefined)
    setRemovingBackgroundWithKie(false)
    setKieError("")
    resetProductPlacements()
    setProcessedImageUrl(undefined)
    setProcessedImageGeometry(undefined)
    setProcessingError("")
    setDraft((current) => ({
      ...current,
      productName: safeName,
      quantity: presentation ? String(presentation.quantity) : current.quantity,
      unit: presentation?.unit ?? current.unit,
    }))
    setConfirmed(false)
    setExportError("")
    setExportSuccess(false)

    if (candidate.imageUrl && candidate.catalogImageGeometry) {
      setProcessedImageUrl(candidate.imageUrl)
      setProcessedImageGeometry(candidate.catalogImageGeometry)
      setProcessingImage(false)
      return
    }

    if (!candidate.imageUrl) {
      setProcessingImage(false)
      return
    }
    const imageUrl = candidate.imageUrl
    const controller = new AbortController()
    activeProcessing.current = controller
    setProcessingImage(true)
    // A foto entra no cartaz como veio da fonte. O fundo sai pela Kie, se o
    // operador pedir, nunca por código.
    //
    // Ela entra ANTES da medição, e não dentro do `then`. Medir é o que ancora a
    // embalagem no pedestal, não o que autoriza a foto a existir: quando a medição
    // falhava, a foto da busca sumia do cartaz e o botão da Kie desaparecia junto,
    // porque ele depende de `productImageUrl`. Isso trancava exatamente o caso que
    // mais precisa da Kie — a foto difícil, em fundo branco. O upload manual nunca
    // teve esse portão; agora os dois caminhos se comportam igual.
    setProcessedImageUrl(imageUrl)
    setProcessedImageGeometry(undefined)
    void measureProductPlacement(imageUrl, { signal: controller.signal })
      .then((placement) => {
        if (activeProcessing.current !== controller || controller.signal.aborted) return
        setProcessedImageGeometry(placement)
      })
      .catch((error: unknown) => {
        if (activeProcessing.current !== controller || controller.signal.aborted) return
        setProcessingError(error instanceof Error ? error.message : "Não foi possível medir a embalagem.")
      })
      .finally(() => {
        if (activeProcessing.current === controller) {
          activeProcessing.current = null
          setProcessingImage(false)
        }
      })
  }

  const clearProductSelection = () => {
    activeProcessing.current?.abort()
    activeProcessing.current = null
    activeKieProcessing.current?.abort()
    activeKieProcessing.current = null
    revokeObjectUrl(manualImageUrl)
    revokeObjectUrl(kieImageUrl)
    revokeObjectUrl(processedImageUrl)
    setSelectedProduct(undefined)
    setManualImageFile(undefined)
    setManualImageUrl(undefined)
    setManualImageGeometry(undefined)
    setKieImageUrl(undefined)
    setKieGeometry(undefined)
    setRemovingBackgroundWithKie(false)
    setKieError("")
    setProcessedImageUrl(undefined)
    setProcessedImageGeometry(undefined)
    setProcessingImage(false)
    setProcessingError("")
    resetProductPlacements()
    setDraft({ ...EMPTY_OFFER_DRAFT })
    setConfirmed(false)
    setExportError("")
    setExportSuccess(false)
  }

  const selectManualImage = (file: File) => {
    activeProcessing.current?.abort()
    activeProcessing.current = null
    activeKieProcessing.current?.abort()
    activeKieProcessing.current = null
    revokeObjectUrl(manualImageUrl)
    revokeObjectUrl(kieImageUrl)
    revokeObjectUrl(processedImageUrl)
    setProcessedImageUrl(undefined)
    setProcessedImageGeometry(undefined)
    setManualImageGeometry(undefined)
    setProcessingError("")
    setManualImageFile(file)
    const imageUrl = trackObjectUrl(URL.createObjectURL(file))
    setManualImageUrl(imageUrl)
    setKieImageUrl(undefined)
    setKieGeometry(undefined)
    setRemovingBackgroundWithKie(false)
    setKieError("")
    resetProductPlacements()
    setConfirmed(false)
    setExportError("")
    setExportSuccess(false)
    const controller = new AbortController()
    activeProcessing.current = controller
    setProcessingImage(true)
    void measureProductPlacement(imageUrl, { signal: controller.signal })
      .then((geometry) => {
        if (activeProcessing.current !== controller || controller.signal.aborted) return
        setManualImageGeometry(geometry)
      })
      .catch((error: unknown) => {
        if (activeProcessing.current !== controller || controller.signal.aborted) return
        setProcessingError(error instanceof Error ? error.message : "Não foi possível medir a embalagem.")
      })
      .finally(() => {
        if (activeProcessing.current === controller) {
          activeProcessing.current = null
          setProcessingImage(false)
        }
      })
  }

  const removeManualImage = () => {
    activeProcessing.current?.abort()
    activeProcessing.current = null
    activeKieProcessing.current?.abort()
    activeKieProcessing.current = null
    revokeObjectUrl(manualImageUrl)
    revokeObjectUrl(kieImageUrl)
    revokeObjectUrl(processedImageUrl)
    setManualImageFile(undefined)
    setManualImageUrl(undefined)
    setManualImageGeometry(undefined)
    setKieImageUrl(undefined)
    setKieGeometry(undefined)
    setProcessedImageUrl(undefined)
    setProcessedImageGeometry(undefined)
    setProcessingImage(false)
    setProcessingError("")
    setRemovingBackgroundWithKie(false)
    setKieError("")
    resetProductPlacements()
    setConfirmed(false)
    setExportError("")
    setExportSuccess(false)
  }

  // Não existe "desfazer" aqui, e isso é deliberado: a Kie é a única rota para tirar
  // o fundo branco, então voltar à foto original devolveria o operador a um estado
  // que ele já decidiu abandonar. A saída para um recorte ruim é refazer — que cria
  // uma tarefa nova e, portanto, gasta outro crédito — ou trocar a foto, que é
  // gratuito. `requestBackgroundRemovalWithKie` sempre parte da foto original, nunca
  // da própria saída da Kie, então refazer não empilha recorte sobre recorte.

  const commitStoryProductPlacement = (placement: ProductPlacement) => {
    setStoryProductPlacement(placement)
    setConfirmed(false)
    setExportError("")
    setExportSuccess(false)
  }

  const commitFeedProductPlacement = (placement: ProductPlacement) => {
    setFeedProductPlacement(placement)
    setConfirmed(false)
    setExportError("")
    setExportSuccess(false)
  }

  const resetOffer = () => {
    activeProcessing.current?.abort()
    activeProcessing.current = null
    activeKieProcessing.current?.abort()
    activeKieProcessing.current = null
    revokeObjectUrl(manualImageUrl)
    revokeObjectUrl(kieImageUrl)
    revokeObjectUrl(processedImageUrl)
    setDraft({ ...EMPTY_OFFER_DRAFT })
    setSelectedProduct(undefined)
    setManualImageFile(undefined)
    setManualImageUrl(undefined)
    setManualImageGeometry(undefined)
    setKieImageUrl(undefined)
    setKieGeometry(undefined)
    setRemovingBackgroundWithKie(false)
    setKieError("")
    setProcessedImageUrl(undefined)
    setProcessedImageGeometry(undefined)
    setProcessingImage(false)
    setProcessingError("")
    setConfirmed(false)
    setExportingFormat(undefined)
    setExportError("")
    setExportSuccess(false)
    resetProductPlacements()
    setSearchResetVersion((current) => current + 1)
  }

  const requestBackgroundRemovalWithKie = async () => {
    if (removingBackgroundWithKie) return
    // A foto pode ter vindo do upload manual ou da busca por EAN/GTIN. O limite
    // de tamanho vale para as duas e é aplicado ao preparar o envio.
    const source = manualImageFile ?? processedImageUrl
    if (!source) return
    const controller = new AbortController()
    activeKieProcessing.current?.abort()
    activeKieProcessing.current = controller
    setRemovingBackgroundWithKie(true)
    setKieError("")
    try {
      const image = typeof source === "string" ? await urlAsKieDataUrl(source) : await fileAsKieDataUrl(source)
      const task = await requestKieBackgroundRemoval(image)
      let consecutivePollFailures = 0
      for (let attempt = 0; attempt < KIE_MAX_POLLS; attempt++) {
        if (controller.signal.aborted) return
        // O crédito já foi gasto na criação da tarefa; consultar o estado não cobra
        // de novo. Um soluço de rede numa consulta, portanto, não pode encerrar a
        // tentativa e levar o crédito junto: ele é tolerado e refeito no ciclo
        // seguinte, e só uma sequência de falhas desiste.
        let status: KieRemovalStatus
        try {
          status = await getKieBackgroundRemovalTask(task.taskId)
          consecutivePollFailures = 0
        } catch (error) {
          if (controller.signal.aborted) return
          consecutivePollFailures += 1
          if (consecutivePollFailures > KIE_MAX_CONSECUTIVE_POLL_FAILURES) throw error
          await new Promise<void>((resolve) => window.setTimeout(resolve, KIE_POLL_INTERVAL_MS))
          continue
        }
        if (status.state === "fail") throw new Error(status.failureMessage || "A Kie não conseguiu recortar essa foto.")
        if (status.state === "success" && status.resultUrl) {
          // O status já devolve um caminho de relay na mesma origem
          // (`/api/kie/remove-background/<task>/image`), então basta buscá-lo.
          // Passá-lo para a rota de importação faria o servidor recusá-lo: ela
          // só aceita URL absoluta hospedada pela Kie.
          const relay = await fetch(status.resultUrl, { signal: controller.signal })
          if (!relay.ok) throw new Error("Não foi possível trazer o resultado concluído da Kie.")
          const blob = await relay.blob()
          if (controller.signal.aborted) return
          const localUrl = trackObjectUrl(URL.createObjectURL(blob))
          // O PNG já chegou e já custou um crédito. Medir só acrescenta a ancoragem
          // no pedestal; falhar em medir não pode descartar o resultado pago. Sem
          // geometria ele fica igual a uma foto manual recém-enviada, que o Story já
          // sabe posicionar pela caixa da imagem.
          let placement: ProductImageGeometry | undefined
          try {
            placement = await measureProductPlacement(localUrl, { signal: controller.signal })
          } catch {
            placement = undefined
          }
          if (controller.signal.aborted) {
            revokeObjectUrl(localUrl)
            return
          }
          // O recorte entra no cartaz direto. Não há etapa de revisão porque não
          // havia como revisar: o card antigo pintava o PNG transparente sobre
          // fundo branco, onde ele fica idêntico à foto original com fundo branco.
          // A conferência acontece no cartaz, em tamanho real, antes da exportação.
          // Refazer, se o recorte sair ruim, parte sempre da foto original abaixo.
          revokeObjectUrl(kieImageUrl)
          setKieImageUrl(localUrl)
          setKieGeometry(placement)
          resetProductPlacements()
          setConfirmed(false)
          setExportError("")
          setExportSuccess(false)
          return
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, KIE_POLL_INTERVAL_MS))
      }
      throw new Error("A Kie demorou demais para concluir o recorte. Tente novamente mais tarde.")
    } catch (error) {
      if (!controller.signal.aborted) setKieError(error instanceof Error ? error.message : "Não foi possível concluir o recorte com a Kie.")
    } finally {
      if (activeKieProcessing.current === controller) {
        activeKieProcessing.current = null
        setRemovingBackgroundWithKie(false)
      }
    }
  }

  const handleExport = async (format: "png" | "pdf") => {
    if (format === "pdf" && selectedPreviewFormat !== "story") return
    const poster = selectedPreviewFormat === "feed" ? feedRef.current : storyRef.current
    if (!poster || exportingFormat || !confirmed || !isValid) return
    setExportingFormat(format)
    setExportError("")
    setExportSuccess(false)
    try {
      const validatedOffer = normalizeOffer(draft)
      if (!selectedProduct || !productImageUrl) throw new Error("Selecione e valide a embalagem antes de baixar.")

      if (
        selectedProduct.catalogProductId
        && selectedProduct.catalogImageId
        && validatedOffer.productName !== selectedProduct.productName
      ) {
        const updatedProduct = await updateProductDisplayName(selectedProduct.catalogProductId, validatedOffer.productName)
        setSelectedProduct((current) => current ? {
          ...current,
          productName: updatedProduct.displayName,
          canonicalName: updatedProduct.canonicalName,
        } : current)
      }

      const alreadyPersistedImage = Boolean(
        selectedProduct.catalogProductId
        && selectedProduct.catalogImageId
        && !manualImageUrl
        && !kieImageUrl,
      )
      if (!alreadyPersistedImage) {
        const imageResponse = await fetch(productImageUrl)
        if (!imageResponse.ok) throw new Error("Não foi possível preparar a foto para o catálogo.")
        const imageBlob = await imageResponse.blob()
        const measuredGeometry = productImageGeometry ?? await (() => {
          const localUrl = URL.createObjectURL(imageBlob)
          return measureProductPlacement(localUrl).finally(() => URL.revokeObjectURL(localUrl))
        })()
        const gtin = isValidGtin(selectedProduct.code) ? selectedProduct.code : undefined
        const manualDraft = Boolean(selectedProduct.catalogProductId && !selectedProduct.catalogImageId && !gtin)
        const metadataOrigin: ValidatedProductInput["metadataOrigin"] = manualDraft
          ? "manual"
          : selectedProduct.origem === "cosmos"
            ? "cosmos"
            : selectedProduct.origem === "curadoria_interna"
              ? "curadoria_interna"
              : "openfoodfacts"
        const sourceOrigin: ValidatedProductInput["sourceOrigin"] = manualImageFile
          ? "upload_usuario"
          : selectedProduct.origem
        const persisted = await validateProductWithImage({
          ...(gtin ? { gtin } : {}),
          ...(selectedProduct.catalogProductId ? { catalogProductId: selectedProduct.catalogProductId } : {}),
          canonicalName: selectedProduct.canonicalName ?? selectedProduct.productName,
          displayName: validatedOffer.productName,
          ...(selectedProduct.brands.length ? { brandName: selectedProduct.brands.join(" ") } : {}),
          defaultQuantity: validatedOffer.quantity,
          defaultUnit: validatedOffer.unit,
          registrationMethod: gtin ? "gtin_lookup" : "manual",
          metadataOrigin,
          sourceOrigin,
          ...(!manualImageFile && selectedProduct.url_original?.startsWith("https://") ? { sourceUrl: selectedProduct.url_original } : {}),
          processingMethod: kieImageUrl ? "kie" : "alpha_preserved",
          pipelineVersion: "manual-export-validation-v1",
          sourceWidthPx: measuredGeometry.sourceWidth,
          sourceHeightPx: measuredGeometry.sourceHeight,
          visibleLeftPx: measuredGeometry.visibleBounds.left,
          visibleTopPx: measuredGeometry.visibleBounds.top,
          visibleWidthPx: measuredGeometry.visibleBounds.width,
          visibleHeightPx: measuredGeometry.visibleBounds.height,
          hasIntrinsicContactShadow: measuredGeometry.hasIntrinsicContactShadow === true,
        }, imageBlob)
        setSelectedProduct((current) => current ? {
          ...current,
          productName: persisted.displayName,
          canonicalName: persisted.canonicalName,
          catalogProductId: persisted.id,
          ...(persisted.primaryImage ? { catalogImageId: persisted.primaryImage.id } : {}),
        } : current)
      }
      const date = new Date().toISOString().slice(0, 10)
      if (format === "png") {
        await downloadSvgAsPng(poster, `campanha-${date}-${selectedPreviewFormat}.png`)
      } else {
        await downloadSvgAsPdf(poster, `campanha-${date}-story.pdf`)
      }
      setExportSuccess(true)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : `Falha ao gerar o ${format.toUpperCase()}.`)
    } finally {
      setExportingFormat(undefined)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="Oferta Lab">
          <span className="brand-index">01</span>
          <span>Oferta Lab</span>
        </div>
      </header>

      <main className="workspace">
        <section className="control-panel" aria-labelledby="page-title">
          <div className="control-heading">
            <h1 id="page-title">Cartaz inteligente.</h1>
            <p className="lede">
              Informe os dados da oferta. A prévia ao lado se atualiza na hora para você conferir tudo antes de baixar.
            </p>
          </div>

          <section className="theme-selector" aria-labelledby="theme-selector-title">
            <p className="theme-selector-label" id="theme-selector-title">Tema do cartaz</p>
            <div className="theme-options" role="group" aria-label="Escolha um tema para o cartaz">
              {THEME_OPTIONS.map((theme) => (
                <button
                  className="theme-option"
                  type="button"
                  key={theme}
                  aria-pressed={selectedTheme === theme}
                  onClick={() => setSelectedTheme(theme)}
                >
                  {theme}
                </button>
              ))}
            </div>
          </section>

          <ProductSearch
            selectedCode={selectedProduct?.code}
            selectedLabel={selectedProduct?.productName}
            selectedRegistrationMethod={selectedProduct?.registrationMethod}
            resetVersion={searchResetVersion}
            onSelect={selectProduct}
            onClearSelection={clearProductSelection}
          />

          {selectedProduct ? (
            <>
              <ImageUpload
                productName={selectedProduct.productName}
                hasCatalogImage={Boolean(productImageUrl)}
                selectedImageUrl={productImageUrl}
                selectedImageLabel={kieImageUrl
                  ? "Fundo removido pela Kie"
                  : manualImageUrl
                    ? "Foto original enviada"
                    : "Foto selecionada"}
                isRemovingBackground={removingBackgroundWithKie}
                canRequestBackgroundRemoval={Boolean(productImageUrl)}
                backgroundRemoved={Boolean(kieImageUrl)}
                onSelect={selectManualImage}
                onRemove={removeManualImage}
                onRequestBackgroundRemoval={() => void requestBackgroundRemovalWithKie()}
              />
              {processingImage ? <p className="image-processing" role="status">Medindo a embalagem…</p> : null}
              {processingError ? <p className="search-error" role="alert">{processingError} A foto continua no cartaz: você pode remover o fundo com a Kie ou enviar outra.</p> : null}
              {removingBackgroundWithKie ? <p className="image-processing" role="status">A Kie está removendo o fundo. A foto original continua preservada.</p> : null}
              {kieError ? <p className="search-error" role="alert">{kieError}</p> : null}
            </>
          ) : null}

          <OfferControls draft={draft} errors={errors} onChange={updateDraft} />

          <div className="inline-review">
            <label className="check-row confirmation-row">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={!isValid}
              />
              <span className="check-control" aria-hidden="true" />
              <span>
                <strong>Conferi produto, apresentação e preços</strong>
                <small>Essa confirmação libera o arquivo final.</small>
              </span>
            </label>

            <div className="download-actions">
              <button
                className="button button-primary button-wide"
                type="button"
                onClick={() => void handleExport("png")}
                disabled={!isValid || !confirmed || Boolean(exportingFormat)}
              >
                <span>{exportingFormat === "png" ? "Validando e gerando PNG…" : `Baixar ${selectedPreviewFormat === "feed" ? "Feed" : "Story"} em PNG`}</span>
                <span aria-hidden="true">↓</span>
              </button>
              <button
                className="button button-secondary button-wide"
                type="button"
                onClick={() => void handleExport("pdf")}
                disabled={!isValid || !confirmed || Boolean(exportingFormat) || selectedPreviewFormat === "feed"}
              >
                <span>{exportingFormat === "pdf" ? "Validando e gerando PDF…" : "Baixar Story em PDF"}</span>
                <span aria-hidden="true">↓</span>
              </button>
            </div>
          </div>

          {exportError ? <p className="export-error" role="alert">{exportError}</p> : null}
          {exportSuccess ? (
            <div className="export-completion">
              <p className="export-success" role="status">Produto e foto validados no catálogo. O download foi iniciado.</p>
              <button className="button button-secondary new-offer-button" type="button" onClick={resetOffer}>Criar nova oferta</button>
            </div>
          ) : null}

          <div className="guardrail">
            <span className="guardrail-icon" aria-hidden="true">✓</span>
            <p>
              <strong>Composição protegida</strong>
              Produto, apresentação e preço permanecem associados durante a exportação.
            </p>
          </div>
        </section>

        <section className="preview-panel" aria-label={`Prévia do ${selectedPreviewFormat === "feed" ? "Feed" : "Story"}`}>
          <div className="preview-toolbar">
            <div>
              <span className="preview-kicker">Prévia ao vivo</span>
              <strong>{selectedPreviewFormat === "feed" ? "Feed" : "Story"}</strong>
            </div>
            <div className="preview-toolbar-actions">
              <div className="preview-format-selector" role="group" aria-label="Formato da prévia">
                <button
                  className="preview-format-option"
                  type="button"
                  aria-pressed={selectedPreviewFormat === "story"}
                  onClick={() => setSelectedPreviewFormat("story")}
                >
                  Story
                </button>
                <button
                  className="preview-format-option"
                  type="button"
                  aria-pressed={selectedPreviewFormat === "feed"}
                  onClick={() => setSelectedPreviewFormat("feed")}
                >
                  Feed
                </button>
              </div>
            </div>
          </div>
          <div className="preview-stage">
            <div className={`poster-frame ${selectedPreviewFormat === "feed" ? "poster-frame-feed" : "poster-frame-story"}`}>
              {selectedPreviewFormat === "feed" ? (
                <FeedPoster
                  ref={feedRef}
                  offer={offer}
                  productImageUrl={productImageUrl}
                  productImageGeometry={productImageGeometry}
                  productPlacement={feedProductPlacement}
                  onProductPlacementChange={setFeedProductPlacement}
                  onProductPlacementCommit={commitFeedProductPlacement}
                />
              ) : (
                <StoryPoster
                  ref={storyRef}
                  offer={offer}
                  productImageUrl={productImageUrl}
                  productImageGeometry={productImageGeometry}
                  productPlacement={storyProductPlacement}
                  onProductPlacementChange={setStoryProductPlacement}
                  onProductPlacementCommit={commitStoryProductPlacement}
                />
              )}
            </div>
          </div>
          <p className="preview-caption">
            O mesmo SVG desta prévia gera o PNG{selectedPreviewFormat === "story" ? " e o PDF do Story" : " do Feed"}.
          </p>
        </section>
      </main>
    </div>
  )
}
