# Remoção de fundo pela Kie — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** tirar o recorte determinístico de fundo branco do fluxo, deixando a foto encontrada chegar ao cartaz como está e permitindo que o operador remova o fundo pela Kie quando quiser.

**Arquitetura:** `removeSelectedWhiteBackground` hoje recorta o fundo e mede a geometria de ancoragem. Só a medição sobrevive, virando `measureProductPlacement`, que não altera nenhum pixel: imagem com alfa é medida por silhueta, imagem opaca é medida pela caixa do conteúdo não branco. O botão da Kie deixa de ser exclusivo do upload manual.

**Stack:** TypeScript, React 19, Vite 7, Vitest com jsdom, Web Workers e `OffscreenCanvas`.

**Especificação:** [`docs/superpowers/specs/2026-09-06-remocao-de-fundo-pela-kie-design.md`](../specs/2026-09-06-remocao-de-fundo-pela-kie-design.md)

## Restrições globais

- A aplicação roda em `localhost`, em `http://127.0.0.1:4173/`.
- Nenhum pixel é alterado durante a medição. Recorte só acontece na Kie.
- Selecionar um produto **não** dispara chamada à Kie. Só o clique no botão dispara.
- A Kie continua **não validada visualmente**. O resultado dela só substitui o cartaz depois de "Usar resultado". Nada disso muda aqui.
- Limite de 5 MB para qualquer imagem enviada à Kie, venha de upload ou da busca.
- Limiar de conteúdo: um pixel conta como produto quando `min(r,g,b) < 232`. Uma linha ou coluna só entra nos limites com pelo menos 3 pixels de conteúdo.
- Falha da Kie ou da medição nunca pode esvaziar o cartaz nem perder a foto original.
- Rodar `npm test` antes de cada commit. A suíte está em 163 testes passando.
- Fora de escopo: arraste e reposicionamento, acionamento automático da Kie, Feed 4/8, Story 4/8, mudança de schema remoto.

## Estrutura de arquivos

| Arquivo | Responsabilidade depois deste plano |
| --- | --- |
| `src/images/cutout.ts` | Somente medição: `visibleAlphaBounds`, `visibleContentBounds`, `hasSoftContactShadow` e os tipos. Deixa de recortar. |
| `src/images/processing.worker.ts` | Mede a geometria fora da thread principal. Não produz imagem nova. |
| `src/images/processingClient.ts` | `measureProductPlacement(url, options)`, a ponte com o worker. |
| `src/images/kieClient.ts` | Prepara e acompanha a tarefa da Kie, a partir de `File` ou de URL. |
| `src/app/App.tsx` | Orquestra seleção, medição, Kie e aprovação humana. |

---

### Tarefa 1: medir a caixa do conteúdo em foto opaca

**Arquivos:**
- Modificar: `src/images/cutout.ts`
- Testar: `src/images/cutout.test.ts`

**Interfaces:**
- Consome: os tipos `RgbaImage` e `VisibleAlphaBounds`, já exportados por `cutout.ts`.
- Produz: `visibleContentBounds(image: RgbaImage): VisibleAlphaBounds | undefined`. A Tarefa 2 depende deste nome e desta assinatura.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar em `src/images/cutout.test.ts`, dentro do `describe` existente:

```ts
  it("mede a caixa de um produto opaco em fundo branco", () => {
    const width = 20, height = 20
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    for (let y = 4; y <= 15; y++) for (let x = 6; x <= 13; x++) data.set([180, 30, 30, 255], (y * width + x) * 4)

    expect(visibleContentBounds({ data, width, height })).toEqual({ left: 6, top: 4, width: 8, height: 12 })
  })

  it("ignora ruído de compressão isolado ao medir a caixa", () => {
    const width = 20, height = 20
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    for (let y = 8; y <= 11; y++) for (let x = 8; x <= 11; x++) data.set([180, 30, 30, 255], (y * width + x) * 4)
    // Dois pixels soltos na borda não podem esticar a medição.
    data.set([200, 195, 198, 255], (0 * width + 1) * 4)
    data.set([200, 195, 198, 255], (19 * width + 18) * 4)

    expect(visibleContentBounds({ data, width, height })).toEqual({ left: 8, top: 8, width: 4, height: 4 })
  })

  it("enquadra a mesma silhueta com fundo branco e com alfa, para o produto não saltar", () => {
    const width = 24, height = 24
    const opaca = new Uint8ClampedArray(width * height * 4).fill(255)
    const comAlfa = new Uint8ClampedArray(width * height * 4)
    for (let y = 5; y <= 18; y++) for (let x = 7; x <= 16; x++) {
      opaca.set([180, 30, 30, 255], (y * width + x) * 4)
      comAlfa.set([180, 30, 30, 255], (y * width + x) * 4)
    }

    // Esta é a garantia central do desenho: a mesma embalagem, antes e depois
    // da Kie, precisa ser medida na mesma caixa.
    expect(visibleContentBounds({ data: opaca, width, height }))
      .toEqual(visibleAlphaBounds({ data: comAlfa, width, height }))
  })

  it("não mede nada em imagem inteiramente branca", () => {
    const data = new Uint8ClampedArray(12 * 12 * 4).fill(255)
    expect(visibleContentBounds({ data, width: 12, height: 12 })).toBeUndefined()
  })

  it("trata pixel quase branco como fundo, não como produto", () => {
    const width = 12, height = 12
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    // 241 é o piso de ruído JPEG medido no CDN do Cosmos; fica acima do limiar.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([241, 244, 243, 255], (y * width + x) * 4)
    for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) data.set([20, 40, 90, 255], (y * width + x) * 4)

    expect(visibleContentBounds({ data, width, height })).toEqual({ left: 5, top: 5, width: 3, height: 3 })
  })
```

Atualizar a linha 3 do arquivo para importar a função nova:

```ts
import { cutoutQualityError, hasSoftContactShadow, removeWhiteBackground, visibleAlphaBounds, visibleContentBounds } from "./cutout"
```

- [ ] **Passo 2: rodar e confirmar que falha**

```bash
npx vitest run src/images/cutout.test.ts
```

Esperado: FAIL com `visibleContentBounds is not a function`.

- [ ] **Passo 3: implementar**

Acrescentar em `src/images/cutout.ts`, logo depois de `visibleAlphaBounds`:

```ts
// Compartilhado com a qualificação: o ringing de JPEG ao redor da embalagem
// fica logo abaixo do branco puro (piso de ruído de 241 medido no CDN do
// Cosmos), então só um pixel claramente não branco conta como produto.
const PRODUCT_CONTENT_THRESHOLD = 232
// Um respingo solto não pode esticar a caixa medida.
const MINIMUM_CONTENT_PIXELS = 3

// Mede a embalagem dentro de uma foto opaca em fundo branco. Medir uma caixa
// tolera erro de alguns pixels; produzir uma máscara alfa por código, não. Esta
// função nunca altera a imagem.
export function visibleContentBounds(image: RgbaImage): VisibleAlphaBounds | undefined {
  const { data, width, height } = image
  const rowCounts = new Uint32Array(height)
  const columnCounts = new Uint32Array(width)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    if (data[offset + 3] < PRODUCT_ALPHA_THRESHOLD) continue
    if (Math.min(data[offset], data[offset + 1], data[offset + 2]) >= PRODUCT_CONTENT_THRESHOLD) continue
    rowCounts[y]++
    columnCounts[x]++
  }
  let top = -1, bottom = -1, left = -1, right = -1
  for (let y = 0; y < height; y++) if (rowCounts[y] >= MINIMUM_CONTENT_PIXELS) { if (top === -1) top = y; bottom = y }
  for (let x = 0; x < width; x++) if (columnCounts[x] >= MINIMUM_CONTENT_PIXELS) { if (left === -1) left = x; right = x }
  if (top === -1 || left === -1) return
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}
```

- [ ] **Passo 4: rodar e confirmar que passa**

```bash
npx vitest run src/images/cutout.test.ts
```

Esperado: PASS, 14 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/images/cutout.ts src/images/cutout.test.ts
git commit -m "feat: medir a caixa do produto em foto opaca sem recortar"
```

---

### Tarefa 2: worker e cliente passam a medir em vez de recortar

**Arquivos:**
- Modificar: `src/images/processing.worker.ts` (arquivo inteiro)
- Modificar: `src/images/processingClient.ts` (arquivo inteiro)
- Modificar: `src/app/App.tsx:18`, `src/app/App.tsx:145-170`, `src/app/App.tsx:255-265`

**Interfaces:**
- Consome: `visibleContentBounds` da Tarefa 1; `visibleAlphaBounds` e `hasSoftContactShadow`, já existentes.
- Produz: `measureProductPlacement(sourceUrl: string, options?: { signal?: AbortSignal }): Promise<ProductImageGeometry>`. Substitui `removeSelectedWhiteBackground`, que devolvia `ProcessedImage`. A Tarefa 5 depende deste nome.

Note a mudança de contrato: a função **não devolve mais imagem nenhuma**, só geometria. Quem chama continua exibindo a URL original.

- [ ] **Passo 1: reescrever o worker**

Substituir todo o conteúdo de `src/images/processing.worker.ts` por:

```ts
/// <reference lib="webworker" />

import { hasSoftContactShadow, visibleAlphaBounds, visibleContentBounds, type RgbaImage } from "./cutout"

declare const self: DedicatedWorkerGlobalScope

// Alfa na origem significa que o fundo já foi removido, pela Kie ou pela fonte.
// Essas imagens são medidas pela silhueta; uma foto opaca é medida pelo seu
// conteúdo não branco. Nenhum pixel é alterado em nenhum dos dois casos.
function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) if (data[index] < 250) return true
  return false
}

self.onmessage = async (event: MessageEvent<{ id: number; bitmap: ImageBitmap }>) => {
  const { id, bitmap } = event.data
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Não foi possível medir a embalagem.")
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const image: RgbaImage = { data: pixels.data, width: pixels.width, height: pixels.height }
    const transparent = hasTransparency(image.data)
    const visibleBounds = transparent ? visibleAlphaBounds(image) : visibleContentBounds(image)
    if (!visibleBounds) throw new Error("Não foi possível localizar a embalagem na imagem.")
    self.postMessage({
      id,
      placement: {
        sourceWidth: image.width,
        sourceHeight: image.height,
        visibleBounds,
        hasIntrinsicContactShadow: transparent ? hasSoftContactShadow(image, visibleBounds) : false,
      },
    })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Não foi possível medir a embalagem." })
  } finally {
    bitmap.close()
  }
}
```

A ampliação de 2× sai junto: ela existia para melhorar o recorte. Medir não precisa dela.

- [ ] **Passo 2: reescrever o cliente**

Substituir todo o conteúdo de `src/images/processingClient.ts` por:

```ts
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
```

O tipo `ProcessedImage` desaparece: não existe mais imagem processada.

- [ ] **Passo 3: atualizar o import em App.tsx**

Em `src/app/App.tsx`, trocar a linha 18:

```ts
import { measureProductPlacement } from "../images/processingClient"
```

- [ ] **Passo 4: atualizar a seleção de produto em App.tsx**

Substituir o bloco que hoje começa em `void removeSelectedWhiteBackground(candidate.imageUrl, ...)` por:

```ts
    const imageUrl = candidate.imageUrl
    const controller = new AbortController()
    activeProcessing.current = controller
    setProcessingImage(true)
    void measureProductPlacement(imageUrl, { signal: controller.signal })
      .then((placement) => {
        if (activeProcessing.current !== controller || controller.signal.aborted) return
        // A foto entra no cartaz como veio da fonte. O fundo sai pela Kie, se o
        // operador pedir, nunca por código.
        setProcessedImageUrl(imageUrl)
        setProcessedImageGeometry(placement)
      })
      .catch((error: unknown) => {
        if (activeProcessing.current !== controller || controller.signal.aborted) return
        setProcessingError(error instanceof Error ? error.message : "Não foi possível preparar a embalagem.")
      })
      .finally(() => {
        if (activeProcessing.current === controller) {
          activeProcessing.current = null
          setProcessingImage(false)
        }
      })
```

- [ ] **Passo 5: atualizar o trecho da Kie em App.tsx**

Dentro de `requestBackgroundRemovalWithKie`, substituir o bloco `if (status.state === "success" && status.resultUrl) { ... }` por:

```ts
        if (status.state === "success" && status.resultUrl) {
          // Trazer o PNG pelo proxy local evita depender do CORS do CDN da Kie.
          const blob = await importKieResultImage(status.resultUrl)
          if (controller.signal.aborted) return
          const localUrl = trackObjectUrl(URL.createObjectURL(blob))
          let placement: ProductImageGeometry
          try {
            placement = await measureProductPlacement(localUrl, { signal: controller.signal })
          } catch (error) {
            revokeObjectUrl(localUrl)
            throw error
          }
          if (controller.signal.aborted) {
            revokeObjectUrl(localUrl)
            return
          }
          setKieCandidateImageUrl(localUrl)
          setKieCandidateGeometry(placement)
          return
        }
```

A URL do resultado é revogada em qualquer resultado que não seja uma medição bem-sucedida.

Acrescentar `importKieResultImage` ao import de `../images/kieClient` na linha 17:

```ts
import { fileAsKieDataUrl, getKieBackgroundRemovalTask, importKieResultImage, requestKieBackgroundRemoval } from "../images/kieClient"
```

- [ ] **Passo 6: ajustar o texto de progresso**

Em `src/app/App.tsx`, o aviso `Recortando o fundo da embalagem…` não descreve mais o que acontece. Trocar por:

```tsx
              {processingImage ? <p className="image-processing" role="status">Medindo a embalagem…</p> : null}
```

- [ ] **Passo 7: rodar a suíte e o build**

```bash
npm test
```

Esperado: PASS. Os testes de `cutout.test.ts` que exercitam `removeWhiteBackground` continuam passando, porque a função ainda existe — ela sai na Tarefa 3.

```bash
npm run build
```

Esperado: sem erro de tipo. Se `tsc` reclamar de `ProcessedImage` em algum arquivo, é chamador esquecido: corrija antes de seguir.

- [ ] **Passo 8: commitar**

```bash
git add src/images/processing.worker.ts src/images/processingClient.ts src/app/App.tsx
git commit -m "refactor: medir a embalagem em vez de recortar o fundo por código"
```

---

### Tarefa 3: apagar o recorte determinístico

**Arquivos:**
- Modificar: `src/images/cutout.ts`
- Modificar: `src/images/cutout.test.ts`

**Interfaces:**
- Consome: nada. Depende apenas de a Tarefa 2 já ter removido o último chamador.
- Produz: `cutout.ts` reduzido a medição. Nenhuma tarefa posterior depende do que é apagado.

- [ ] **Passo 1: confirmar que ninguém mais usa**

```bash
grep -rn "removeWhiteBackground\|cutoutQualityError\|CutoutResult" src/ server/
```

Esperado: só ocorrências em `src/images/cutout.ts` e `src/images/cutout.test.ts`. Qualquer outra ocorrência significa que a Tarefa 2 ficou incompleta — pare e resolva antes.

- [ ] **Passo 2: apagar de `cutout.ts`**

Remover destes símbolos, nesta ordem, o bloco inteiro de cada um:

- o tipo `CutoutResult`
- os tipos `Stats` e `BackgroundProfile`
- as funções `luminance`, `saturation`, `stats`, `borderIndices`, `sobel`, `countForegroundComponents`
- as funções exportadas `cutoutQualityError` e `removeWhiteBackground`

Mantenha `RgbaImage`, `VisibleAlphaBounds`, `ProductImageGeometry`, `PRODUCT_ALPHA_THRESHOLD`, `PRODUCT_CONTENT_THRESHOLD`, `MINIMUM_CONTENT_PIXELS`, `visibleAlphaBounds`, `hasSoftContactShadow` e `visibleContentBounds`.

Trocar o comentário de topo do arquivo, se houver referência a recorte, por:

```ts
// Medição da embalagem dentro de uma foto. Nada aqui altera a imagem: o recorte
// de fundo é feito pela Kie, sob comando do operador.
```

- [ ] **Passo 3: apagar os testes correspondentes**

Em `src/images/cutout.test.ts`, remover os testes que exercitam o recorte:

- `removes only white connected to the image edges`
- `removes a slightly off-white background without erasing the outlined package`
- `does not cross a subtle gray outline into a white bottle`
- `follows gentle variation in the connected white background`
- `preserves existing transparent borders`
- `rejects malformed pixel buffers`
- `flags a mask that removed the whole image`

Mantenha `measures the visible product while ignoring a faint transparent shadow`, `detects an existing soft contact shadow below the physical product` e os quatro testes criados na Tarefa 1.

Ajustar a linha de import para:

```ts
import { hasSoftContactShadow, visibleAlphaBounds, visibleContentBounds } from "./cutout"
```

E o título do `describe` para:

```ts
describe("medição da embalagem", () => {
```

A função auxiliar `pixel` fica sem uso depois dessas remoções: apague-a também.

- [ ] **Passo 4: rodar a suíte e o build**

```bash
npm test && npm run build
```

Esperado: PASS e build limpo. A contagem total cai, porque 7 testes de recorte saíram e 4 de medição entraram.

- [ ] **Passo 5: commitar**

```bash
git add src/images/cutout.ts src/images/cutout.test.ts
git commit -m "refactor: remover o recorte determinístico de fundo branco"
```

---

### Tarefa 4: preparar imagem da busca para a Kie

**Arquivos:**
- Modificar: `src/images/kieClient.ts`
- Testar: `src/images/kieClient.test.ts`

**Interfaces:**
- Consome: nada de tarefas anteriores.
- Produz: `urlAsKieDataUrl(url: string): Promise<string>` e a constante exportada `KIE_MAX_IMAGE_BYTES`. A Tarefa 5 depende dos dois.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar em `src/images/kieClient.test.ts`, dentro do `describe` existente:

```ts
  it("converte a foto de uma URL em data URL para a Kie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), { status: 200 }),
    ))

    await expect(urlAsKieDataUrl("/api/product-image/cosmos/7891000053508")).resolves.toMatch(/^data:image\/jpeg;base64,/)
  })

  it("recusa uma foto acima do limite antes de falar com a Kie", async () => {
    const oversized = new Blob([new Uint8Array(KIE_MAX_IMAGE_BYTES + 1)], { type: "image/png" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(oversized, { status: 200 })))

    await expect(urlAsKieDataUrl("/api/product-image/cosmos/7891000053508")).rejects.toThrow(/5 MB/)
  })

  it("avisa quando a foto da busca não pode ser carregada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })))

    await expect(urlAsKieDataUrl("/api/product-image/cosmos/7891000053508")).rejects.toThrow(/não foi possível|Não foi possível/i)
  })
```

Atualizar o import da linha 3 do arquivo de teste:

```ts
import { getKieBackgroundRemovalTask, importKieResultImage, KIE_MAX_IMAGE_BYTES, requestKieBackgroundRemoval, urlAsKieDataUrl } from "./kieClient"
```

Se `vi` ainda não estiver importado nesse arquivo, acrescente-o ao import do `vitest` na linha 1.

- [ ] **Passo 2: rodar e confirmar que falha**

```bash
npx vitest run src/images/kieClient.test.ts
```

Esperado: FAIL com `urlAsKieDataUrl is not a function`.

- [ ] **Passo 3: implementar**

Em `src/images/kieClient.ts`, acrescentar no topo, logo depois dos tipos:

```ts
// A Kie recusa envios grandes. O limite vale para qualquer origem: upload
// manual ou foto trazida pela busca por EAN/GTIN.
export const KIE_MAX_IMAGE_BYTES = 5 * 1024 * 1024
```

Extrair a leitura em data URL, que hoje vive dentro de `fileAsKieDataUrl`, para uma função compartilhada, e reescrever `fileAsKieDataUrl` sobre ela:

```ts
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
```

A assinatura pública de `fileAsKieDataUrl` não muda: continua `(file: File) => Promise<string>`, agora delegando. Os chamadores existentes seguem funcionando sem alteração.

- [ ] **Passo 4: rodar e confirmar que passa**

```bash
npx vitest run src/images/kieClient.test.ts
```

Esperado: PASS, 6 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/images/kieClient.ts src/images/kieClient.test.ts
git commit -m "feat: preparar foto vinda da busca para envio à Kie"
```

---

### Tarefa 5: liberar a Kie para a foto da busca

**Arquivos:**
- Modificar: `src/app/App.tsx:236-245` e `src/app/App.tsx:352`
- Modificar: `docs/CONTEXTO_ATUAL.md`
- Testar: `src/components/ImageUpload.test.tsx`

**Interfaces:**
- Consome: `urlAsKieDataUrl` e `KIE_MAX_IMAGE_BYTES` da Tarefa 4; `measureProductPlacement` da Tarefa 2.
- Produz: o comportamento final. Nenhuma tarefa depende desta.

**Nota sobre cobertura.** A liberação do botão é uma expressão de prop dentro de `App.tsx`. Exercitá-la de ponta a ponta exigiria seleção de produto com rede, `createImageBitmap` e Web Worker — nada disso roda em jsdom, e `App.test.tsx` hoje não faz rede em nenhum teste. Montar esse aparato de mocks produziria um teste frágil que valida o mock, não o produto. A cobertura automatizada fica no contrato do componente, que é real e barato; o comportamento integrado é verificado no roteiro manual ao final deste plano. Não invente um teste de integração aqui.

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar em `src/components/ImageUpload.test.tsx`, dentro do `describe` existente:

```ts
  it("esconde a remoção de fundo quando a foto já está sem fundo", () => {
    render(
      <ImageUpload
        productName="Nescau"
        hasCatalogImage={true}
        selectedImageUrl="blob:aprovada"
        selectedImageLabel="Resultado da Kie aprovado"
        canRequestBackgroundRemoval={false}
        onSelect={vi.fn()}
        onRequestBackgroundRemoval={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", { name: /Remover fundo com Kie/i })).not.toBeInTheDocument()
  })
```

- [ ] **Passo 2: rodar e confirmar o estado atual**

```bash
npx vitest run src/components/ImageUpload.test.tsx
```

Este teste passa desde já, porque o componente respeita a prop. Ele existe para travar a regra contra regressão quando a Tarefa 5 mudar quem calcula essa prop. Se ele **falhar**, o componente foi alterado indevidamente: pare e investigue.

- [ ] **Passo 3: liberar o botão**

Em `src/app/App.tsx`, trocar a prop na linha 352:

```tsx
                canRequestBackgroundRemoval={Boolean(productImageUrl) && !approvedKieImageUrl}
```

O botão some depois que um resultado da Kie foi aprovado, porque não faz sentido remover o fundo de uma imagem já sem fundo.

- [ ] **Passo 4: aceitar as duas origens no envio**

Em `src/app/App.tsx`, substituir a abertura de `requestBackgroundRemovalWithKie`:

```ts
  const requestBackgroundRemovalWithKie = async () => {
    if (removingBackgroundWithKie) return
    const source = manualImageFile ?? productImageUrl
    if (!source) return
```

E, dentro do `try`, substituir a linha que monta a tarefa:

```ts
      const image = typeof source === "string" ? await urlAsKieDataUrl(source) : await fileAsKieDataUrl(source)
      const task = await requestKieBackgroundRemoval(image)
```

Remover a checagem antiga de tamanho, que ficou duplicada:

```ts
    if (manualImageFile.size > 5 * 1024 * 1024) {
      setKieError("Para testar a Kie, escolha uma foto de até 5 MB.")
      return
    }
```

O limite agora vive em `blobAsKieDataUrl` e vale para as duas origens. A mensagem chega ao operador pelo `catch` que já existe e alimenta `setKieError`.

Acrescentar `urlAsKieDataUrl` ao import da linha 17:

```ts
import { fileAsKieDataUrl, getKieBackgroundRemovalTask, importKieResultImage, requestKieBackgroundRemoval, urlAsKieDataUrl } from "../images/kieClient"
```

- [ ] **Passo 5: rodar e confirmar que passa**

```bash
npx vitest run src/components/ImageUpload.test.tsx src/app/App.test.tsx
```

Esperado: PASS.

- [ ] **Passo 6: atualizar a documentação de contexto**

Em `docs/CONTEXTO_ATUAL.md`, na seção "Foto, validação e alternativa manual", substituir o marcador que diz que foto em fundo branco passa por recorte determinístico por:

```markdown
- O projeto não recorta fundo branco por código. A foto aprovada entra no cartaz como veio da fonte, medida mas não alterada, e o operador remove o fundo pela Kie quando quiser. O botão **Remover fundo com Kie** vale tanto para upload manual quanto para foto trazida pela busca por EAN/GTIN. Selecionar um produto não consome chamada da Kie.
- A medição de ancoragem escolhe o critério pela imagem: com alfa, mede a silhueta; opaca, mede a caixa do conteúdo não branco (`min(r,g,b) < 232`, com no mínimo 3 pixels por linha ou coluna). Como os dois critérios enquadram a mesma silhueta, o produto não salta de posição quando o fundo sai.
- Entre o clique e a remoção do fundo, o cartaz mostra a embalagem dentro de um retângulo branco. Isso é deliberado: comunica que a foto ainda tem fundo.
```

Na mesma seção, ajustar o marcador sobre "Recorte e posicionamento" para dizer que a base física medida continua valendo, agora a partir da medição e não do recorte.

- [ ] **Passo 7: rodar tudo e commitar**

```bash
npm test && npm run build
```

Esperado: PASS e build limpo.

```bash
git add src/app/App.tsx src/components/ImageUpload.test.tsx docs/CONTEXTO_ATUAL.md
git commit -m "feat: oferecer remoção de fundo pela Kie também para foto da busca"
```

---

## Verificação manual final

Com o Vite já rodando em `http://127.0.0.1:4173/`, **sem reiniciar** se houver rascunho em edição. Este roteiro consome **uma** chamada Cosmos.

1. Buscar o GTIN `7891000053508`.
2. Conferir que o candidato aparece com a foto do Cosmos aprovada, marcada como fundo branco.
3. Clicar no produto. A foto deve ir ao cartaz **com fundo branco**, com a lata assentada no pedestal e não flutuando.
4. Conferir em `http://127.0.0.1:4173/api/cosmos/status` que o contador não mudou entre o passo 3 e o passo 5 — selecionar não pode consumir cota.
5. Clicar em **Remover fundo com Kie** e aguardar.
6. Conferir o PNG transparente apresentado para revisão e clicar em **Usar resultado**.
7. Confirmar que a embalagem permanece na mesma posição de antes, sem salto.

Se o passo 7 mostrar salto, a medição opaca e a medição por alfa estão enquadrando silhuetas diferentes: investigue `visibleContentBounds` antes de seguir.
