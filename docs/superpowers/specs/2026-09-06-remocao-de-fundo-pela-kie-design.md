# Remoção de fundo pela Kie, não por código

**Data:** 6 de setembro de 2026
**Estado:** aguardando aprovação humana da especificação
**Origem:** teste real do GTIN `7891000053508` (Nescau 400 g), em que a foto do Cosmos foi aprovada na qualificação mas bloqueada pelo recorte determinístico.

## Decisão de produto

O projeto deixa de recortar fundo branco por código. A remoção de fundo passa a ser feita exclusivamente pela Kie, acionada pelo operador.

O motivo não é o defeito encontrado, e sim o limite do método: um recorte determinístico resolve uma lata cilíndrica em fundo branco, mas não resolve embalagem transparente, produto com relevo, sacaria, garrafa com líquido colorido ou rótulo que encosta na borda. Corrigir o recorte caso a caso seria perseguir um alvo que não se fecha.

Esta decisão substitui a regra anterior registrada em `CONTEXTO_ATUAL.md`: *"Foto com fundo branco passa por recorte determinístico no navegador"*.

### O que motivou

O recorte reprovou a foto do Cosmos com "O recorte dividiu a embalagem em partes desconexas". A medição mostrou que a lata estava **inteira**: o maior componente tinha 444.938 px, ou 99,6% do produto. O que reprovou foi a contagem de 203 componentes, sendo 202 deles cacos de antisserrilhado de 30 a 62 px, produzidos pelo ringing do JPEG de 500 px amplificado pela ampliação de 2× que o recorte aplica antes de processar.

Esse caminho — JPEG opaco em fundo branco — só foi exercitado agora, porque a foto do Cosmos era barrada antes, na qualificação, e porque PNG com alfa pula o recorte inteiro por `preservedTransparency`.

## Limites deste corte

Não entra: arraste e reposicionamento da embalagem (tem plano próprio em `plans/2026-09-06-arraste-restrito-da-embalagem.md`), acionamento automático da Kie, Feed 4/8, Story 4/8, mudança de schema remoto, autenticação e publicação social.

A Kie continua **não validada visualmente**. Este corte amplia onde ela pode ser acionada; não a promove a aprovada. A regra de conferência humana do resultado permanece.

## Arquitetura

Hoje `removeSelectedWhiteBackground` acumula duas responsabilidades: recortar o fundo e medir a geometria de ancoragem. Só a segunda sobrevive.

### Unidade nova: medição de posicionamento

`measureProductPlacement(url, options)` em `src/images/processingClient.ts`, substituindo `removeSelectedWhiteBackground`. Carrega a imagem, mede e devolve `ProductImageGeometry`. **Não modifica nenhum pixel.**

A medição escolhe o critério pela presença de alfa na imagem:

- **imagem com alfa** (resultado da Kie, PNG transparente): `visibleAlphaBounds`, sem mudança de comportamento;
- **imagem opaca**: `visibleContentBounds`, função nova em `src/images/cutout.ts`, que devolve a caixa do conteúdo não branco.

`hasIntrinsicContactShadow` continua sendo medido por `hasSoftContactShadow` apenas em imagem com alfa. Imagem opaca não tem sombra transparente a detectar e devolve `false`.

Medir uma caixa é uma operação muito mais tolerante que produzir uma máscara alfa: no pior caso erra alguns pixels de margem, nunca "parte a embalagem". É isso que a torna adequada a produto complexo.

#### Contrato de `visibleContentBounds`

Entrada: `RgbaImage`. Saída: `VisibleAlphaBounds | undefined`.

Um pixel conta como conteúdo quando `min(r,g,b) < 232`, o mesmo limiar já validado em `qualification.worker.ts` para separar ringing de JPEG (piso de ruído medido em 241) de produto real. Para não deixar um respingo isolado esticar a caixa, uma linha ou coluna só entra nos limites quando contém pelo menos 3 pixels de conteúdo. Imagem sem conteúdo devolve `undefined`, e o chamador trata como falha de medição.

### O que é removido

`removeWhiteBackground`, `cutoutQualityError` e o tipo `CutoutResult`. Com eles saem as funções internas que só existiam para o recorte: `countForegroundComponents`, `sobel`, `luminance`, `saturation`, `stats`, `borderIndices`, o tipo `Stats` e o tipo `BackgroundProfile`. Nenhuma delas tem outro chamador. Os testes correspondentes em `cutout.test.ts` saem junto.

`PRODUCT_ALPHA_THRESHOLD` permanece, porque `visibleAlphaBounds` e `hasSoftContactShadow` dependem dele.

Somem com isso os quatro portões do recorte: "O fundo não ficou distinguível da embalagem", "O recorte removeu conteúdo demais da embalagem", "O recorte dividiu a embalagem em partes desconexas" e "Dimensões inválidas para recorte da imagem".

`src/images/processing.worker.ts` deixa de recortar e passa a só medir. Ele continua existindo porque a medição varre a imagem inteira e não deve travar a interface.

Permanecem em `cutout.ts`: `visibleAlphaBounds`, `hasSoftContactShadow`, `visibleContentBounds` e os tipos `RgbaImage`, `VisibleAlphaBounds` e `ProductImageGeometry`. O arquivo deixa de ser sobre recorte e passa a ser sobre medição; renomeá-lo fica fora deste corte para não espalhar o diff.

## Fluxo do operador

1. O operador clica no candidato da busca. A foto vai **direto** ao cartaz, com o fundo branco que tiver, ancorada pela silhueta medida. Nenhuma chamada externa acontece nesse clique.
2. O botão **"Remover fundo com Kie"** fica disponível para qualquer foto presente no cartaz, venha ela do EAN/GTIN ou de upload manual. Hoje o gate é `Boolean(manualImageFile)` em `App.tsx`; passa a ser a existência de foto selecionada.
3. A Kie devolve um PNG transparente, que entra como **candidato para revisão**, com "Usar resultado" e "Descartar resultado". A foto original permanece disponível.
4. Ao aprovar, a geometria é medida de novo sobre o PNG transparente.

Como a medição antes e depois enquadra a mesma silhueta, o produto não salta de posição quando o fundo sai.

Clicar e desmarcar o produto não consome nenhuma chamada da Kie, porque o clique não a aciona.

### Kie a partir de foto da busca

`requestKieBackgroundRemoval` recebe hoje uma `data URL` produzida por `fileAsKieDataUrl(File)`. Para foto vinda da busca, a imagem é obtida pelo proxy local `/api/product-image/...` e convertida em `data URL` pelo mesmo caminho.

O limite de 5 MB já aplicado ao upload manual vale igualmente aqui. Nada da foto da busca é enviado à Kie sem o clique explícito do operador.

## Erros

- Falha, recusa ou demora da Kie não pode perder a foto original nem esvaziar o cartaz: a foto com fundo branco permanece exatamente onde está, e o erro aparece como aviso.
- Falha de medição (`undefined`) mantém a foto anterior no cartaz e informa que a embalagem não pôde ser localizada. Não existe fallback silencioso.
- Selecionar outro produto ou trocar a foto cancela um processamento em andamento, como já ocorre hoje via `AbortController`.

## Estado visual intermediário

Entre o clique e a remoção do fundo, o cartaz mostra a embalagem dentro de um retângulo branco sobre o fundo amarelo. Isso é deliberado e informativo: comunica que a foto ainda tem fundo. Não é estado de exportação, e a conferência do operador continua sendo o portão que libera o arquivo final.

## Testes

- `visibleContentBounds` mede a caixa de um produto opaco em fundo branco, ignorando ruído de compressão na borda.
- `visibleContentBounds` devolve `undefined` para imagem inteiramente branca.
- `measureProductPlacement` usa alfa quando a imagem tem canal alfa e conteúdo quando ela é opaca.
- A caixa medida em fundo branco e a medida no PNG transparente da mesma embalagem enquadram a mesma silhueta, provando que o produto não salta.
- O componente de embalagem não oferece remoção de fundo quando a foto já está sem fundo.

Três propriedades ficam na verificação manual, não em teste automatizado:

- o botão aparecer para foto vinda da busca;
- falha da Kie preservar a foto original no cartaz;
- seleção de produto não disparar chamada à Kie.

As três dependem de seleção de produto com rede, `createImageBitmap` e Web Worker, que não rodam em jsdom. Um teste desses validaria o aparato de mocks, não o produto. O roteiro manual do plano cobre as três, e o passo que confere o contador em `/api/cosmos/status` antes e depois da seleção é o que prova a terceira.

## Critério de conclusão

O GTIN `7891000053508` pode ser buscado, o produto selecionado, a foto do Cosmos aparece no cartaz com fundo branco e ancorada no pedestal, o operador aciona a Kie, confere o PNG transparente e o aprova, e a embalagem permanece na mesma posição depois da troca.
