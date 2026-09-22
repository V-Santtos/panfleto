import { forwardRef } from "react"

import { formatMoney, formatPresentation, type Offer } from "../domain/offer"
import {
  applyProductPlacement,
  AUTOMATIC_PRODUCT_PLACEMENT,
  type ProductPlacement,
} from "../domain/productPlacement"
import type { ProductImageGeometry } from "../images/cutout"
import {
  getStorySignLayout,
  positionStoryProduct,
  storyProductContactShadow,
  STORY_PRODUCT_STAGE,
  STORY_SIGN_STATES,
} from "../domain/storyLayout"
import { DraggableProduct } from "./DraggableProduct"

type StoryPosterProps = {
  offer: Offer
  productImageUrl?: string
  productImageGeometry?: ProductImageGeometry
  productPlacement?: ProductPlacement
  onProductPlacementChange?: (placement: ProductPlacement) => void
  onProductPlacementCommit?: (placement: ProductPlacement) => void
}

function priceParts(cents: number) {
  const whole = Math.floor(cents / 100).toLocaleString("pt-BR")
  const decimal = String(cents % 100).padStart(2, "0")
  return { whole, decimal }
}

export const StoryPoster = forwardRef<SVGSVGElement, StoryPosterProps>(
  function StoryPoster({
    offer,
    productImageUrl,
    productImageGeometry,
    productPlacement = AUTOMATIC_PRODUCT_PLACEMENT,
    onProductPlacementChange,
    onProductPlacementCommit,
  }, ref) {
    const { nameLines, nameLineFontSizes, state } = getStorySignLayout(offer.productName)
    const stateTokens = STORY_SIGN_STATES[state]
    const price = priceParts(offer.promotionalPriceCents)
    const digitCount = price.whole.replace(/\D/g, "").length
    const wholePriceSize =
      digitCount >= 5 ? 64 : digitCount === 4 ? 76 : digitCount === 3 ? 92 : digitCount === 2 ? 114 : 128
    const currencySize = digitCount >= 4 ? 28 : digitCount === 3 ? 32 : 38
    const centsSize = digitCount >= 4 ? 35 : digitCount === 3 ? 40 : 48
    const priceBaseline = offer.previousPriceCents !== undefined ? 1360 : 1348
    const productPosition = positionStoryProduct(productImageGeometry)
    const placedProductPosition = applyProductPlacement(productPosition, productPlacement)
    const shadowPosition = { ...productPosition, x: placedProductPosition.x }
    const productShadow = productImageUrl ? storyProductContactShadow(productImageGeometry, shadowPosition) : undefined

    return (
      <svg
        ref={ref}
        className="story-svg"
        viewBox="0 0 1080 1920"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="story-title story-description"
        data-testid="story-poster"
      >
        <title id="story-title">Story promocional de {offer.productName}</title>
        <desc id="story-description">
          Oferta de {formatPresentation(offer.quantity, offer.unit)} por {formatMoney(offer.promotionalPriceCents)}.
        </desc>
        <defs>
          <linearGradient id="offer-sign-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8f050d" />
            <stop offset="0.56" stopColor="#b80810" />
            <stop offset="1" stopColor="#9d050c" />
          </linearGradient>
          <clipPath id="story-plaque">
            {/* A placa é levemente inclinada: a borda direita vai de 474 no
                topo a 478 na base, e a esquerda de 121 a 123. Um retângulo
                deixaria entrar fundo nos cantos, e esse fundo pintaria por cima
                da embalagem parecendo um corte na foto. Daí o quadrilátero. */}
            <polygon points="119,946 475,946 479,1397 123,1397" />
            <rect x="298" y="1395" width="6" height="215" />
          </clipPath>
          <radialGradient id="story-product-contact-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#561308" stopOpacity="0.26" />
            <stop offset="0.55" stopColor="#561308" stopOpacity="0.12" />
            <stop offset="1" stopColor="#561308" stopOpacity="0" />
          </radialGradient>
        </defs>
        <image
          id="story-base-layer"
          href="/templates/story/single/story-base-empty.png"
          width="1080"
          height="1920"
          preserveAspectRatio="xMidYMid meet"
        />

        {productShadow ? (
          <ellipse
            cx={productShadow.cx}
            cy={productShadow.cy}
            rx={productShadow.rx}
            ry={productShadow.ry}
            fill="url(#story-product-contact-shadow)"
            aria-hidden="true"
            data-testid="story-contact-shadow"
          />
        ) : null}

        {productImageUrl ? (
          <DraggableProduct
            href={productImageUrl}
            position={productPosition}
            geometry={productImageGeometry}
            placement={productPlacement}
            stage={STORY_PRODUCT_STAGE}
            ariaLabel={`Imagem selecionada de ${offer.productName}`}
            imageTestId="story-product-image"
            hitAreaTestId="story-product-drag-handle"
            onPlacementChange={onProductPlacementChange}
            onPlacementCommit={onProductPlacementCommit}
          />
        ) : null}

        {/* A placa vive dentro do PNG de fundo, então não existe camada para
            desenhar na frente do produto. Redesenhar o próprio fundo recortado
            na placa devolve a hierarquia correta: a embalagem passa por trás.
            Os pixels são idênticos aos já pintados, então não há emenda. */}
        <use
          href="#story-base-layer"
          clipPath="url(#story-plaque)"
          aria-hidden="true"
          data-testid="story-plaque-overlay"
        />

        <path
          d="M145 972H453V1135L299 1200L145 1135Z"
          fill="url(#offer-sign-red)"
          aria-hidden="true"
        />

        <g aria-label="Dados da oferta" textAnchor="middle">
          <text
            x="299"
            y={stateTokens.nameY}
            fill="#ffe000"
            stroke="#88110c"
            strokeWidth="1.2"
            paintOrder="stroke fill"
            fontFamily="Komika Axis, Arial Black, sans-serif"
            fontSize={nameLineFontSizes[0]}
            fontWeight="400"
            letterSpacing="0.2"
          >
            {nameLines.map((line, index) => (
              <tspan
                key={`${line}-${index}`}
                x="299"
                dy={stateTokens.lineOffsets[index] ?? 0}
                fontSize={nameLineFontSizes[index]}
              >
                {line.toUpperCase()}
              </tspan>
            ))}
          </text>

          <text
            x={stateTokens.weight.x}
            y={stateTokens.weight.y}
            fill={stateTokens.weight.fill}
            stroke={stateTokens.weight.stroke}
            strokeWidth="1.2"
            paintOrder="stroke fill"
            fontFamily="Komika Axis, Arial Black, sans-serif"
            fontSize={stateTokens.weight.fontSize}
            fontWeight="400"
            letterSpacing="0.8"
            textAnchor={stateTokens.weight.textAnchor}
            data-testid="story-weight"
          >
            {formatPresentation(offer.quantity, offer.unit)}
          </text>

          {offer.previousPriceCents !== undefined ? (
            <text
              x="240"
              y="1236"
              fill="#6f1b13"
              fontFamily="Komika Axis, Arial Black, sans-serif"
              fontSize="27"
              fontWeight="400"
              textDecoration="line-through"
            >
              DE {formatMoney(offer.previousPriceCents)}
            </text>
          ) : null}

          <text
            x="299"
            y={priceBaseline}
            fill="#a3160d"
            stroke="#841009"
            strokeWidth="0.8"
            paintOrder="stroke fill"
            fontFamily="Komika Axis, Arial Black, sans-serif"
            fontWeight="400"
            textAnchor="middle"
            letterSpacing="-1.8"
          >
            <tspan fontSize={currencySize}>R$ </tspan>
            <tspan fontSize={wholePriceSize}>{price.whole}</tspan>
            <tspan fontSize={centsSize} dy={-Math.round(centsSize * 0.94)}>,{price.decimal}</tspan>
          </text>
        </g>
      </svg>
    )
  },
)
