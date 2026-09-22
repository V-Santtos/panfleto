import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import { PRESENTATION_UNIT_LABELS, PRESENTATION_UNITS, type OfferDraft, type OfferErrors, type OfferField } from "../domain/offer"

type OfferControlsProps = {
  draft: OfferDraft
  errors: OfferErrors
  onChange: <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) => void
}

type FieldProps = {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

type UnitSelectorProps = {
  value: OfferDraft["unit"]
  onChange: (unit: OfferDraft["unit"]) => void
}

function UnitSelector({ value, onChange }: UnitSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionsId = useId()

  useEffect(() => {
    const closeWhenClickingOutside = (event: MouseEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", closeWhenClickingOutside)
    return () => document.removeEventListener("mousedown", closeWhenClickingOutside)
  }, [])

  const chooseUnit = (unit: OfferDraft["unit"]) => {
    onChange(unit)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="unit-selector" ref={selectorRef}>
      <button
        ref={triggerRef}
        className="input unit-trigger"
        type="button"
        aria-label="Unidade da apresentação"
        aria-expanded={isOpen}
        aria-controls={optionsId}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false)
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setIsOpen(true)
          }
        }}
      >
        <span>{PRESENTATION_UNIT_LABELS[value]}</span>
        <svg className="unit-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div className="unit-options" id={optionsId} role="listbox" aria-label="Unidade da apresentação">
          {PRESENTATION_UNITS.map((unit) => (
            <button
              key={unit}
              className="unit-option"
              type="button"
              role="option"
              aria-selected={unit === value}
              onClick={() => chooseUnit(unit)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault()
                  setIsOpen(false)
                  triggerRef.current?.focus()
                }
              }}
            >
              {PRESENTATION_UNIT_LABELS[unit]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function OfferControls({ draft, errors, onChange }: OfferControlsProps) {
  const update = <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) => {
    onChange(key, value)
  }

  const errorFor = (field: OfferField) => errors[field]

  return (
    <form className="offer-form inline-offer-form" onSubmit={(event) => event.preventDefault()} noValidate>
      <Field
        label="Nome no cartaz"
        hint="Até 3 linhas. Palavras longas reduzem a fonte para permanecerem inteiras."
        error={errorFor("productName")}
      >
        <input
          className="input"
          aria-label="Nome no cartaz"
          value={draft.productName}
          onChange={(event) => update("productName", event.target.value)}
          aria-invalid={Boolean(errors.productName)}
          autoComplete="off"
        />
      </Field>

      <div className="field-grid">
        <Field label="Peso, volume ou unidade" error={errorFor("quantity")}>
          <div className="presentation-inputs">
            <input
              className="input presentation-quantity"
              aria-label="Quantidade"
              type="text"
              min="1"
              max="9999"
              inputMode="decimal"
              value={draft.quantity}
              onChange={(event) => update("quantity", event.target.value)}
              aria-invalid={Boolean(errors.quantity)}
            />
            <UnitSelector value={draft.unit} onChange={(unit) => update("unit", unit)} />
          </div>
        </Field>

        <Field label="Preço promocional" error={errorFor("promotionalPrice")}>
          <div className="input-affix input-affix-prefix">
            <span>R$</span>
            <input
              className="input input-with-prefix"
              aria-label="Preço promocional"
              inputMode="decimal"
              value={draft.promotionalPrice}
              onChange={(event) => update("promotionalPrice", event.target.value)}
              aria-invalid={Boolean(errors.promotionalPrice)}
              placeholder="12,99"
            />
          </div>
        </Field>
      </div>

      <div className="optional-price">
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.hasPreviousPrice}
            onChange={(event) => update("hasPreviousPrice", event.target.checked)}
          />
          <span className="check-control" aria-hidden="true" />
          <span>
            <strong>Exibir preço cheio riscado</strong>
            <small>Ative somente quando houver uma comparação real.</small>
          </span>
        </label>

        {draft.hasPreviousPrice ? (
          <Field label="Preço cheio" error={errorFor("previousPrice")}>
            <div className="input-affix input-affix-prefix">
              <span>R$</span>
              <input
                className="input input-with-prefix"
                aria-label="Preço cheio"
                inputMode="decimal"
                value={draft.previousPrice}
                onChange={(event) => update("previousPrice", event.target.value)}
                aria-invalid={Boolean(errors.previousPrice)}
                placeholder="15,99"
              />
            </div>
          </Field>
        ) : null}
      </div>
    </form>
  )
}
