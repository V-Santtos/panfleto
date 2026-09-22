# Plano de implementação — qualificação de foto por fonte

**Data:** 17 de setembro de 2026  
**Estado:** concluído; testes, build e ensaio manual encerrados  
**Escopo:** manter o filtro de qualidade para fotos do Open Food Facts e tornar a avaliação visual das fotos do Cosmos consultiva, preservando os bloqueios técnicos e a escolha humana antes da Kie.

## Decisão aprovada

- O Open Food Facts é usado principalmente pelos metadados; sua foto continua sujeita ao filtro de qualidade.
- A maioria das fotos do Cosmos é comercialmente aproveitável e deve permanecer selecionável independentemente de fundo, enquadramento ou outros diagnósticos visuais.
- A imagem do Cosmos é uma entrada intermediária: pode ser selecionada e exibida no cartaz, e o operador usa **Remover fundo com Kie** quando precisar tratar o fundo.
- A Kie continua sendo acionada somente por clique explícito; seleção e qualificação não consomem crédito.
- Se nenhuma foto das fontes servir, o operador envia uma foto manual.
- Somente falhas técnicas da foto Cosmos bloqueiam seu uso: carregamento, GTIN, origem ou arquivo inválido.

## Arquivos previstos

- `src/components/ProductSearch.tsx`
- `src/components/ProductSearch.test.tsx`
- `docs/CONTEXTO_ATUAL.md` ao concluir o incremento

## Implementação

1. Manter a análise visual existente para todas as fotos, pois seus resultados ainda servem como diagnóstico.
2. Para Open Food Facts, continuar permitindo seleção somente quando a avaliação for aprovada.
3. Para Cosmos, permitir seleção sempre que a imagem carregar; os demais motivos de avaliação viram avisos e não desabilitam a opção.
4. Mostrar a miniatura Cosmos no card e preservar sua procedência na seleção.
5. Manter a Kie como ação explícita posterior à escolha da foto.
6. Não disparar Kie, Cosmos ou qualquer outra chamada externa em testes automatizados.

## Testes primeiro

- Mostra uma foto Cosmos como selecionável mesmo quando a avaliação contém `background` e `framing`.
- Mantém bloqueada uma foto Cosmos cuja avaliação contém `load`.
- Mantém bloqueada uma foto Open Food Facts reprovada pelos mesmos diagnósticos visuais.
- Preserva os avisos de qualidade sem rotular a foto Cosmos como “sem foto aprovada”.
- Selecionar a foto não chama a Kie; o botão explícito continua sendo o único gatilho.

## Validação

1. Executar testes direcionados de análise, qualificação, busca e seleção.
2. Executar `npm test` completo.
3. Executar `npm run build`.
4. Preservar a prévia atual durante a implementação; avisar antes de qualquer ação que possa desmontar o React.
5. Após a mudança, o usuário repete o EAN `7896877500919`, confirma que a foto do Cosmos aparece selecionável e valida visualmente o estado anterior à Kie.
6. Uma remoção real com a Kie só será executada mediante autorização explícita separada.

## Fora do escopo

- Remover fundo localmente por limiar de cor.
- Acionar a Kie automaticamente.
- Alterar regras de busca por nome, cota Cosmos, persistência ou exportação.

## Portão de implementação

O usuário aprovou a implementação em 17 de setembro de 2026. Foram executados os testes direcionados de busca e Kie, seguidos da suíte completa (**30 arquivos, 229 testes**) e do build de produção, todos aprovados. Nenhuma chamada Cosmos ou Kie foi disparada pelos testes. No ensaio manual, a foto Cosmos do EAN `7896877500919`, com fundo preto, apareceu selecionável e o recorte posterior da Kie foi concluído corretamente. O usuário encerrou esta rodada de validação em 17 de setembro.
