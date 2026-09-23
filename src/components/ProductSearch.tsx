import { useCallback, useEffect, useRef, useState } from "react"
import { classifyCatalogSearch, isValidGtin } from "../domain/catalog"
import { qualifyCandidates, type ImageCandidate, type QualificationProgress, type QualifiedCandidate } from "../images/qualificationClient"
import { ManualProductForm } from "./ManualProductForm"

import {
  searchProductCandidates,
  type ProductCandidate,
  type ProductPhotoOption,
  type ProductSearchResult,
} from "../domain/productSearch"

type ProductSearchProps = {
  selectedCode?: string
  selectedLabel?: string
  selectedRegistrationMethod?: "gtin_lookup" | "manual"
  onSelect: (candidate: ProductCandidate) => void
  onClearSelection?: () => void
  resetVersion?: number
}

type CandidatePhoto = ProductPhotoOption

function photosFor(candidate: ProductCandidate): CandidatePhoto[] {
  if (candidate.photoOptions?.length) return candidate.photoOptions
  if (candidate.imageUrl && candidate.thumbnailUrl && candidate.url_original) {
    return [{
      id: candidate.origem === "cosmos" ? "cosmos" : "openfoodfacts",
      origem: candidate.origem,
      imageUrl: candidate.imageUrl,
      thumbnailUrl: candidate.thumbnailUrl,
      url_original: candidate.url_original,
      imageWidth: candidate.imageWidth,
      imageHeight: candidate.imageHeight,
    }]
  }
  return []
}

function sourceLabel(origin: CandidatePhoto["origem"]): string {
  if (origin === "cosmos") return "Cosmos"
  if (origin === "openfoodfacts") return "Open Food Facts"
  if (origin === "upload_usuario") return "Envio aprovado"
  if (origin === "gs1") return "GS1"
  return "Catálogo interno"
}

function rejectedPhotoMessage(candidate: QualifiedCandidate | undefined): string {
  if (!candidate) return "Verificando foto"
  const { reasons } = candidate.qualification
  if (reasons.includes("load")) return "Não carregou"
  if (reasons.includes("generic-illustration")) return "Imagem genérica"
  if (reasons.includes("resolution")) return "Resolução insuficiente"
  if (reasons.includes("framing")) return "Embalagem cortada ou mal enquadrada"
  if (reasons.includes("multiple")) return "Há mais de um objeto na foto"
  if (reasons.includes("photo-frame")) return "Parece uma foto dentro de outra foto"
  if (reasons.includes("background")) return "Fundo não aprovado"
  if (reasons.includes("blur")) return "Foto sem nitidez suficiente"
  return "Foto não aprovada"
}

function photoIsSelectable(candidate: QualifiedCandidate | undefined): candidate is QualifiedCandidate {
  if (!candidate) return false
  if (candidate.qualification.accepted) return true
  return candidate.origem === "cosmos" && !candidate.qualification.reasons.includes("load")
}

function approvedCatalogImages(candidates: ProductCandidate[]): QualifiedCandidate[] {
  return candidates.flatMap((candidate) => candidate.catalogImageId
    ? photosFor(candidate).map(({ id: _id, ...photo }) => ({
      ...candidate,
      ...photo,
      qualification: {
        accepted: true as const,
        background: "transparent" as const,
        score: 100,
        reasons: [],
        metrics: {
          borderMean: 0,
          borderDeviation: 0,
          transparentBorder: 1,
          whiteBorder: 0,
          occupancy: 1,
          silhouetteFill: 1,
          sharpness: 0,
        },
      },
    }))
    : [])
}

export function ProductSearch({ selectedCode, selectedLabel, selectedRegistrationMethod, onSelect, onClearSelection, resetVersion = 0 }: ProductSearchProps) {
  const selectedQuery = selectedCode && isValidGtin(selectedCode) ? selectedCode : selectedLabel ?? ""
  const [query, setQuery] = useState(selectedQuery)
  const [searchUnlocked, setSearchUnlocked] = useState(false)
  const [result, setResult] = useState<ProductSearchResult>()
  const [qualification, setQualification] = useState<QualificationProgress>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [manualOpen, setManualOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1)
  const activeSearch = useRef<AbortController | null>(null)
  const pendingSearchTimer = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedQuery = useRef(selectedQuery)
  const previousSelectedCode = useRef(selectedCode)
  const previousResetVersion = useRef(resetVersion)
  const candidates = result?.candidates ?? []
  const suggestionsOpen = candidates.length > 0 && !manualOpen
  const hasRegisteredSuggestion = candidates.some((candidate) => Boolean(candidate.catalogProductId && candidate.registrationMethod !== "manual"))
  const hasCommittedSelection = Boolean(committedQuery.current && query === committedQuery.current && !searchUnlocked)
  const evaluatedByOriginalUrl = new Map((qualification?.evaluations ?? []).map((candidate) => [candidate.url_original, candidate]))

  useEffect(() => () => {
    if (pendingSearchTimer.current !== undefined) window.clearTimeout(pendingSearchTimer.current)
    activeSearch.current?.abort()
    activeSearch.current = null
  }, [])

  useEffect(() => {
    if (previousSelectedCode.current === selectedCode) return
    previousSelectedCode.current = selectedCode
    if (!selectedCode) return
    committedQuery.current = selectedQuery
    setQuery(selectedQuery)
    setSearchUnlocked(false)
  }, [selectedCode, selectedQuery])

  const updateQuery = (value: string) => {
    if (committedQuery.current && value !== committedQuery.current) {
      committedQuery.current = ""
    }
    if (pendingSearchTimer.current !== undefined) {
      window.clearTimeout(pendingSearchTimer.current)
      pendingSearchTimer.current = undefined
    }
    activeSearch.current?.abort()
    activeSearch.current = null
    setQuery(value)
    setLoading(false)
    setResult(undefined)
    setQualification(undefined)
    setActiveOptionIndex(-1)
    setError("")
  }

  const executeSearch = useCallback(async (searchQuery: string) => {
    activeSearch.current?.abort()
    const controller = new AbortController()
    activeSearch.current = controller
    setLoading(true)
    setError("")
    setResult(undefined)
    setQualification(undefined)
    try {
      const nextResult = await searchProductCandidates(searchQuery, { signal: controller.signal })
      if (activeSearch.current !== controller || controller.signal.aborted) return
      setResult(nextResult)
      setActiveOptionIndex(-1)
      const persistedCandidates = approvedCatalogImages(nextResult.candidates)
      const imageCandidates: ImageCandidate[] = nextResult.candidates.filter((candidate) => !candidate.catalogImageId).flatMap((candidate) => photosFor(candidate).map(({ id: _id, ...photo }) => ({
        ...candidate,
        ...photo,
      })))
      setQualification({
        candidates: persistedCandidates,
        evaluations: persistedCandidates,
        evaluatedCount: persistedCandidates.length,
        totalCount: persistedCandidates.length + imageCandidates.length,
        approvedCount: persistedCandidates.length,
      })
      await qualifyCandidates(imageCandidates, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (activeSearch.current === controller && !controller.signal.aborted) setQualification({
            candidates: [...persistedCandidates, ...progress.candidates],
            evaluations: [...persistedCandidates, ...progress.evaluations],
            evaluatedCount: persistedCandidates.length + progress.evaluatedCount,
            totalCount: persistedCandidates.length + progress.totalCount,
            approvedCount: persistedCandidates.length + progress.approvedCount,
          })
        },
      })
    } catch (searchError) {
      if (activeSearch.current !== controller || controller.signal.aborted) return
      setError(searchError instanceof Error ? searchError.message : "Não foi possível pesquisar.")
    } finally {
      if (activeSearch.current === controller) {
        activeSearch.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (manualOpen) return
    if (committedQuery.current && query === committedQuery.current) return
    const classified = classifyCatalogSearch(query)
    if (classified.kind !== "registered_name" || classified.query.length < 2) return
    pendingSearchTimer.current = window.setTimeout(() => {
      pendingSearchTimer.current = undefined
      void executeSearch(classified.query)
    }, 300)
    return () => {
      if (pendingSearchTimer.current !== undefined) {
        window.clearTimeout(pendingSearchTimer.current)
        pendingSearchTimer.current = undefined
      }
    }
  }, [executeSearch, manualOpen, query])

  useEffect(() => {
    if (previousResetVersion.current === resetVersion) return
    previousResetVersion.current = resetVersion
    if (pendingSearchTimer.current !== undefined) {
      window.clearTimeout(pendingSearchTimer.current)
      pendingSearchTimer.current = undefined
    }
    activeSearch.current?.abort()
    activeSearch.current = null
    setQuery("")
    setResult(undefined)
    setQualification(undefined)
    setLoading(false)
    setError("")
    setManualOpen(false)
    setActiveOptionIndex(-1)
    committedQuery.current = ""
    setSearchUnlocked(false)
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" })
      inputRef.current?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(focusTimer)
  }, [resetVersion])

  const handleSearch = () => {
    if (manualOpen || hasCommittedSelection) return
    if (pendingSearchTimer.current !== undefined) {
      window.clearTimeout(pendingSearchTimer.current)
      pendingSearchTimer.current = undefined
    }
    void executeSearch(query)
  }

  const unlockSearch = () => {
    onClearSelection?.()
    updateQuery("")
    setSearchUnlocked(true)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const updateManualOpen = (open: boolean) => {
    if (open && query.trim()) return
    if (pendingSearchTimer.current !== undefined) {
      window.clearTimeout(pendingSearchTimer.current)
      pendingSearchTimer.current = undefined
    }
    activeSearch.current?.abort()
    activeSearch.current = null
    setLoading(false)
    setResult(undefined)
    setQualification(undefined)
    setActiveOptionIndex(-1)
    setError("")
    setManualOpen(open)
  }

  const candidateForSelection = (candidate: ProductCandidate, selectedPhoto?: CandidatePhoto): ProductCandidate => {
    const photos = photosFor(candidate)
    const photo = selectedPhoto ?? photos.find((item) => photoIsSelectable(evaluatedByOriginalUrl.get(item.url_original)))
    const evaluated = photo ? evaluatedByOriginalUrl.get(photo.url_original) : undefined
    return photoIsSelectable(evaluated)
      ? { ...candidate, ...evaluated, origem: photo!.origem, photoOptions: candidate.photoOptions }
      : { ...candidate, origem: photo?.origem ?? candidate.origem, imageUrl: undefined, thumbnailUrl: undefined, url_original: undefined, photoOptions: candidate.photoOptions }
  }

  const commitSelection = (candidate: ProductCandidate, selectedPhoto?: CandidatePhoto) => {
    if (pendingSearchTimer.current !== undefined) {
      window.clearTimeout(pendingSearchTimer.current)
      pendingSearchTimer.current = undefined
    }
    activeSearch.current?.abort()
    activeSearch.current = null
    const selected = candidateForSelection(candidate, selectedPhoto)
    const lockedQuery = isValidGtin(selected.code) ? selected.code : selected.productName
    committedQuery.current = lockedQuery
    setQuery(lockedQuery)
    setSearchUnlocked(false)
    setResult(undefined)
    setQualification(undefined)
    setActiveOptionIndex(-1)
    setLoading(false)
    setError("")
    setManualOpen(false)
    onSelect(selected)
  }

  const clearSuggestions = () => {
    setResult(undefined)
    setQualification(undefined)
    setActiveOptionIndex(-1)
    setError("")
  }

  return (
    <section className="product-search" aria-labelledby="product-search-title">
      <div className="product-search-heading">
        <div>
          <span className="product-lockup-label">Produto da oferta</span>
          <strong id="product-search-title">Pesquisar embalagem</strong>
        </div>
      </div>

      <div className="search-row">
        <div className={`search-combobox${suggestionsOpen ? " is-open" : ""}${hasRegisteredSuggestion ? " has-registered-suggestion" : ""}${hasCommittedSelection ? " has-selection" : ""}${hasCommittedSelection && selectedRegistrationMethod === "manual" ? " is-manual-selection" : ""}`}>
          <input
            ref={inputRef}
            className="input"
            role="combobox"
            aria-label="Pesquisar produto por nome ou GTIN/EAN"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen}
            aria-controls="product-search-suggestions"
            aria-activedescendant={suggestionsOpen && activeOptionIndex >= 0 ? `product-suggestion-${activeOptionIndex}` : undefined}
            value={query}
            readOnly={hasCommittedSelection}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={(event) => {
              if (hasCommittedSelection) return
              if (event.key === "ArrowDown" && candidates.length) {
                event.preventDefault()
                setActiveOptionIndex((current) => Math.min(current + 1, candidates.length - 1))
                return
              }
              if (event.key === "ArrowUp" && candidates.length) {
                event.preventDefault()
                setActiveOptionIndex((current) => Math.max(current - 1, 0))
                return
              }
              if (event.key === "Escape" && suggestionsOpen) {
                event.preventDefault()
                clearSuggestions()
                return
              }
              if (event.key === "Enter") {
                event.preventDefault()
                if (suggestionsOpen) {
                  commitSelection(candidates[Math.max(activeOptionIndex, 0)])
                } else {
                  void handleSearch()
                }
              }
            }}
            placeholder="Produto já cadastrado ou EAN/GTIN"
            autoComplete="off"
            disabled={manualOpen}
            maxLength={160}
            aria-describedby="product-search-help"
          />
          {suggestionsOpen ? (
            <div className="product-results" id="product-search-suggestions" role="listbox" aria-label="Sugestões de produtos cadastrados">
              <span className="visually-hidden" role="status">{`${candidates.length} produtos encontrados`}</span>
              {candidates.map((candidate, index) => {
                const photos = photosFor(candidate)
                const qualifiedPhotos = photos.map((photo) => {
                  const evaluated = evaluatedByOriginalUrl.get(photo.url_original)
                  return { photo, evaluated, selectable: photoIsSelectable(evaluated) ? evaluated : undefined }
                })
                const defaultPhoto = qualifiedPhotos.find(({ selectable }) => selectable)
                const photoStatus = defaultPhoto?.selectable
                  ? defaultPhoto.photo.origem === "cosmos"
                    ? "Foto do Cosmos disponível"
                    : defaultPhoto.selectable.qualification.background === "transparent" ? "Foto transparente" : "Foto em fundo branco"
                  : "Sem foto aprovada"
                const manualRegistration = candidate.registrationMethod === "manual"
                return <article
                  className={`product-result${manualRegistration ? " is-manual" : candidate.catalogProductId ? " is-registered" : ""}${activeOptionIndex === index ? " is-highlighted" : ""}`}
                  key={candidate.code}
                >
                  <button
                    className="product-result-main"
                    id={`product-suggestion-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeOptionIndex === index}
                    onFocus={() => setActiveOptionIndex(index)}
                    onMouseEnter={() => setActiveOptionIndex(index)}
                    onClick={() => commitSelection(candidate)}
                    title={`${candidate.productName} — ${candidate.brands.join(", ")} — ${candidate.quantity}`}
                  >
                    {defaultPhoto?.selectable ? <img src={defaultPhoto.selectable.thumbnailUrl} alt="" loading="lazy" /> : <span className="product-image-placeholder" aria-hidden="true">Sem foto</span>}
                    <span className="result-copy">
                      <span className={`result-index${manualRegistration ? " is-manual" : candidate.catalogProductId ? " is-registered" : ""}`}>
                        {candidate.catalogProductId ? <span className={`search-status-dot ${manualRegistration ? "search-status-dot-manual" : "search-status-dot-registered"}`} aria-hidden="true" /> : null}
                        {manualRegistration ? "Cadastro manual" : candidate.catalogProductId ? "Já cadastrado" : photoStatus}
                      </span>
                      <strong>{candidate.productName}</strong>
                      <small>{[candidate.brands.join(", "), candidate.quantity, candidate.code ? `GTIN/EAN ${candidate.code}` : ""].filter(Boolean).join(" · ")}</small>
                      {!defaultPhoto?.selectable
                        ? <small>Selecione e envie a embalagem manualmente.</small>
                        : defaultPhoto.photo.origem === "cosmos" && !defaultPhoto.selectable.qualification.accepted
                          ? <small>Qualidade a conferir · use a Kie se precisar remover o fundo</small>
                          : defaultPhoto.selectable.qualification.lowResolution ? <small>Foto pequena · pode perder definição no cartaz</small> : null}
                    </span>
                  </button>
                  {photos.length > 1 || qualifiedPhotos.some(({ evaluated, selectable }) => evaluated && (!selectable || evaluated.qualification.reasons.length > 0)) ? (
                    <div className="photo-options" aria-label={`Fotos disponíveis para ${candidate.productName}`}>
                      {qualifiedPhotos.map(({ photo, evaluated, selectable }) => (
                        <button
                          className={`photo-option${selectable ? " is-approved" : ""}`}
                          type="button"
                          key={photo.id}
                          onClick={() => selectable ? commitSelection(candidate, photo) : undefined}
                          aria-label={selectable ? `Usar foto do ${sourceLabel(photo.origem)}` : `Foto do ${sourceLabel(photo.origem)} não aprovada`}
                          title={selectable ? `Usar foto do ${sourceLabel(photo.origem)}` : rejectedPhotoMessage(evaluated)}
                          disabled={!selectable}
                        >
                          {selectable ? <img src={selectable.thumbnailUrl} alt="" loading="lazy" /> : <span className="photo-option-unavailable">{rejectedPhotoMessage(evaluated)}</span>}
                          <span>{sourceLabel(photo.origem)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              })}
            </div>
          ) : null}
        </div>
        <button className="button button-primary" type="button" onClick={hasCommittedSelection ? unlockSearch : handleSearch} disabled={loading || manualOpen}>
          {hasCommittedSelection ? "Alterar busca" : loading ? result ? "Verificando fotos…" : "Buscando…" : "Buscar"}
        </button>
      </div>

      <p className="search-summary" id="product-search-help">
        {hasCommittedSelection
          ? "Produto escolhido. Alterar busca limpa a seleção e a foto atual para pesquisar outro produto."
          : "Nome e marca pesquisam somente produtos já validados. Produto novo entra por EAN/GTIN exato ou cadastro manual."}
      </p>
      <ul className="search-status-legend" aria-label="Estados futuros dos produtos">
        <li>
          <span className="search-status-dot search-status-dot-registered" aria-hidden="true" />
          <span><strong>Já cadastrado</strong> nome ou marca consulta somente o catálogo próprio.</span>
        </li>
        <li>
          <span className="search-status-dot search-status-dot-default" aria-hidden="true" />
          <span><strong>Novo por EAN/GTIN</strong> consulta exata no catálogo próprio e, se ausente, nas fontes externas.</span>
        </li>
        <li>
          <span className="search-status-dot search-status-dot-manual" aria-hidden="true" />
          <span><strong>Cadastro manual</strong> exige uma foto da embalagem.</span>
        </li>
      </ul>
      <ManualProductForm
        key={resetVersion}
        open={manualOpen}
        disabled={Boolean(query.trim())}
        disabledDescriptionId="manual-product-disabled-help"
        onOpenChange={updateManualOpen}
        onCreated={commitSelection}
      />
      {query.trim() ? <p className="field-hint" id="manual-product-disabled-help">Limpe a pesquisa para cadastrar manualmente.</p> : null}
      {error ? <p className="search-error" role="alert">{error}</p> : null}
      {result && candidates.length === 0 ? (
        <p className="search-summary" role="status">
          {`${candidates.length} produtos encontrados`}
          {!loading && candidates.length === 0 && !error ? ". Use outro produto já cadastrado, um EAN/GTIN exato ou o cadastro manual." : ""}
        </p>
      ) : null}
      {(result?.sourceWarnings ?? []).map((warning) => (
        <p className="search-warning" key={`${warning.source}:${warning.kind}`} role="status">
          {warning.message}
        </p>
      ))}

    </section>
  )
}
