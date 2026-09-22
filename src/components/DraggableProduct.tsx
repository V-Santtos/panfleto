import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import {
  applyProductPlacement,
  clampProductPlacement,
  type ProductPlacement,
  type ProductPosition,
  type ProductStageBounds,
} from "../domain/productPlacement"
import type { ProductImageGeometry } from "../images/cutout"

const DRAG_THRESHOLD_PX = 3

type DragSession = {
  pointerId: number
  startClientX: number
  startClientY: number
  startSvgX: number
  startSvgY: number
  startPlacement: ProductPlacement
  latestPlacement: ProductPlacement
  dragging: boolean
}

type DraggableProductProps = {
  href: string
  position: ProductPosition & { width: number; height: number }
  geometry?: ProductImageGeometry
  placement: ProductPlacement
  stage: ProductStageBounds
  ariaLabel: string
  imageTestId?: string
  hitAreaTestId?: string
  onPlacementChange?: (placement: ProductPlacement) => void
  onPlacementCommit?: (placement: ProductPlacement) => void
}

function pointInSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | undefined {
  const matrix = svg.getScreenCTM()
  if (!matrix) return
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  return point.matrixTransform(matrix.inverse())
}

function clampUnmeasuredPlacement(
  svg: SVGSVGElement,
  position: ProductPosition & { width: number; height: number },
  intendedPlacement: ProductPlacement,
  stage: ProductStageBounds,
): ProductPlacement {
  const nativeViewBox = svg.viewBox?.baseVal
  const attributeViewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number)
  const [viewX, viewY, viewWidth, viewHeight] = nativeViewBox?.width && nativeViewBox?.height
    ? [nativeViewBox.x, nativeViewBox.y, nativeViewBox.width, nativeViewBox.height]
    : attributeViewBox?.length === 4
      ? attributeViewBox
      : [0, 0, 0, 0]

  if (![viewX, viewY, viewWidth, viewHeight].every(Number.isFinite) || viewWidth <= 0 || viewHeight <= 0) {
    return intendedPlacement
  }

  const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
  const verticalRange = stage.unmeasuredImageTopRange
  return {
    offsetX: clamp(intendedPlacement.offsetX, viewX - position.x, viewX + viewWidth - position.x - position.width),
    offsetY: verticalRange
      ? clamp(intendedPlacement.offsetY, verticalRange.minimum - position.y, verticalRange.maximum - position.y)
      : clamp(intendedPlacement.offsetY, viewY - position.y, viewY + viewHeight - position.y - position.height),
  }
}

export function DraggableProduct({
  href,
  position,
  geometry,
  placement,
  stage,
  ariaLabel,
  imageTestId,
  hitAreaTestId,
  onPlacementChange,
  onPlacementCommit,
}: DraggableProductProps) {
  const session = useRef<DragSession | undefined>(undefined)
  const pendingPlacement = useRef<ProductPlacement | undefined>(undefined)
  const animationFrame = useRef<number | undefined>(undefined)
  const [isDragging, setIsDragging] = useState(false)
  const placedPosition = applyProductPlacement(position, placement)
  const visible = geometry?.visibleBounds
  const canDrag = Boolean(onPlacementChange && onPlacementCommit)
  const hitArea = visible
    ? {
        x: placedPosition.x + visible.left * placedPosition.scale,
        y: placedPosition.y + visible.top * placedPosition.scale,
        width: visible.width * placedPosition.scale,
        height: visible.height * placedPosition.scale,
      }
    : {
        x: placedPosition.x,
        y: placedPosition.y,
        width: placedPosition.width,
        height: placedPosition.height,
      }

  useEffect(() => () => {
    if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
  }, [])

  const flushPreview = () => {
    if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
    animationFrame.current = undefined
    const next = pendingPlacement.current
    pendingPlacement.current = undefined
    if (next) onPlacementChange?.(next)
  }

  const schedulePreview = (next: ProductPlacement) => {
    pendingPlacement.current = next
    if (animationFrame.current !== undefined) return
    animationFrame.current = requestAnimationFrame(() => {
      animationFrame.current = undefined
      const current = pendingPlacement.current
      pendingPlacement.current = undefined
      if (current) onPlacementChange?.(current)
    })
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg || !canDrag || event.button !== 0) return
    const start = pointInSvg(svg, event.clientX, event.clientY)
    if (!start) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    session.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startSvgX: start.x,
      startSvgY: start.y,
      startPlacement: placement,
      latestPlacement: placement,
      dragging: false,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const current = session.current
    const svg = event.currentTarget.ownerSVGElement
    if (!current || current.pointerId !== event.pointerId || !svg) return
    const screenDistance = Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY)
    if (!current.dragging && screenDistance < DRAG_THRESHOLD_PX) return
    if (!current.dragging) {
      current.dragging = true
      setIsDragging(true)
    }
    const nextPoint = pointInSvg(svg, event.clientX, event.clientY)
    if (!nextPoint) return
    const intendedPlacement = {
      offsetX: current.startPlacement.offsetX + nextPoint.x - current.startSvgX,
      offsetY: current.startPlacement.offsetY + nextPoint.y - current.startSvgY,
    }
    const next = geometry
      ? clampProductPlacement(geometry, position, intendedPlacement, stage)
      : clampUnmeasuredPlacement(svg, position, intendedPlacement, stage)
    current.latestPlacement = next
    schedulePreview(next)
  }

  const finishPointer = (event: ReactPointerEvent<SVGRectElement>) => {
    const current = session.current
    if (!current || current.pointerId !== event.pointerId) return
    session.current = undefined
    flushPreview()
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (current.dragging) onPlacementCommit?.(current.latestPlacement)
  }

  const cancelPointer = (event: ReactPointerEvent<SVGRectElement>) => {
    const current = session.current
    if (!current || current.pointerId !== event.pointerId) return
    session.current = undefined
    if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
    animationFrame.current = undefined
    pendingPlacement.current = undefined
    setIsDragging(false)
    onPlacementChange?.(current.startPlacement)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <>
      <image
        href={href}
        x={placedPosition.x}
        y={placedPosition.y}
        width={placedPosition.width}
        height={placedPosition.height}
        preserveAspectRatio={geometry ? "none" : "xMidYMax meet"}
        aria-label={ariaLabel}
        data-testid={imageTestId}
      />
      {canDrag ? (
        <rect
          x={hitArea.x}
          y={hitArea.y}
          width={hitArea.width}
          height={hitArea.height}
          fill="transparent"
          className="draggable-product-hit-area"
          data-dragging={isDragging ? "true" : "false"}
          data-export-exclude="true"
          data-testid={hitAreaTestId}
          aria-label={`Arrastar ${ariaLabel.toLowerCase()}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={cancelPointer}
          onLostPointerCapture={cancelPointer}
        />
      ) : null}
    </>
  )
}
