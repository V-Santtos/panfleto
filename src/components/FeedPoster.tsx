import { forwardRef } from "react"

import { formatMoney, formatPresentation, type Offer } from "../domain/offer"
import {
  applyProductPlacement,
  AUTOMATIC_PRODUCT_PLACEMENT,
  type ProductPlacement,
} from "../domain/productPlacement"
import {
  FEED_PRODUCT_STAGE,
  FEED_SIGN_STATES,
  feedProductContactShadow,
  getFeedSignLayout,
  positionFeedProduct,
} from "../domain/feedLayout"
import type { ProductImageGeometry } from "../images/cutout"
import { DraggableProduct } from "./DraggableProduct"

type FeedPosterProps = {
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

export const FeedPoster = forwardRef<SVGSVGElement, FeedPosterProps>(
  function FeedPoster({
    offer,
    productImageUrl,
    productImageGeometry,
    productPlacement = AUTOMATIC_PRODUCT_PLACEMENT,
    onProductPlacementChange,
    onProductPlacementCommit,
  }, ref) {
    const { nameLines, nameLineFontSizes, state } = getFeedSignLayout(offer.productName)
    const stateTokens = FEED_SIGN_STATES[state]
    const price = priceParts(offer.promotionalPriceCents)
    const digitCount = price.whole.replace(/\D/g, "").length
    // Feed follows the Story typography scaled by the plate-width ratio (226 / 308).
    const wholePriceSize =
      digitCount >= 5 ? 47 : digitCount === 4 ? 56 : digitCount === 3 ? 68 : digitCount === 2 ? 84 : 94
    const currencySize = digitCount >= 4 ? 21 : digitCount === 3 ? 23 : 28
    const centsSize = digitCount >= 4 ? 26 : digitCount === 3 ? 29 : 35
    const productPosition = positionFeedProduct(productImageGeometry)
    const placedProductPosition = applyProductPlacement(productPosition, productPlacement)
    // A sombra acompanha o deslocamento horizontal, mas continua apoiada no
    // pedestal: elevar a embalagem afasta a sombra, em vez de fazê-la flutuar.
    const shadowPosition = { ...productPosition, x: placedProductPosition.x }
    const productShadow = productImageUrl ? feedProductContactShadow(productImageGeometry, shadowPosition) : undefined

    return (
      <svg
        ref={ref}
        className="feed-svg"
        viewBox="0 0 1080 1350"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="feed-title feed-description"
        data-testid="feed-poster"
      >
        <title id="feed-title">Feed promocional de {offer.productName}</title>
        <desc id="feed-description">
          Oferta de {formatPresentation(offer.quantity, offer.unit)} por {formatMoney(offer.promotionalPriceCents)}.
        </desc>
        <defs>
          <linearGradient id="feed-sign-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a50b0d" />
            <stop offset="0.6" stopColor="#8e080b" />
            <stop offset="1" stopColor="#72080a" />
          </linearGradient>
          <clipPath id="feed-plaque">
            {/* Placa medida no PNG de fundo: x 186..436, y 650..970, com o
                mastro em x 306..315 descendo até o pedestal. O recorte encosta
                exatamente na borda da placa: um pixel a mais pintaria fundo por
                cima da embalagem e pareceria um corte na foto. */}
            <rect x="186" y="650" width="252" height="321" />
            <rect x="306" y="970" width="10" height="200" />
          </clipPath>
          <clipPath id="feed-sign-inner">
            {/* Abertura interna da placa, medida no PNG de fundo: as laterais
                ficam em x=203,5 e x=417,5, e a placa é levemente inclinada — o
                topo desce de 665,5 na esquerda para 667,5 na direita, e a base
                de 954,5 para 956,5. A extensão vermelha nasce dentro dessa
                abertura e ainda é recortada por ela, porque um retângulo reto
                pintaria por cima da moldura prateada nas laterais e nos ombros
                do triângulo — a moldura tem que ficar sempre por fora. */}
            <polygon points="204,666 417,668 417,955 204,953" />
          </clipPath>
          <radialGradient id="feed-product-contact-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#62130a" stopOpacity="0.28" />
            <stop offset="0.55" stopColor="#62130a" stopOpacity="0.12" />
            <stop offset="1" stopColor="#62130a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <image
          id="feed-base-layer"
          href="/templates/feed/single/feed-base-empty.png"
          width="1080"
          height="1350"
          preserveAspectRatio="xMidYMid meet"
        />

        {productShadow ? (
          <ellipse
            cx={productShadow.cx}
            cy={productShadow.cy}
            rx={productShadow.rx}
            ry={productShadow.ry}
            fill="url(#feed-product-contact-shadow)"
            aria-hidden="true"
            data-testid="feed-contact-shadow"
          />
        ) : null}

        {productImageUrl ? (
          <DraggableProduct
            href={productImageUrl}
            position={productPosition}
            geometry={productImageGeometry}
            placement={productPlacement}
            stage={FEED_PRODUCT_STAGE}
            ariaLabel={`Imagem selecionada de ${offer.productName}`}
            imageTestId="feed-product-image"
            hitAreaTestId="feed-product-drag-handle"
            onPlacementChange={onProductPlacementChange}
            onPlacementCommit={onProductPlacementCommit}
          />
        ) : null}

        {/* Como no Story, a placa mora dentro do PNG de fundo. Redesenhá-la
            recortada depois do produto devolve a hierarquia: a embalagem passa
            por trás da placa e da ponta vermelha, nunca por cima. */}
        <use
          href="#feed-base-layer"
          clipPath="url(#feed-plaque)"
          aria-hidden="true"
          data-testid="feed-plaque-overlay"
        />

        <path
          d="M204 666H417V778L311 834L204 778Z"
          clipPath="url(#feed-sign-inner)"
          fill="url(#feed-sign-red)"
          aria-hidden="true"
          data-testid="feed-sign-extension"
        />

        <g aria-label="Dados da oferta" textAnchor="middle">
          <text
            x="311"
            y={stateTokens.nameY}
            fill="#ffe229"
            stroke="#8c1110"
            strokeWidth="0.9"
            paintOrder="stroke fill"
            fontFamily="Komika Axis, Arial Black, sans-serif"
            fontSize={nameLineFontSizes[0]}
            fontWeight="400"
            letterSpacing="0.15"
            data-testid="feed-name"
          >
            {nameLines.map((line, index) => (
              <tspan
                key={`${line}-${index}`}
                x="311"
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
            strokeWidth="0.8"
            paintOrder="stroke fill"
            fontFamily="Komika Axis, Arial Black, sans-serif"
            fontSize={stateTokens.weight.fontSize}
            fontWeight="400"
            letterSpacing="0.6"
            textAnchor={stateTokens.weight.textAnchor}
            data-testid="feed-weight"
          >
            {formatPresentation(offer.quantity, offer.unit)}
          </text>

          {offer.previousPriceCents !== undefined ? (
            <text
              x="277"
              y="856"
              fill="#78120e"
              fontFamily="Komika Axis, Arial Black, sans-serif"
              fontSize="19"
              fontWeight="400"
              textDecoration="line-through"
              data-testid="feed-previous-price"
            >
              DE {formatMoney(offer.previousPriceCents)}
            </text>
          ) : null}

          <text
            x="311"
            y={offer.previousPriceCents !== undefined ? "943" : "941"}
            fill="#a3150c"
            stroke="#7d1009"
            strokeWidth="0.65"
            paintOrder="stroke fill"
            fontFamily="Komika Axis, Arial Black, sans-serif"
            fontWeight="400"
            letterSpacing="-1.4"
            data-testid="feed-price"
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
