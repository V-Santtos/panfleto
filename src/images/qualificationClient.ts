import type { ProductCandidate } from "../domain/productSearch"
import type { PackshotAssessment } from "./packshotAnalysis"

export type ImageCandidate = ProductCandidate & { imageUrl: string; thumbnailUrl: string }
export type QualifiedCandidate = ImageCandidate & { qualification: PackshotAssessment }
export type EvaluatedCandidate = ImageCandidate & { qualification: PackshotAssessment }
export type QualificationProgress = {
  candidates: QualifiedCandidate[]
  evaluations: EvaluatedCandidate[]
  evaluatedCount: number
  totalCount: number
  approvedCount: number
}

// Session-only cache; persistent image caching is a separate increment.
const cache = new Map<string, PackshotAssessment>()

function localImageUrl(candidate: ImageCandidate): string {
  if (candidate.origem === "cosmos") return `/api/product-image/cosmos/${candidate.code}`
  return `/api/product-image${new URL(candidate.imageUrl).pathname}`
}

export function qualifyCandidates(candidates: ImageCandidate[], options: {
  signal: AbortSignal
  onProgress: (progress: QualificationProgress) => void
}): Promise<QualificationProgress> {
  return new Promise((resolve, reject) => {
    let cursor = 0, evaluatedCount = 0, settled = false
    const workers: Worker[] = []
    const approved: QualifiedCandidate[] = []
    const evaluations: EvaluatedCandidate[] = []
    const progress = (): QualificationProgress => ({
      candidates: [...approved].sort((a, b) => b.qualification.score - a.qualification.score).slice(0, 6),
      evaluations: [...evaluations],
      evaluatedCount, totalCount: candidates.length, approvedCount: approved.length,
    })
    const cleanup = () => { workers.forEach((worker) => worker.terminate()); options.signal.removeEventListener("abort", abort) }
    const abort = () => { if (settled) return; settled = true; cleanup(); reject(new DOMException("Busca cancelada", "AbortError")) }
    const fail = () => { if (settled) return; settled = true; cleanup(); reject(new Error("Não foi possível verificar as fotos. Tente novamente.")) }
    function deliver(candidate: ImageCandidate, assessment: PackshotAssessment, url: string) {
      if (settled) return
      evaluatedCount++
      const evaluated: EvaluatedCandidate = { ...candidate, imageUrl: url, thumbnailUrl: url, qualification: assessment }
      evaluations.push(evaluated)
      if (assessment.accepted) approved.push(evaluated)
      options.onProgress(progress())
      if (evaluatedCount === candidates.length) { settled = true; cleanup(); resolve(progress()) }
    }
    function next(worker: Worker) {
      if (settled) return
      while (cursor < candidates.length) {
        const id = cursor++, candidate = candidates[id]
        const url = localImageUrl(candidate)
        const previous = cache.get(candidate.imageUrl)
        if (previous) { deliver(candidate, previous, url); if (settled) return; continue }
        worker.onmessage = (event: MessageEvent<{ id: number; assessment: PackshotAssessment }>) => {
          if (settled || event.data.id !== id) return
          const assessment = event.data.assessment
          if (!assessment.reasons.includes("load")) {
            if (cache.size >= 150) cache.delete(cache.keys().next().value!)
            cache.set(candidate.imageUrl, assessment)
          }
          deliver(candidate, assessment, url)
          next(worker)
        }
        worker.postMessage({ id, url })
        return
      }
    }
    if (options.signal.aborted) { abort(); return }
    if (!candidates.length) { resolve(progress()); return }
    options.signal.addEventListener("abort", abort, { once: true })
    try {
      for (let i = 0; i < Math.min(2, candidates.length); i++) {
        const worker = new Worker(new URL("./qualification.worker.ts", import.meta.url), { type: "module" })
        worker.onerror = fail
        workers.push(worker)
      }
      workers.forEach(next)
    } catch { fail() }
  })
}
