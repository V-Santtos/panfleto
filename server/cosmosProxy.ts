import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { dirname, join } from "node:path"

import type { Plugin } from "vite"
import type { CatalogRepository, IntegrationUsageReservation } from "./catalogRepository"

const PREFIX = "/api/cosmos"
const STATUS_PATH = `${PREFIX}/status`
const API_ORIGIN = "https://cosmos.bluesoft.com.br/api"
const DAILY_LIMIT = 25
const REQUEST_TIMEOUT_MS = 15_000
const USAGE_FILE = join(process.cwd(), "data", "cosmos-usage.json")

export type CosmosUsage = { date: string; used: number }
export type CosmosUsageDecision = { allowed: boolean; usage: CosmosUsage; remaining: number }

let usageLock = Promise.resolve()

export function isValidCosmosGtin(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false
  let total = 0
  for (let index = value.length - 2, position = 0; index >= 0; index -= 1, position += 1) {
    total += Number(value[index]) * (position % 2 === 0 ? 3 : 1)
  }
  return (10 - (total % 10)) % 10 === Number(value.at(-1))
}

function todayInSaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${pick("year")}-${pick("month")}-${pick("day")}`
}

export function nextCosmosUsage(current: CosmosUsage, date: string): CosmosUsageDecision {
  const usage = current.date === date ? current : { date, used: 0 }
  if (usage.used >= DAILY_LIMIT) return { allowed: false, usage, remaining: 0 }
  const next = { date, used: usage.used + 1 }
  return { allowed: true, usage: next, remaining: DAILY_LIMIT - next.used }
}

async function storedUsage(date: string): Promise<CosmosUsage> {
  try {
    const parsed: unknown = JSON.parse(await readFile(USAGE_FILE, "utf8"))
    if (
      parsed
      && typeof parsed === "object"
      && "date" in parsed
      && "used" in parsed
      && typeof parsed.date === "string"
      && typeof parsed.used === "number"
      && Number.isInteger(parsed.used)
      && parsed.used >= 0
    ) {
      return parsed.date === date ? { date, used: Math.min(parsed.used, DAILY_LIMIT) } : { date, used: 0 }
    }
  } catch {
    // O contador local é criado somente quando a reserva remota estiver indisponível.
  }
  return { date, used: 0 }
}

async function saveUsage(usage: CosmosUsage): Promise<void> {
  await mkdir(dirname(USAGE_FILE), { recursive: true })
  const temporaryFile = `${USAGE_FILE}.${process.pid}.tmp`
  await writeFile(temporaryFile, JSON.stringify(usage), "utf8")
  await rename(temporaryFile, USAGE_FILE)
}

async function reserveLocalCosmosCall(): Promise<CosmosUsageDecision> {
  let release!: () => void
  const previous = usageLock
  usageLock = new Promise<void>((resolve) => { release = resolve })
  await previous
  try {
    const date = todayInSaoPaulo()
    const decision = nextCosmosUsage(await storedUsage(date), date)
    if (decision.allowed) await saveUsage(decision.usage)
    return decision
  } finally {
    release()
  }
}

function localReservation(decision: CosmosUsageDecision): IntegrationUsageReservation {
  return {
    allowed: decision.allowed,
    usageDate: decision.usage.date,
    usedCount: decision.usage.used,
    dailyLimit: DAILY_LIMIT,
    remaining: decision.remaining,
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.writableEnded || response.destroyed) return
  response.statusCode = status
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.end(JSON.stringify(body))
}

async function callCosmos(
  token: string,
  userAgent: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgent,
        "X-Cosmos-Token": token,
      },
      signal: controller.signal,
    })
    const text = await response.text()
    try {
      return { status: response.status, body: JSON.parse(text) as unknown }
    } catch {
      return { status: response.status, body: { message: "O Cosmos retornou uma resposta inválida." } }
    }
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

function quotaBody(decision: IntegrationUsageReservation) {
  return {
    message: "O limite local de 25 consultas do Cosmos para hoje foi atingido.",
    usage: { date: decision.usageDate, used: decision.usedCount },
    remaining: decision.remaining,
  }
}

export function cosmosProxy(
  tokenValue: string | undefined,
  userAgentValue: string | undefined,
  repositoryProvider: () => CatalogRepository,
): Plugin {
  const token = tokenValue?.trim()
  const userAgent = userAgentValue?.trim() || "Cosmos-API-Request"
  let useLocalUsageRecovery = false
  return {
    name: "local-cosmos-proxy",
    configureServer(server) {
      server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1")
        const gtinMatch = url.pathname.match(/^\/api\/cosmos\/gtins\/([^/]+)$/)
        if (url.pathname !== STATUS_PATH && !gtinMatch) { next(); return }

        if (url.pathname === STATUS_PATH) {
          if (request.method !== "GET") { sendJson(response, 405, { message: "Método não permitido." }); return }
          if (useLocalUsageRecovery) {
            const usage = await storedUsage(todayInSaoPaulo())
            sendJson(response, 200, { configured: Boolean(token), dailyLimit: DAILY_LIMIT, used: usage.used, remaining: DAILY_LIMIT - usage.used })
            return
          }
          try {
            const usage = await repositoryProvider().getIntegrationUsage("cosmos")
            sendJson(response, 200, { configured: Boolean(token), dailyLimit: usage.dailyLimit, used: usage.usedCount, remaining: usage.remaining })
          } catch {
            useLocalUsageRecovery = true
            const usage = await storedUsage(todayInSaoPaulo())
            sendJson(response, 200, { configured: Boolean(token), dailyLimit: DAILY_LIMIT, used: usage.used, remaining: DAILY_LIMIT - usage.used })
          }
          return
        }

        if (!token) {
          sendJson(response, 503, { message: "A integração Cosmos não está configurada. Defina COSMOS_TOKEN no .env.local e reinicie o servidor." })
          return
        }
        if (request.method !== "GET") { sendJson(response, 405, { message: "Método não permitido." }); return }

        const gtin = decodeURIComponent(gtinMatch![1])
        if (!isValidCosmosGtin(gtin)) { sendJson(response, 400, { message: "Informe um GTIN/EAN válido." }); return }
        const path = `/gtins/${gtin}.json`

        let decision: IntegrationUsageReservation
        try {
          decision = useLocalUsageRecovery
            ? localReservation(await reserveLocalCosmosCall())
            : await repositoryProvider().reserveIntegrationUsage("cosmos")
        } catch {
          useLocalUsageRecovery = true
          decision = localReservation(await reserveLocalCosmosCall())
        }
        if (!decision.allowed) { sendJson(response, 429, quotaBody(decision)); return }
        try {
          const result = await callCosmos(token, userAgent, path)
          sendJson(response, result.status, { data: result.body, usage: { date: decision.usageDate, used: decision.usedCount }, remaining: decision.remaining })
        } catch (error) {
          const message = error instanceof Error && error.name === "AbortError"
            ? "O Cosmos demorou demais para responder."
            : "Não foi possível consultar o Cosmos."
          sendJson(response, 502, { message, usage: { date: decision.usageDate, used: decision.usedCount }, remaining: decision.remaining })
        }
      })
    },
  }
}
