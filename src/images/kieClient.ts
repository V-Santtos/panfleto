export type KieRemovalTask = {
  taskId: string
}

export type KieRemovalStatus = {
  state: "waiting" | "queuing" | "generating" | "success" | "fail"
  resultUrl?: string
  failureMessage?: string
}

// A Kie recusa envios grandes. O limite vale para qualquer origem: upload
// manual ou foto trazida pela busca por EAN/GTIN.
export const KIE_MAX_IMAGE_BYTES = 5 * 1024 * 1024

// `async` aqui não é decorativo: garante que o estouro de limite chegue como
// Promise rejeitada, e não como exceção síncrona no meio de quem chama.
async function blobAsKieDataUrl(blob: Blob): Promise<string> {
  if (blob.size > KIE_MAX_IMAGE_BYTES) throw new Error("Para testar a Kie, escolha uma foto de até 5 MB.")
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Não foi possível preparar a foto para a Kie."))
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Não foi possível preparar a foto para a Kie."))
    reader.readAsDataURL(blob)
  })
}

export function fileAsKieDataUrl(file: File): Promise<string> {
  return blobAsKieDataUrl(file)
}

// A foto vinda da busca já é servida pelo proxy local, então basta relê-la
// dali. Nada é enviado à Kie sem o clique explícito do operador.
export async function urlAsKieDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Não foi possível carregar a foto para enviar à Kie.")
  return blobAsKieDataUrl(await response.blob())
}

export async function requestKieBackgroundRemoval(image: string): Promise<KieRemovalTask> {
  const response = await fetch("/api/kie/remove-background", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  })
  const body = await response.json() as KieRemovalTask & { message?: string }
  if (!response.ok || !body.taskId) throw new Error(body.message || "Não foi possível iniciar o recorte neural.")
  return { taskId: body.taskId }
}

function resultUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return
  if (/^\/api\/kie\/remove-background\/[^/]+\/image$/.test(value)) return value
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url.href : undefined
  } catch {
    return
  }
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { message?: unknown }
    return typeof body.message === "string" && body.message ? body.message : fallback
  } catch {
    return fallback
  }
}

export async function importKieResultImage(resultUrl: string): Promise<Blob> {
  const response = await fetch(`/api/kie/remove-background/import?url=${encodeURIComponent(resultUrl)}`)
  if (!response.ok) throw new Error(await responseMessage(response, "Não foi possível trazer o resultado concluído da Kie."))
  const result = await response.blob()
  if (!result.type.startsWith("image/")) throw new Error("A Kie retornou um arquivo que não é uma imagem.")
  return result
}

export async function getKieBackgroundRemovalTask(taskId: string): Promise<KieRemovalStatus> {
  const response = await fetch(`/api/kie/remove-background/${encodeURIComponent(taskId)}`)
  const body = await response.json() as { message?: string }
  if (!response.ok) throw new Error(body.message || "Não foi possível consultar o recorte neural.")
  const data = body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : undefined
  if (!data) throw new Error("A Kie retornou uma tarefa sem dados reconhecíveis.")
  const state = data.state
  if (state === "fail") return { state: "fail", failureMessage: typeof data.failMsg === "string" ? data.failMsg : undefined }
  if (state !== "success") {
    // Um estado intermediário que não reconhecemos não pode encerrar uma tarefa que
    // já custou crédito: o provedor pode nomear uma etapa de outro jeito. Tratá-lo
    // como "ainda trabalhando" custa mais um ciclo de consulta, que é gratuito;
    // lançar erro aqui custava o crédito inteiro. Só `fail` explícito desiste.
    return { state: state === "waiting" || state === "queuing" ? state : "generating" }
  }
  let parsedResult: unknown
  try {
    parsedResult = typeof data.resultJson === "string" ? JSON.parse(data.resultJson) : data.resultJson
  } catch {
    throw new Error("A Kie retornou um resultado de imagem inválido.")
  }
  const urls = parsedResult && typeof parsedResult === "object" && "resultUrls" in parsedResult
    ? (parsedResult as { resultUrls?: unknown }).resultUrls
    : undefined
  const imageUrl = Array.isArray(urls) ? resultUrl(urls[0]) : undefined
  if (!imageUrl) throw new Error("A Kie concluiu o recorte sem uma imagem utilizável.")
  return { state, resultUrl: imageUrl }
}
