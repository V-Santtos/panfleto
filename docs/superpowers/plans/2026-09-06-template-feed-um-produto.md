# Plano de implementação — template de Feed para um produto

**Data:** 6 de setembro de 2026  
**Estado:** implementação local concluída em 6 de setembro de 2026; ativação persistida pendente da conclusão da camada de ativos do Supabase  
**Escopo:** tornar funcional a composição de **Feed vertical (1080 × 1350) para um produto** a partir do PSD fornecido, preservando o Story/1 já validado.

## Objetivo e limites

O Feed será uma composição SVG independente. Ele compartilhará o mesmo `Offer`, a imagem aprovada e as regras comerciais do Story, mas terá fundo, coordenadas, área segura, placa e tipografia próprios. Não será um recorte, uma escala ou uma reutilização das coordenadas do Story.

Este corte não implementa Feed 4/8, Story 4/8, editor livre, novos temas, busca externa, mudanças de schema, autenticação ou publicação social. Também não fará consulta Cosmos/Kie durante a validação visual.

## Referência aprovada para preparação

O arquivo fornecido `D:/daily-offers-retail-promotion-with-3d-product-shopping-cart/feed.psd` é um PSD RGB de 1080 × 1350 px. Sua composição contém fundo amarelo, logo/título, faixa vermelha, painel de preço vazio, carrinhos e pedestal. Esses elementos são fixos; produto, nome, unidade, preço promocional e preço anterior serão inseridos pelo SVG.

O fundo de execução será um PNG local, derivado do PSD em sua versão com a placa vazia. O PSD permanece apenas como ativo de referência: o navegador nunca o lê diretamente.

## Contrato visual do Feed/1

- Canvas: `1080 × 1350`.
- Fonte da verdade: uma única árvore `FeedPoster` SVG usada pela prévia e pelo PNG.
- Produto: preserva proporção, respeita a silhueta alfa e ancora a base visível em uma linha do pedestal exclusiva do Feed; a sombra radial só aparece quando a imagem não possui sombra própria.
- Placa: nome, apresentação, preço atual e preço anterior ficam dentro do painel fixo; sem truncamento silencioso. O contrato terá estados explícitos de 1, 2 e 3 linhas e bloqueará conteúdo que não caiba.
- Preço: permanece em centavos, formatado em `pt-BR`; preço anterior só aparece quando é maior que o promocional.
- Ativos e fontes: qualquer ativo necessário para exportar é incorporado no SVG antes da rasterização, sem URL externa.

## Implementação em incrementos testáveis

1. Preparar o fundo local `public/templates/feed/single/feed-base-empty.png` a partir do PSD, mantendo o painel de dados vazio, e adicionar uma referência não executável do PSD em `assets/reference-templates/`.
2. Criar `src/domain/feedLayout.ts` e testes de geometria: área segura, linha de base, escala por bounding box alfa, sombra de contato e quebra de nome independente do Story.
3. Criar `src/components/FeedPoster.tsx` e testes: `viewBox` correto, dados comerciais, estados da placa, produto ancorado e regra da sombra.
4. Generalizar a rasterização de SVG em `src/export/svgToPng.ts` para ler as dimensões do SVG, sem alterar a geração do PDF vertical do Story. Adicionar testes de dimensões e de incorporação de ativos para Feed.
5. Integrar `FeedPoster` em `src/app/App.tsx`: o seletor Feed troca a prévia de verdade; a moldura e o rótulo passam a refletir 4:5; exportação PNG é vinculada ao SVG selecionado. PDF continua exclusivo do Story até existir uma decisão própria de produto.
6. Atualizar testes de integração do app, CSS responsivo e `docs/CONTEXTO_ATUAL.md`, deixando explícitos Feed/1 funcional e Feed 4/8 ainda pendentes.
7. Quando a persistência de ativos do plano Supabase estiver pronta e as credenciais locais estiverem configuradas, enviar fundo/fontes para o bucket privado, criar a versão imutável do template `feed + 1` e ativá-la por rota local. Esta etapa não cria schema nem altera permissões. **Pendente.**

## Casos de validação e aceite

- Executar testes unitários para nomes de 10, 30, 50 e 70 caracteres; preços `R$ 0,99`, `R$ 99,99`, `R$ 999,99` e `R$ 1.299,90`; unidades curtas e longas; preço anterior presente e ausente; imagens altas, largas e com margens transparentes.
- Conferir que Feed/1 tem `viewBox="0 0 1080 1350"` e que seu PNG é exportado com 1080 × 1350 px.
- Confirmar que o Feed não reutiliza `storyLayout.ts`, não modifica o SVG do Story e não dispara integrações externas.
- Validar manualmente a prévia local sem reiniciar ou recarregar uma campanha ativa, conferindo associação produto–imagem, nome, unidade, preço e validade.
- Executar `npm test` e `npm run build` ao fim de cada corte; a regressão do Story deve permanecer verde.

## Riscos e decisão de parada

Se o painel do PSD não acomodar o maior conteúdo aceito com legibilidade, o sistema exibirá erro de contrato e não exportará. Não haverá redução indefinida da fonte nem adaptação automática do layout. Se a camada de fundo não puder ser isolada fielmente do PSD, a implementação para antes de ativar Feed e solicita uma base limpa/exportada pelo designer.
