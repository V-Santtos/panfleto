import type { ProductImageGeometry } from "./cutout"

export async function measureProductPlacement(sourceUrl: string, options: { signal?: AbortSignal } = {}): Promise<ProductImageGeometry> {
  const response = await fetch(sourceUrl, { signal: options.signal })
  if (!response.ok) throw new Error("Não foi possível carregar a foto selecionada.")
  const bitmap = await createImageBitmap(await response.blob())
  options.signal?.throwIfAborted()

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./processing.worker.ts", import.meta.url), { type: "module" })
    const id = 1
    const cleanup = () => {
      worker.terminate()
      options.signal?.removeEventListener("abort", abort)
    }
    const abort = () => {
      cleanup()
      reject(new DOMException("Medição cancelada", "AbortError"))
    }
    worker.onmessage = (event: MessageEvent<{ id: number; placement?: ProductImageGeometry; error?: string }>) => {
      if (event.data.id !== id) return
      cleanup()
      if (event.data.error || !event.data.placement) {
        reject(new Error(event.data.error ?? "Não foi possível medir a embalagem."))
        return
      }
      resolve(event.data.placement)
    }
    worker.onerror = () => { cleanup(); reject(new Error("Não foi possível medir a embalagem.")) }
    if (options.signal?.aborted) { abort(); return }
    options.signal?.addEventListener("abort", abort, { once: true })
    worker.postMessage({ id, bitmap }, [bitmap])
  })
}
