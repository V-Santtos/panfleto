export type CosmosStatus = {
  configured: boolean
  dailyLimit: number
  used: number
  remaining: number
}

export type CosmosResponse = {
  data: unknown
  usage: { date: string; used: number }
  remaining: number
}

async function requestCosmos<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : `Cosmos respondeu HTTP ${response.status}.`
    throw new Error(message)
  }
  return body as T
}

export function getCosmosStatus(options: { signal?: AbortSignal } = {}): Promise<CosmosStatus> {
  return requestCosmos<CosmosStatus>("/api/cosmos/status", options.signal)
}

export function lookupCosmosGtin(gtin: string, options: { signal?: AbortSignal } = {}): Promise<CosmosResponse> {
  return requestCosmos<CosmosResponse>(`/api/cosmos/gtins/${encodeURIComponent(gtin)}`, options.signal)
}
