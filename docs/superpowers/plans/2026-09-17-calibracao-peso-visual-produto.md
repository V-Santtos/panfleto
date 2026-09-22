# Plano de implementação — calibração do peso visual da embalagem

**Data:** 17 de setembro de 2026  
**Estado:** concluído; validação automatizada aprovada e rodada manual encerrada  
**Escopo:** padronizar a presença visual de embalagens horizontais, quadradas e verticais no Story/1 e no Feed/1 sem distorcer a foto nem permitir redimensionamento livre pelo operador.

## Problema observado

- A medição da silhueta do Danoninho funcionou: o resultado visível mede `330 × 233,89` no SVG do Story.
- A regra atual usa somente uma caixa máxima (`330 × 520` no Story). Como o Danoninho é horizontal, ele encosta primeiro no limite de largura e ocupa menos área visual que uma embalagem vertical.
- O Croques, por ser vertical, encosta primeiro no limite de altura e aparenta ser muito maior, embora as duas imagens tenham sido medidas corretamente.

## Regra proposta

1. Preservar a proporção original e continuar medindo somente a silhueta visível.
2. Dimensionar a embalagem por uma área visual-alvo, limitada pela largura e altura seguras de cada formato.
3. No Story, usar área-alvo de `135.200 px²`, largura máxima de `440 px` e altura máxima de `520 px`.
4. No Feed, usar área-alvo proporcional de `72.200 px²`, largura máxima de `298 px` e altura máxima de `380 px`.
5. Manter o encaixe da base no pedestal, a centralização automática, a sombra e os deslocamentos manuais existentes.
6. Produtos muito estreitos ou muito largos param no limite seguro antes de alcançar a área-alvo.
7. Não adicionar controle livre de escala para o operador.

## Resultado de referência

- Danoninho atual no Story: aproximadamente `330 × 234`.
- Danoninho após a calibração: aproximadamente `437 × 310`.
- Embalagem vertical de proporção `1:2`: aproximadamente `260 × 520`, preservando o comportamento visual já validado.
- Nenhuma silhueta automática ultrapassa os limites seguros do respectivo palco.

## Arquivos previstos

- `src/domain/productPlacement.ts` — função compartilhada para calcular a escala por área visual.
- `src/domain/productPlacement.test.ts` — casos-limite da função compartilhada.
- `src/domain/storyLayout.ts`
- `src/domain/storyLayout.test.ts`
- `src/domain/feedLayout.ts`
- `src/domain/feedLayout.test.ts`
- `docs/referencia/DECISOES.md` e `docs/CONTEXTO_ATUAL.md` após implementação e validação.

## Testes primeiro

1. Produto horizontal cresce até a área-alvo sem exceder a largura máxima.
2. Produto vertical preserva a altura máxima atual.
3. Produto quadrado recebe escala intermediária, sem preencher exageradamente toda a caixa.
4. Proporções extremas respeitam largura e altura máximas.
5. Margem transparente não altera a área nem o encaixe da silhueta.
6. Story e Feed usam a mesma regra, mas com calibrações próprias.
7. Base, centro, sombra e limites do arraste permanecem coerentes depois da nova escala.

## Validação

1. Executar os testes direcionados de `productPlacement`, `storyLayout`, `feedLayout`, `StoryPoster` e `FeedPoster`.
2. Executar a suíte completa.
3. Executar o build de produção.
4. Não disparar Cosmos nem Kie durante os testes.
5. Avisar antes da alteração de código, pois o HMR pode substituir a prévia viva atual.
6. Depois dos testes, o usuário valida visualmente o Danoninho e ao menos uma embalagem vertical no Story e no Feed.

## Fora do escopo

- Inferir dimensões físicas reais da embalagem.
- Alterar a remoção de fundo, a busca, a persistência ou as regras de preço/texto.
- Adicionar zoom, rotação ou escala manual.
- Alterar os limites inferiores do arraste, que continuam como decisão separada em aberto.

## Portão de implementação

O usuário aprovou explicitamente este plano em 17 de setembro de 2026. A implementação
foi concluída com **48/48 testes direcionados**, **30 arquivos e 236 testes** na suíte
completa e build de produção aprovado. Nenhuma chamada Cosmos ou Kie foi feita. O
usuário encerrou a rodada manual em 17 de setembro sem relatar nova pendência. A
comparação futura do Danoninho no Story/Feed com uma embalagem vertical fica como
conferência opcional, não como bloqueio deste incremento.
