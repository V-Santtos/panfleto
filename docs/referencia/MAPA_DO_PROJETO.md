# Mapa do projeto, integrações e testes

**Natureza deste arquivo:** referência estável. Muda quando nasce um arquivo, uma
integração ou uma suíte de testes — não a cada sessão.

O estado corrente vive em [`../CONTEXTO_ATUAL.md`](../CONTEXTO_ATUAL.md).
As regras de produto vivem em [`DECISOES.md`](DECISOES.md).

## Mapa de pastas e arquivos

| Local | Responsabilidade |
| --- | --- |
| `src/app/App.tsx` | estado em memória do fluxo, seleção, processamento, confirmação e exportação |
| `src/components/` | interface: busca, upload, campos da oferta e SVG do Story |
| `src/domain/` | regras puras: oferta/unidades, classificação catálogo/nome/GTIN, fusão exata de fontes e coordenadas do Story |
| `server/catalogApi.ts` | fronteira HTTP local; valida payloads e mantém service role fora do navegador |
| `server/catalogRepository.ts` | operações específicas do catálogo e cota; não expõe SQL genérico |
| `server/imageMetadata.ts` | confere bytes e dimensões reais de PNG/JPEG/WebP antes de persistir um ativo |
| `src/api/catalogClient.ts` | cliente do navegador para a fronteira local do catálogo |
| `src/components/DraggableProduct.tsx` | alvo de Pointer Events do arraste restrito; sai do SVG exportado |
| `src/domain/productPlacement.ts` | regra pura de escala por peso visual e deslocamento da embalagem dentro do palco |
| `scripts/` | scripts avulsos de verificação; `smokeCatalogPersistence.ts` faz o smoke remoto do catálogo |
| `public/templates/feed/single/` | fundo fixo do Feed; `feed-base-empty.png` é o usado pela composição |
| `docs/referencia/` | este mapa e as decisões estáveis do produto |
| `supabase/` | migração canônica, seed vazio e testes pgTAP do schema |
| `src/images/` | qualificação de fotos, medição da silhueta (alfa e conteúdo não branco) e Workers do navegador. Não recorta fundo: ver a regra em [`DECISOES.md`](DECISOES.md) |
| `src/export/` | serialização do SVG e geração local de PNG/PDF |
| `src/styles.css` | sistema visual e responsividade da interface |
| `src/test/` | configuração comum de Vitest |
| `server/cosmosProxy.ts` | proxy local Cosmos; exige reserva atômica de cota no Supabase antes da chamada externa |
| `server/productImageProxy.ts` | proxy seguro das imagens aprovadas de cada fonte |
| `server/kieBackgroundRemoval.ts` | upload Base64 manual, criação/consulta de tarefa e relay local seguro do PNG da Kie. `createKieBackgroundRemovalHandler` separa o handler do plugin Vite, como em `catalogApi.ts`, para que a rota possa ser exercitada por um servidor HTTP real em teste |
| `public/templates/story/single/` | fundo fixo da arte; `story-base-empty.png` é o fundo usado pela composição |
| `public/fonts/` | fontes da interface e do SVG, incluindo Komika Axis da placa |
| `assets/reference-templates/` | PSD e referências de design; não é usado diretamente pelo navegador |
| `data/` | contador local do Cosmos usado somente como recuperação se a reserva remota falhar; não é versionado nem deve ser editado ou apagado manualmente |
| `docs/superpowers/specs/` | especificação canônica do produto |
| `docs/superpowers/plans/` | planos aprovados e decisões incrementais de implementação |
| `docs/superpowers/notes/` | aprendizados históricos; podem registrar decisões já superadas por este contexto |
| `atlas-output/go/` | dossiê de viabilidade, riscos e critérios de MVP |
| `README.md` | porta de entrada e links para a documentação atual |
| `AGENTS.md` | instruções persistentes para futuras sessões de trabalho |
| `vite.config.ts` | Vite e as rotas locais de desenvolvimento |
| `package.json` | comandos `dev`, `test` e `build` |
| `.env.example` | modelo de variáveis sem segredos |
| `.env.local` | segredos apenas locais, ignorados pelo Git |
| `dist/` | resultado descartável de `npm run build` |
| `node_modules/` | dependências instaladas; não editar |


## Integrações e segredos

| Integração | Uso atual | Configuração local | Regra de segurança |
| --- | --- | --- | --- |
| Open Food Facts | metadados e busca gratuita | não requer chave | validar foto antes de uso |
| Cosmos BlueSoft | metadados e thumbnail para GTIN exato | `COSMOS_TOKEN`, `COSMOS_USER_AGENT` | somente servidor Vite, limite de 25/dia |
| Kie | teste manual de remoção de fundo e recuperação de resultado | `KIE_API_KEY` | chave só no middleware Vite; nunca no navegador |
| Supabase | catálogo de produtos, fotos aprovadas e cota Cosmos; tabelas de campanha existentes permanecem sem uso | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | service role somente no servidor Vite; RLS bloqueia browser |

As chaves ficam exclusivamente em `.env.local`, que não entra no Git. `.env.example` contém apenas os nomes das variáveis. Nunca abrir, imprimir ou copiar valores de `.env.local` para conversa, testes ou documentação.


## Testes existentes

Os testes estão ao lado do código a que pertencem. Eles cobrem, entre outros, validação de preço/unidade, busca e cancelamento, origem de foto, quota Cosmos, proxy de imagem, análise/recorte, ancoragem no pedestal, sombra de contato, interface e exportação.

Antes de concluir uma mudança, executar:

```powershell
npm test
npm run build
```

Na última validação automatizada de 17 de setembro de 2026, passaram **30 arquivos de teste e 236 testes**, além do build. `server/kieBackgroundRemovalRoute.test.ts` cobre a rota da Kie ponta a ponta contra um provedor falso — criação da tarefa, consulta de estado, relay do resultado, redirecionamento do CDN e recusa de upload sem gastar crédito — e `src/app/App.kie.test.tsx` cobre a preservação do resultado pago na interface. A cobertura inclui atualização restrita de `display_name`, ausência de escrita ao alterar somente preço, busca incremental, exclusividade do cadastro manual, qualificação de foto por fonte, arraste independente de Story/Feed, escala por peso visual, borda semântica de produto registrado e reset explícito depois do download. Antes desse incremento, o smoke remoto confirmou ativação, upload/recuperação do ativo e busca por nome e limpou somente os registros técnicos; depois disso, o usuário concluiu o fluxo real com o Nescau.

