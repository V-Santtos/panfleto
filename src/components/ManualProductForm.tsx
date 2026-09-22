import { useState, type FormEvent } from "react"

import { createDraftProduct } from "../api/catalogClient"
import { PRESENTATION_UNITS, PRESENTATION_UNIT_LABELS, type PresentationUnit } from "../domain/offer"
import { productCandidateFromCatalog, type ProductCandidate } from "../domain/productSearch"

type ManualProductFormProps = {
  onCreated: (candidate: ProductCandidate) => void
  open: boolean
  disabled?: boolean
  disabledDescriptionId?: string
  onOpenChange: (open: boolean) => void
}

export function ManualProductForm({ onCreated, open, disabled = false, disabledDescriptionId, onOpenChange }: ManualProductFormProps) {
  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [gtin, setGtin] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unit, setUnit] = useState<PresentationUnit>("unidade")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const parsedQuantity = Number(quantity.replace(",", "."))
    if (!name.trim()) { setError("Informe o nome do produto."); return }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) { setError("Informe uma quantidade maior que zero."); return }
    setSaving(true)
    setError("")
    try {
      const product = await createDraftProduct({
        ...(gtin.trim() ? { gtin: gtin.trim().replace(/[\s-]/g, "") } : {}),
        canonicalName: name.trim(),
        displayName: name.trim(),
        ...(brand.trim() ? { brandName: brand.trim() } : {}),
        defaultQuantity: parsedQuantity,
        defaultUnit: unit,
        registrationMethod: "manual",
        metadataOrigin: "manual",
      })
      onCreated(productCandidateFromCatalog(product))
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível criar o rascunho.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return <button
      className="button button-secondary manual-product-toggle"
      type="button"
      onClick={() => onOpenChange(true)}
      disabled={disabled}
      aria-describedby={disabled ? disabledDescriptionId : undefined}
    >
      Abrir cadastro manual
    </button>
  }

  return (
    <form className="manual-product-form" onSubmit={(event) => void submit(event)}>
      <div className="manual-product-form-heading">
        <strong>Novo produto manual</strong>
        <button className="button button-ghost" type="button" onClick={() => { onOpenChange(false); setError("") }} disabled={saving}>Fechar</button>
      </div>
      <label className="field">
        <span className="field-label">Nome do produto</span>
        <input className="input" aria-label="Nome do produto manual" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} />
      </label>
      <label className="field">
        <span className="field-label">Marca (opcional)</span>
        <input className="input" aria-label="Marca do produto manual" value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={120} />
      </label>
      <label className="field">
        <span className="field-label">EAN/GTIN (opcional)</span>
        <input className="input" inputMode="numeric" aria-label="GTIN do produto manual" value={gtin} onChange={(event) => setGtin(event.target.value)} maxLength={20} />
      </label>
      <div className="presentation-inputs">
        <label className="field">
          <span className="field-label">Quantidade</span>
          <input className="input presentation-quantity" inputMode="decimal" aria-label="Quantidade do produto manual" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Unidade</span>
          <select className="input" aria-label="Unidade do produto manual" value={unit} onChange={(event) => setUnit(event.target.value as PresentationUnit)}>
            {PRESENTATION_UNITS.map((value) => <option key={value} value={value}>{PRESENTATION_UNIT_LABELS[value]}</option>)}
          </select>
        </label>
      </div>
      <p className="field-hint">O rascunho só ficará pesquisável por nome depois da embalagem ser revisada e aprovada.</p>
      {error ? <p className="search-error" role="alert">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Criando…" : "Criar rascunho"}</button>
    </form>
  )
}
