# Teste prático de busca de produtos

**Data:** 5 de setembro de 2026  
**Estado:** bancada experimental local; não amplia o escopo canônico do MVP

## Objetivo

Medir a busca de embalagens por nome e permitir que o operador compare variações antes de associar uma imagem ao produto único do Story.

## Fonte e chamada

- Fonte: Search-a-licious, índice público do Open Food Facts.
- Endpoint local: `/api/product-search`, encaminhado pelo Vite para `https://search.openfoodfacts.org/search`.
- Consulta: texto livre, idiomas `pt,en`, até 100 registros examinados.
- Saída: primeiras 33 ocorrências únicas que possuem `image_front_url`.
- Campos: EAN/código, nome, marcas, quantidade, miniatura e imagem frontal.

## Comportamento de segurança

- Nenhum candidato é escolhido automaticamente.
- A embalagem só entra no Story após clique explícito do operador.
- Nome, quantidade e imagem permanecem associados após a escolha.
- A galeria final só poderá exibir arquivos cujo MIME seja `image/png` e cujo canal alfa contenha transparência real.
- JPG, PNG opaco, foto de ambiente, mão segurando, produto deitado, verso, rótulo isolado e código de barras devem ser descartados antes da exibição.
- A descrição e a marca precisam corresponder aos termos pesquisados; resultados apenas aproximados não entram.
- Embalagem cortada ou encostada nas bordas também deve ser rejeitada.
- Mesmo após os filtros, embalagem antiga e peso divergente continuam exigindo conferência humana.
- A galeria é evidência exploratória; não substitui catálogo interno aprovado.

## Bloqueio encontrado

O Open Food Facts entrega suas imagens frontais processadas como `image/jpeg`. A mesma URL com extensão `.png` respondeu `404`. Portanto, essa fonte serve para metadados e descoberta por EAN, mas **não pode ser usada como provedora da galeria final de imagens**, pois não satisfaz o contrato de PNG transparente e o projeto não fará remoção automática de fundo.

## Medições iniciais

- Consulta direta por EAN do Nescau: `0,956 s`.
- Busca textual `nescau`: 63 registros, 50 com imagem; resposta em aproximadamente `0,99 s` via terminal.
- Busca textual `nescau` pela interface local: 33 fotos apresentadas em `0,76 s` na primeira execução observada.

Os tempos medem a resposta da busca. O carregamento visual das 33 miniaturas pode continuar por mais alguns instantes.

## Alternativas oficiais avaliadas

Não foi encontrada uma fonte universal, pública e gratuita que garanta produto oficial, embalagem atual e PNG com transparência real para todo o varejo alimentar brasileiro.

- **GS1 Brasil / GDSN:** caminho mais forte para identificar o SKU por GTIN/EAN e trocar dados autorizados entre parceiros. O acesso à API da GS1 Brasil exige credenciais e consultas como provedor dependem de contratação. A especificação de imagens da GS1 aceita PNG e transparência quando disponíveis, mas não garante esse formato para todos os produtos.
- **NIQ Brandbank e Syndigo:** redes comerciais de conteúdo e packshots para varejo. Precisam de negociação, confirmação de cobertura no Brasil e contrato para os ativos necessários.
- **Open Icecat:** possui integração por JSON, XML e outros formatos e oferece conteúdo autorizado por marcas participantes. É a alternativa mais simples para um teste inicial, mas cobertura de mercearia brasileira e PNG transparente precisam ser medidos, não presumidos.
- **Portais dos fabricantes e distribuidores:** podem ser a melhor origem para imagens oficiais, porém não existe uma API única; os acessos e formatos variam por marca.

Referências registradas:

- GS1 Brasil API CNP: https://portalapi.gs1br.org/pageApiCnp
- GS1 Product Image Sharing Guideline: https://www.gs1.org/sites/default/files/docs/gdsn/GS1_Product_Image_Sharing_Guideline.pdf
- Open Icecat para usuários de conteúdo: https://icecat.com/structured-data-content-users/
- Integrações do Icecat: https://icecat.com/integrations/
- NIQ Brandbank Imaging Solutions: https://nielseniq.com/global/cs/solutions/brandbank-imaging-solutions/

## Conclusão da sessão

- Não usar as 33 fotos do Open Food Facts como galeria final.
- Não converter JPEG em PNG para fingir transparência.
- Não usar remoção automática de fundo dentro do MVP.
- Para o MVP, manter um catálogo local pequeno com PNGs transparentes preparados e aprovados.
- Para uma fase posterior, pesquisar primeiro pelo EAN, mostrar poucas opções confiáveis, exigir aprovação humana e guardar localmente a escolha aprovada.
- Uma busca que retorna 33 fotos é útil para testar latência e interface, mas não representa um catálogo oficial: para um SKU exato, o resultado esperado é uma imagem principal e possivelmente poucos ângulos ou versões autorizadas.
