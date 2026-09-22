# Plano de implementação — arraste restrito da embalagem

**Data:** 6 de setembro de 2026  
**Estado:** Story/1 validado pelo usuário; Feed/1 implementado em 7 de setembro com limites próprios, aguardando aceite visual
**Escopo:** permitir que o operador arraste diretamente a imagem aprovada de um produto no Story/1, sem transformar o aplicativo em editor livre. O Feed/1 será tratado somente depois do aceite visual do Story.

## Recorte aprovado em 7 de setembro de 2026

- Implementar, testar e calibrar primeiro o Story/1.
- Não alterar o Feed/1 neste corte e não replicar coordenadas do Story nele.
- Preparar o mecanismo sem consultas a Open Food Facts, Cosmos ou Kie.
- A validação visual final será feita pelo usuário na prévia; os testes automatizados cobrem geometria, interação, estado e fidelidade da exportação.

## Registro de execução — 7 de setembro de 2026

- O arraste básico por mouse funcionou no teste visual do usuário.
- A falha inicial ocorreu porque a foto substituída manualmente não tinha geometria medida e, portanto, não recebia o alvo de Pointer Events. O componente passou a usar a caixa da imagem como fallback.
- Para esse fallback, o topo foi calibrado entre `y=755.05615234375` e `y=1144.6849365234375`. A regra foi implementada, mas ainda precisa do reteste visual do usuário; o eixo horizontal permanece limitado pelo Story neste primeiro corte.
- Ainda não foi decidido se a interação final será arraste direto, clique para liberar ou ajuste por setas. Nenhuma dessas alternativas deve ser antecipada antes do teste.
- Feed não foi alterado.

## Registro de execução — Feed/1, 7 de setembro de 2026

O usuário deu o Story por validado e pediu o mesmo mecanismo no Feed. O corte foi
exatamente o arraste: a ordem das camadas do Feed já estava correta desde 6 de
setembro — placa e ponta vermelha são desenhadas depois do produto.

- `FEED_PRODUCT_STAGE` passou a declarar `minVisibleLeft=407`, `minVisibleTop=332`,
  `maxVisibleRight=737`, `maxVisibleBottom=1113` e a faixa do fallback `488..773`.
  Nenhum número veio do Story: cada limite é o conceito aceito lá, recalculado
  contra a arte do Feed pelas escalas do próprio palco (`220/330` e `380/520`).
- `FeedPoster` passou a usar `DraggableProduct`, com a sombra acompanhando o eixo
  horizontal e permanecendo na linha do pedestal.
- `App` guarda um deslocamento por formato, zera os dois na troca de produto/foto
  e invalida a confirmação de revisão ao fim de cada arraste.
- **Correção fora do arraste, pedida pelo usuário no mesmo pedido:** a extensão
  vermelha da placa do Feed pintava sobre a moldura prateada. A abertura interna
  foi medida no PNG de fundo — laterais em `x=203,5` e `x=417,5`, topo caindo de
  `665,5` a `667,5` e base de `954,5` a `956,5` — e a extensão passou a nascer
  dentro dela e a ser recortada por `#feed-sign-inner`. A mesma medição mostrou
  que o Story ultrapassa ~4,5 px pela direita; ficou registrado e não foi alterado,
  porque o Story já estava validado.
- Suíte com 30 arquivos e 227 testes, mais o build. O aceite visual com foto real
  no Feed continua com o usuário.

## Decisão de produto registrada

O posicionamento automático por silhueta alfa permanece a regra inicial. Após uma embalagem aprovada entrar no cartaz, o operador pode corrigi-la com gesto de mouse ou toque, dentro dos limites definidos pelo layout. A exceção está registrada na especificação e no contexto do projeto.

O corte não inclui redimensionamento, rotação, recorte, seleção de camadas, alteração de texto/preço/unidade, arraste de identidade visual, snapping, guias editáveis, multi-seleção, histórico de desfazer ou mudança de schema remoto. Não consulta Cosmos, Open Food Facts ou Kie durante o arraste.

## Resultado esperado

1. A imagem aprovada começa na posição automática atual, calculada pela silhueta e pela linha do pedestal.
2. Ao pressionar a embalagem e mover o ponteiro além do limiar de clique, o produto acompanha o gesto de forma fluida no preview responsivo.
3. A silhueta visível nunca passa abaixo do pedestal, pela direita do palco ou acima do teto seguro do layout.
4. À esquerda, a silhueta pode invadir somente a faixa de sobreposição explicitamente definida. Essa invasão fica atrás da placa e dos dados comerciais.
5. Soltar o ponteiro preserva apenas a posição válida; cancelar o gesto devolve a posição anterior.
6. Trocar a imagem ou selecionar outro produto restaura o posicionamento automático.
7. Preview e PNG usam o mesmo `placement` no SVG; o PDF do Story deriva desse mesmo SVG.

## Modelo e limites

Criar em `src/domain/productPlacement.ts` um modelo de domínio independente de React:

```ts
type ProductPlacement = {
  offsetX: number
  offsetY: number
}
```

`offsetX` e `offsetY` são coordenadas do SVG, aplicadas sobre a posição automática. Uma função pura recebe a geometria alfa, a posição automática, o deslocamento pretendido e os limites do palco; ela devolve o deslocamento limitado. A função calcula as bordas da silhueta após a escala atual — não as bordas do arquivo PNG.

`STORY_PRODUCT_STAGE` e `FEED_PRODUCT_STAGE` passam a declarar seus limites explícitos: teto, borda direita, linha do pedestal e limite esquerdo de sobreposição. Os valores serão calibrados contra os fundos já aprovados e cobertos por testes de geometria; os limites do Feed permanecem independentes dos do Story.

Durante este corte, o `ProductPlacement` permanece no estado em memória de `App`, porque a persistência de campanhas ainda não está ligada. O plano de persistência deverá adicionar o mesmo valor ao item/snapshot da campanha antes de declarar retomada e exportação auditável concluídas.

## Interação por ponteiro

Criar `src/components/DraggableProduct.tsx`, responsável apenas pela interação e pela conversão de coordenadas. Ele recebe posição calculada, limites, geometria e callbacks; `StoryPoster` e `FeedPoster` continuam donos da composição SVG.

1. Inserir um alvo de ponteiro transparente alinhado à bounding box alfa da embalagem. Ele aparece somente quando existe uma imagem aprovada e fica abaixo da placa para que a região mascarada não capture indevidamente o gesto.
2. Em `pointerdown`, registrar coordenada inicial convertida com `SVGPoint` e `getScreenCTM().inverse()`, o deslocamento vigente e capturar o ponteiro no SVG.
3. Só iniciar o arraste após 3 px de deslocamento de tela, preservando o clique simples e evitando saltos.
4. Em `pointermove`, converter novamente para coordenadas do SVG, somar o delta ao deslocamento inicial e chamar a função pura de limitação. Agendar a atualização visual por `requestAnimationFrame`, no máximo uma vez por frame.
5. Em `pointerup`, liberar a captura e confirmar o último `placement` limitado. Em `pointercancel` ou perda de captura, liberar o ponteiro e restaurar o valor que existia antes do gesto.
6. Aplicar `touch-action: none` ao alvo, cursor `grab` em repouso e `grabbing` durante o gesto. O mesmo fluxo atende mouse e toque; não usar a API HTML de drag-and-drop.

## Composição e camadas

Os dois posters receberão uma prop opcional `productPlacement`. Eles a aplicam à posição do produto e preservam o comportamento automático quando a prop estiver ausente. A sombra acompanha o deslocamento horizontal, mas continua apoiada na linha do pedestal: se o produto for elevado, a distância visual até a sombra comunica essa elevação em vez de fazer uma "sombra de contato" flutuar junto com a embalagem.

A ordem de desenho deve ser, sem exceção: fundo/pedestal, sombra, produto arrastável, extensão da placa, dados comerciais. O Story já coloca a placa após a imagem; no Feed a extensão vermelha deve ser movida para depois do produto. Assim, a sobreposição à esquerda é ocultada pela placa, e nome, apresentação e preços continuam na camada superior.

`App.tsx` mantém um placement por formato (`story` e `feed`), zera ambos na troca de produto/foto e invalida a confirmação de revisão sempre que o operador conclui um arraste. A mudança de formato mostra e edita somente a posição correspondente àquele SVG.

## Arquivos e testes

- `src/domain/productPlacement.ts` e `src/domain/productPlacement.test.ts`: converter geometria em limites da silhueta, limitar cada lado, manter a posição automática válida e tratar geometria ausente.
- `src/domain/storyLayout.ts`, `src/domain/feedLayout.ts` e testes: declarar limites de arraste independentes e fazer sombra/posição usarem o placement final.
- `src/components/DraggableProduct.tsx` e teste: limiar de 3 px, conversão para SVG, captura/liberação, `pointercancel`, atualização em RAF e callbacks finais.
- `src/components/StoryPoster.tsx` e `src/components/FeedPoster.tsx`, com testes: imagem e sombra recebem o placement; placa e textos aparecem depois da imagem em ambos os SVGs; o retângulo de interação não entra na exportação.
- `src/app/App.tsx` e `src/app/App.test.tsx`: o placement é separado por formato, zera ao trocar produto/foto, invalida confirmação e chega ao poster selecionado.
- `src/styles.css`: cursor, `touch-action` e indicação visual de seleção sem alterar a arte exportada.
- `docs/CONTEXTO_ATUAL.md`: registrar os valores finais calibrados e o resultado do teste visual com imagens reais.

## Critérios de aceite

- Arrastar uma garrafa, caixa, pote, cartela de iogurte e embalagem fatiada é contínuo em desktop e toque; nenhum requer setas ou campo numérico.
- Tentar passar abaixo do pedestal, além da direita ou acima do teto mantém a silhueta exatamente na borda permitida.
- A pequena invasão à esquerda nunca cobre nome, unidade, preço atual ou anterior, no Story nem no Feed.
- Margem transparente irregular não altera os limites percebidos; a limitação usa a silhueta alfa.
- Um clique sem deslocamento não muda a posição; cancelar o toque/mouse não persiste deslocamento parcial.
- Selecionar outra foto ou outro produto volta ao encaixe automático.
- O SVG serializado para PNG/PDF contém o mesmo `placement` visto na tela e não contém alvo de interação, cursor ou contorno de edição.
- Todos os testes existentes e os novos passam com `npm test` e o build passa com `npm run build`.
- Antes de encerrar, conferir visualmente uma foto real sem reiniciar ou recarregar o Vite enquanto existir rascunho em edição.

## Dependências e parada

Este plano não adiciona pacote nem copia código do OpenPencil. Ele aplica apenas o padrão pesquisado: captura de ponteiro, limiar de arraste, prévia transitória e confirmação final. Se os limites não puderem proteger simultaneamente o pedestal, a placa e o título para uma embalagem validada, o corte para e a foto é tratada como inadequada; não se amplia a área nem se adiciona editor livre como contorno.
