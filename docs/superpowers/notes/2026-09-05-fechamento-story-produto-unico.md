# Fechamento da sessão — Story de produto único

**Data:** 5 de setembro de 2026  
**Estado:** registro de continuidade; decisões visuais validadas e experimento técnico em andamento  
**Escopo canônico preservado:** este documento não inclui busca automática de imagens no MVP oficial

## O que foi construído hoje

- Aplicação React, TypeScript e Vite executando em `localhost` na porta `4173`.
- Área de preenchimento fixa no lado esquerdo e prévia ao vivo do Story no lado direito.
- Nenhum modal ou pop-up para editar a oferta.
- Template de Story com `1080 × 1920` pixels.
- Fundo do PSD exportado sem o produto demonstrativo para permitir a troca da embalagem.
- Nome, peso, preço promocional e preço anterior opcional renderizados dinamicamente no SVG.
- Exportação do mesmo SVG da prévia para PNG.
- Fonte Komika Axis incorporada ao projeto e também embutida durante a exportação.
- Validação de preço, peso, nome e preço anterior.
- Confirmação explícita de produto, peso e preços antes de liberar o download.
- Busca experimental por nome usando o índice Search-a-licious do Open Food Facts.
- Exibição de até 33 candidatos e associação manual da embalagem escolhida ao Story.

## Direção da interface

- Painel de operação neutro, predominantemente branco e preto.
- Linguagem editorial, alto contraste, bastante respiro e divisores discretos.
- Amarelo e vermelho pertencem à arte promocional; não devem dominar os controles.
- Os campos ficam permanentemente à esquerda e alteram imediatamente a arte à direita.
- O operador altera dados comerciais, mas não move, redimensiona ou estiliza livremente os elementos.

## Fonte e tipografia da placa

- Fonte escolhida e aprovada para a placa: **Komika Axis**.
- Arquivo incorporado: `public/fonts/KomikaAxis-Regular.ttf`.
- A tipografia do nome do produto foi considerada satisfatória depois da troca.
- O tamanho dos demais elementos foi ajustado para ocupar melhor a placa e preservar a hierarquia.

## Contrato aprovado para o nome do produto

- Limite visual: **9 letras ou números por linha**.
- Máximo: **3 linhas**.
- Espaços e pontuação não entram na contagem de letras e números.
- O sistema tenta preservar palavras inteiras; palavras maiores que o limite precisam ser divididas.
- Limite total atual do campo: 27 letras ou números.
- Conteúdo que exceder o contrato deve gerar correção no formulário; não deve ser truncado silenciosamente.

## Três estados visuais validados

### Estado 1 — uma linha

Referência testada: `NESCAU 2.0`.

- Nome centralizado na área vermelha.
- Peso grande e centralizado abaixo do nome, ainda sobre o vermelho.
- Este é o estado para nomes que cabem confortavelmente em uma linha.

### Estado 2 — duas linhas

Referência testada: `LEITE E / BITURUNA`.

- Duas linhas com espaçamento maior entre elas do que na primeira tentativa.
- Peso permanece centralizado abaixo do nome.
- O peso é menor que no estado de uma linha para aproveitar o espaço sem disputar com a descrição.
- A distribuição final observada foi aprovada pelo usuário.

### Estado 3 — três linhas

Referência testada: `LEITE / IBITURUNA / E ITAMBÉ`.

- As três linhas descem e ocupam melhor a área vermelha.
- A terceira linha é um pouco menor.
- O peso deixa a área central, fica menor e passa para o canto inferior direito, sobre a região amarela.
- O peso foi deslocado para a direita para não competir com as três linhas.
- A distribuição final observada foi aprovada pelo usuário.

## Preço anterior riscado

- Continua opcional e só aparece quando o operador ativa a comparação.
- Deve ser menor que o preço promocional.
- Ajuste visual aprovado ao final da sessão: mais à esquerda, um pouco menor e um pouco mais acima.
- Posição técnica atual no SVG: `x=240`, `y=1236`, tamanho `27`.

## Preço promocional

- Continua sendo o elemento comercial de maior destaque da placa.
- Inteiro e centavos possuem escalas independentes.
- O tamanho se adapta à quantidade de dígitos para reduzir colisões.
- Valores monetários são mantidos internamente em centavos e formatados em `pt-BR`.

## Produto e imagem

- O Nescau fixo foi retirado do fundo do template.
- Enquanto nenhuma embalagem for selecionada, o espaço de produto fica vazio.
- A imagem escolhida na pesquisa aparece no slot controlado do produto, sem edição livre.
- A associação produto–imagem–peso deve continuar sendo confirmada pelo operador.

## Resultado do teste de busca

- A pesquisa textual funcionou e respondeu rapidamente.
- O limite experimental de 33 resultados foi atingido em testes.
- O resultado comprovou a viabilidade de consultar um índice externo por nome.
- O resultado também comprovou que volume não significa qualidade: apareceram fotos de ambiente, mãos, produtos diferentes, imagens de verso e código de barras.
- O Open Food Facts entrega as imagens frontais processadas como JPEG; trocar a extensão para PNG não disponibiliza um arquivo transparente.
- Consequentemente, essa fonte não atende ao contrato final da galeria.

## Regra obrigatória para a imagem final

Todas as imagens de produto utilizadas na arte devem:

- ser arquivos PNG reais;
- possuir canal alfa;
- conter transparência real ao redor da embalagem;
- mostrar a embalagem completa, sem corte nas bordas;
- corresponder à marca, apresentação, peso e versão comercial escolhidos;
- não mostrar mãos, ambiente, gôndola, verso, código de barras ou rótulo isolado;
- passar por confirmação humana antes de entrar no catálogo aprovado.

Um PNG com fundo branco sólido não atende à regra. Alterar somente a extensão do arquivo também não atende. O projeto não fará remoção automática de fundo no MVP.

## Aprendizado sobre fontes oficiais

Não foi identificada uma API pública e gratuita que garanta simultaneamente:

1. identidade oficial do produto;
2. embalagem atual e correspondente ao SKU;
3. arquivo PNG;
4. fundo transparente real;
5. cobertura ampla de produtos de mercearia brasileira.

Fontes estruturadas e comerciais que merecem teste posterior:

- GS1 Brasil e GDSN, usando GTIN/EAN e acesso contratado;
- NIQ Brandbank;
- Syndigo;
- Open Icecat para uma prova de cobertura inicial.

Mesmo nessas fontes, PNG transparente precisa ser validado arquivo por arquivo e não deve ser presumido.

## Decisão recomendada para o MVP

- Manter dez produtos locais preparados e aprovados manualmente, conforme a especificação.
- Tratar a busca externa atual como bancada experimental, não como funcionalidade aprovada do MVP.
- Salvar uma embalagem aprovada no catálogo local para que ela não precise ser pesquisada novamente.
- Priorizar arquivos fornecidos por fabricante, distribuidor ou pelo próprio supermercado.
- Registrar procedência e autorização de uso de cada imagem.

## Pendências para a próxima sessão

### Story de produto único

- Conferir novamente os três estados com nomes reais adicionais, especialmente palavras largas apesar de possuírem até 9 caracteres.
- Definir se o limite deve considerar somente quantidade de caracteres ou também largura tipográfica medida.
- Testar preços extremos e pesos de mais dígitos em cada um dos três estados.
- Conferir estado sem preço anterior e estado com preço anterior.
- Validar visualmente o PNG exportado, não apenas a prévia.
- Verificar se o produto selecionado precisa de regras diferentes de escala para embalagem alta, larga e pequena.
- Decidir se a placa e o restante do layout do Story serão redesenhados no Photoshop antes da consolidação.
- Avaliar a retirada do carrinho e eventual redistribuição do espaço, ideia levantada mas não fechada.

### Busca e catálogo de produtos

- Decidir se o protótipo de busca permanece visível enquanto o layout é validado.
- Não promover o Open Food Facts a fonte final de imagens.
- Se houver interesse, testar Open Icecat com uma lista pequena de EANs reais.
- Medir cobertura brasileira, atualidade da embalagem, MIME, canal alfa, resolução e termos de uso.
- Avaliar GS1 Brasil, GDSN, NIQ Brandbank ou Syndigo somente como iniciativa posterior/comercial.
- Definir o processo operacional de entrada de um produto novo no catálogo local.
- Definir quantas imagens confiáveis devem ser apresentadas; para um SKU exato, a expectativa realista é de poucas imagens oficiais, não 33.

### Continuidade do produto

- Depois da aprovação do Story de um produto, criar estados de 4 e 8 produtos.
- Criar o Feed usando o mesmo contrato de dados, mas coordenadas próprias.
- Resolver a proporção do Feed: o PSD disponível é quadrado, enquanto a especificação define `1080 × 1350`.
- Manter identidade, catálogo, campanha e regras de layout separados.
- Consolidar o SVG parametrizado como fonte única de prévia e exportação.

## Ponto exato de retomada

Na próxima sessão, abrir `http://127.0.0.1:4173/`, revisar rapidamente os três estados já validados e escolher uma destas frentes:

1. consolidar e testar o Story de produto único com imagens locais aprovadas; ou
2. fazer um teste separado de cobertura do Open Icecat com EANs reais, sem alterar o escopo canônico do MVP.

Não recomeçar o desenho da placa do zero sem antes conferir este registro e os tokens atuais em `src/domain/storyLayout.ts`.
