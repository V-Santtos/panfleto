# Aprendizados do template piloto de Feed

**Data:** 4 de setembro de 2026  
**Estado:** registro de sessão; não substitui a especificação canônica e não aprova implementação

## Objetivo da sessão

Validar a forma mais simples de transformar um template promocional desenhado no Photoshop em uma composição reutilizável no aplicativo, começando por uma oferta de produto único.

## Decisão central

O aplicativo não será um editor do template. Cada template é uma composição previamente desenhada, fechada e aprovada. Para gerar uma nova peça, o operador altera somente:

- a imagem do produto;
- o conteúdo da placa: descrição, preço, unidade e, quando aplicável, preço anterior ou desconto.

Logo, fundo, título 3D, faixa vermelha decorativa, setas, carrinho, pódio, cores, posições e demais elementos visuais permanecem fixos.

O template de Story será uma composição independente, mas deverá receber o mesmo contrato de dados do template de Feed. Não será produzido por corte ou esticamento automático do Feed.

## Estrutura mínima validada no PSD

O PSD piloto foi reorganizado em três grupos de nível superior:

1. `Fixo`: toda a composição que não muda entre ofertas;
2. `PEDESTAL FOR OFFER POSTER | (DOUBLE CLICK TO EDIT)`: placa vazia que receberá os textos dinâmicos;
3. `Produto`: imagem de exemplo, separada da composição fixa.

Para continuidade, os nomes poderão ser normalizados para `FIXO`, `PLACA_PRECO` e `PRODUTO`, mas isso não é requisito para compreender o arquivo atual.

## Papel do PSD e do SVG

- O PSD é a fonte de design e implantação do template.
- Elementos fixos podem ser rasterizados e incorporados ao SVG como imagens, sem necessidade de reconstrução vetorial.
- O SVG parametrizado continua sendo a fonte única de preview e exportação.
- Produto e textos da placa serão os parâmetros do SVG.
- Se algum elemento fixo precisar cobrir parte do produto, ele deverá existir como uma sobreposição fixa separada. Isso é detalhe interno e não cria liberdade de edição para o operador.

## Regras para o produto

- A imagem do produto deve ser tratada como um slot substituível.
- A máscara usada na lata de Nescau é específica daquele exemplo e não deve virar uma máscara genérica do template.
- Os dez produtos do MVP deverão possuir imagens previamente preparadas, preferencialmente PNG transparente.
- O MVP não fará remoção automática de fundo.
- O layout poderá aplicar apenas regras controladas de encaixe, escala e posicionamento dentro da área reservada.

## Regras para a placa

- A estrutura gráfica da placa permanece fixa.
- Descrição, preço, unidade e preço anterior opcional serão renderizados pelo sistema.
- Limites de linhas, comprimento e tamanho mínimo de fonte devem fazer parte do contrato do template.
- O sistema deve rejeitar conteúdo que não caiba, em vez de truncar ou reduzir indefinidamente.

## Aprendizados sobre arquivos de referência

- Um PSD organizado em camadas não significa que todos os elementos sejam internamente editáveis. Alguns objetos inteligentes podem conter apenas uma imagem achatada.
- A imagem promocional da página de download pode mostrar ativos que não estão incluídos no PSD. No arquivo original analisado, a embalagem de exemplo aparecia no JPG de referência, mas o PSD continha somente um placeholder.
- Ajustes do Photoshop, máscaras e modos de mesclagem precisam ser conferidos contra uma imagem final de referência. Um ajuste de níveis chamado `SHADOW`, aplicado por máscara elíptica, criou uma forma circular indesejada na primeira extração do fundo.
- Não se deve improvisar ou reinterpretar o design durante a conversão. Primeiro deve ser obtida fidelidade visual; somente depois entram as partes dinâmicas.
- Alterações devem ser mostradas em passos mínimos e verificadas antes de serem apresentadas.

## Pacote recomendado por template

- PSD final com a estrutura combinada;
- PNG ou JPG final de referência;
- imagens dos produtos separadas;
- fontes usadas nos textos dinâmicos ou substitutas aprovadas;
- informação de licença dos ativos.

Exportações transparentes adicionais só serão solicitadas quando um elemento do PSD não puder ser reproduzido com fidelidade suficiente.

## Ponto em aberto

O PSD piloto atual é quadrado, com `2200 × 2200` pixels, enquanto a especificação canônica define Feed vertical em `1080 × 1350`. Antes do plano de implementação, será necessário escolher explicitamente uma destas opções:

- adaptar o design aprovado para `1080 × 1350`; ou
- revisar a especificação para adotar Feed quadrado.

Não cortar, esticar ou alterar a proporção silenciosamente.

## Ideia para uma fase posterior: aquisição assistida de imagens

Esta hipótese não faz parte do MVP atual. Ela deverá ser avaliada somente depois que o aplicativo de ofertas estiver validado.

O supermercado poderá fornecer sua base real de produtos. A limpeza dos nomes ajudará na pesquisa, mas o EAN deverá ser preservado sempre que estiver disponível, pois ele é um identificador muito mais seguro do que a descrição textual.

Fluxo proposto:

1. consultar primeiro o catálogo interno de imagens já aprovadas;
2. quando não houver imagem, consultar bases estruturadas pelo EAN;
3. pesquisar páginas e imagens externas usando o EAN e a descrição normalizada;
4. apresentar uma galeria de embalagens candidatas, sem escolher silenciosamente uma delas;
5. exigir que o operador confirme qual embalagem corresponde ao produto vendido pela loja;
6. validar formato, resolução, transparência, margens e integridade do arquivo;
7. salvar a escolha no catálogo interno para que o mesmo produto não precise ser pesquisado novamente.

A aprovação humana é necessária porque um mesmo produto pode aparecer na internet com embalagem antiga, edição especial, peso diferente ou apresentação semelhante. Mesmo um EAN correto pode estar associado a uma fotografia visualmente desatualizada.

### Simulação realizada com Nescau

A descrição inicial usada no teste foi `Nescau 2.0 Nestlé 420 g`. A pesquisa não encontrou uma correspondência confiável de 420 g e convergiu para o produto de 400 g, EAN `7891000053508`.

Uma página de supermercado associou explicitamente esse EAN a `NESTLÉ`, `NESCAU` e `400 g`, além de fornecer uma imagem PNG transparente. A inspeção automática do arquivo encontrou:

- dimensões de `397 × 600` pixels;
- canal alpha presente;
- borda 100% transparente;
- nenhuma necessidade técnica de remover fundo branco.

Apesar da correspondência dos dados, a embalagem encontrada era diferente da embalagem usada no template piloto. Portanto, o resultado não deveria ser aceito automaticamente. O comportamento correto seria informar a divergência de `420 g` para `400 g` e mostrar essa imagem junto de outras candidatas para escolha.

### Estratégia de desempenho

A pesquisa não precisa acontecer durante a criação de cada oferta. Ao importar a base do supermercado, as buscas poderão ser executadas antecipadamente em lote e os resultados ficarão aguardando revisão.

- imagens aprovadas abrem diretamente do cache local;
- miniaturas candidatas aparecem primeiro;
- o arquivo em resolução completa é baixado somente após a escolha;
- busca sob demanda fica reservada para produtos novos ou sem candidatos;
- chamadas independentes podem ocorrer em paralelo.

Na simulação, a consulta estruturada pelo EAN levou aproximadamente 1,4 segundo, a pesquisa de candidatos aproximadamente 3,5 segundos e a inspeção técnica da imagem menos de 1 segundo. Esses valores são apenas evidência exploratória, não uma meta de desempenho garantida.

### Papel eventual de inteligência artificial

Uma LLM não é necessária para executar a busca principal. Código convencional consegue normalizar termos, consultar APIs, comparar EAN, marca, peso, formato e resolução. Futuramente, um modelo de visão barato poderia apenas ordenar candidatos duvidosos ou detectar diferenças visuais, sem substituir a aprovação humana.

Também será necessário registrar a procedência de cada imagem e verificar autorização ou condições de uso. Fontes fornecidas por fabricantes, distribuidores e pelo próprio supermercado devem ter prioridade sobre imagens encontradas em varejistas.

## Próxima retomada

1. Resolver a proporção final do Feed.
2. Definir o conteúdo e a tipografia da placa de preço.
3. Produzir a referência aprovada do template de produto único para Feed.
4. Desenhar a versão correspondente para Story.
5. Atualizar e aprovar a especificação canônica.
6. Somente depois escrever o plano de implementação; nenhum código deve ser criado antes desses portões.
