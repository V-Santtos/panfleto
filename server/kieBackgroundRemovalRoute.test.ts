import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createKieBackgroundRemovalHandler } from "./kieBackgroundRemoval"

// Esta suíte cobre o portão registrado em 7 de setembro: criação da tarefa, consulta
// de estado, relay do resultado e preservação diante de falha. Antes dela, tudo que
// existia eram funções puras e `fetch` mockado — o handler HTTP real, que é onde o
// crédito é gasto e onde o PNG pago precisa chegar, nunca tinha sido exercitado.

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
const UPLOADED = "https://tempfile.redpandaai.co/catalogo/embalagem-manual.png"
const DATA_URL = "data:image/png;base64,AAAA"
const CATALOG_PHOTO = "https://images.openfoodfacts.org/images/products/789/front_pt.18.full.jpg"

type Hop = { status: number; location?: string; bytes?: Uint8Array }

type FakeKie = {
  upload?: { status: number; body: unknown }
  create?: { status: number; body: unknown }
  record?: { status: number; body: unknown }
  hops?: Hop[]
}

function successRecord(resultUrl = "https://cdn.example.com/cutout.png"): unknown {
  return { code: 200, msg: "success", data: { state: "success", resultJson: JSON.stringify({ resultUrls: [resultUrl] }) } }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function stubKie(options: FakeKie): { url: string; body?: string }[] {
  const calls: { url: string; body?: string }[] = []
  const hops = [...(options.hops ?? [{ status: 200, bytes: PNG_BYTES }])]
  // O próprio teste usa `fetch` para falar com o servidor local, então o stub só
  // pode substituir as chamadas que sairiam para a Kie. O tráfego para 127.0.0.1
  // volta ao `fetch` real; sem isso o teste responderia a si mesmo.
  const realFetch = globalThis.fetch
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("127.0.0.1")) return realFetch(input as string, init)
    calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined })
    if (url.includes("file-base64-upload")) {
      return json(options.upload?.status ?? 200, options.upload?.body ?? { success: true, data: { downloadUrl: UPLOADED } })
    }
    if (url.includes("createTask")) {
      return json(options.create?.status ?? 200, options.create?.body ?? { code: 200, msg: "success", data: { taskId: "9f8e7d6c" } })
    }
    if (url.includes("recordInfo")) {
      return json(options.record?.status ?? 200, options.record?.body ?? successRecord())
    }
    const hop = hops.shift() ?? { status: 404 }
    if (hop.location) return new Response(null, { status: hop.status, headers: { location: hop.location } })
    return new Response(hop.bytes ? Buffer.from(hop.bytes) : null, { status: hop.status })
  }))
  return calls
}

const servers: Server[] = []

async function withKieServer(apiKey = "chave-local"): Promise<string> {
  const handler = createKieBackgroundRemovalHandler(apiKey)
  const server = createServer((request, response) => void handler(request, response))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

function removeBackground(origin: string, image: string): Promise<Response> {
  return fetch(`${origin}/api/kie/remove-background`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })))
})

describe("rota local da Kie, ponta a ponta", () => {
  it("cria a tarefa a partir de uma foto local e devolve o identificador", async () => {
    const calls = stubKie({})
    const origin = await withKieServer()

    const response = await removeBackground(origin, DATA_URL)

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ taskId: "9f8e7d6c" })
    // A foto local sobe pelo upload Base64 e só a URL temporária da Kie chega ao modelo.
    expect(calls[0].url).toContain("file-base64-upload")
    expect(JSON.parse(calls[1].body ?? "{}")).toEqual({ model: "recraft/remove-background", input: { image: UPLOADED } })
  })

  it("aceita a foto vinda da busca pelo mesmo caminho, qualquer que seja a fonte", async () => {
    const calls = stubKie({})
    const origin = await withKieServer()

    const response = await removeBackground(origin, CATALOG_PHOTO)

    expect(response.status).toBe(201)
    // Uma foto já pública do catálogo não precisa passar pelo upload.
    expect(calls.some((call) => call.url.includes("file-base64-upload"))).toBe(false)
    expect(JSON.parse(calls[0].body ?? "{}")).toEqual({ model: "recraft/remove-background", input: { image: CATALOG_PHOTO } })
  })

  it("troca a URL externa pelo relay de mesma origem na consulta de estado", async () => {
    stubKie({})
    const origin = await withKieServer()

    const response = await fetch(`${origin}/api/kie/remove-background/9f8e7d6c`)
    const body = await response.json() as { data: { resultJson: string } }

    expect(response.status).toBe(200)
    expect(JSON.parse(body.data.resultJson)).toEqual({ resultUrls: ["/api/kie/remove-background/9f8e7d6c/image"] })
  })

  it("entrega os bytes do PNG pelo relay local", async () => {
    stubKie({})
    const origin = await withKieServer()

    const response = await fetch(`${origin}/api/kie/remove-background/9f8e7d6c/image`)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES)
  })

  it("segue o redirecionamento do CDN em vez de descartar o resultado já pago", async () => {
    stubKie({ hops: [
      { status: 302, location: "https://cdn2.example.com/real.png" },
      { status: 200, bytes: PNG_BYTES },
    ] })
    const origin = await withKieServer()

    const response = await fetch(`${origin}/api/kie/remove-background/9f8e7d6c/image`)

    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES)
  })

  it("recusa um redirecionamento que sai da guarda da URL de resultado", async () => {
    stubKie({ hops: [{ status: 302, location: "http://127.0.0.1:9/interno.png" }] })
    const origin = await withKieServer()

    const response = await fetch(`${origin}/api/kie/remove-background/9f8e7d6c/image`)

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ stage: "download" })
  })

  it("nomeia a etapa e o status quando o download do resultado falha", async () => {
    stubKie({ hops: [{ status: 500 }] })
    const origin = await withKieServer()

    const response = await fetch(`${origin}/api/kie/remove-background/9f8e7d6c/image`)
    const body = await response.json() as { message: string; stage: string }

    expect(response.status).toBe(502)
    expect(body.stage).toBe("download")
    expect(body.message).toContain("HTTP 500")
  })

  it("não gasta crédito quando a Kie recusa o upload da foto", async () => {
    const calls = stubKie({ upload: { status: 400, body: { success: false, msg: "arquivo inválido" } } })
    const origin = await withKieServer()

    const response = await removeBackground(origin, DATA_URL)

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ stage: "upload" })
    // Criar a tarefa é o único passo cobrado: ele não pode acontecer após recusa.
    expect(calls.some((call) => call.url.includes("createTask"))).toBe(false)
  })

  it("mantém a tarefa consultável quando o resultado ainda não está pronto", async () => {
    stubKie({ record: { status: 200, body: { code: 200, data: { state: "generating" } } } })
    const origin = await withKieServer()

    const response = await fetch(`${origin}/api/kie/remove-background/9f8e7d6c`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { state: "generating" } })
  })

  it("nunca devolve a chave do provedor ao navegador", async () => {
    stubKie({})
    const origin = await withKieServer("chave-secreta-do-provedor")

    const created = await removeBackground(origin, DATA_URL)
    const status = await fetch(`${origin}/api/kie/status`)

    expect(await created.text()).not.toContain("chave-secreta-do-provedor")
    expect(await status.json()).toEqual({ configured: true, revision: "kie-manual-upload-v4" })
  })
})
