# Plano de implementação — catálogo reutilizável, busca incremental e nova oferta

**Data:** 7 de setembro de 2026  
**Estado:** concluído; implementação local, migração remota e smoke da busca validados  
**Escopo:** consolidar o fluxo de um produto já validado como catálogo reutilizável, persistir somente produto e foto, permitir a atualização restrita do nome exibido no cartaz, melhorar a descoberta de produtos ativos e encerrar a oferta sem recarregar a aplicação.

## Decisões aprovadas que orientam este plano

- O Supabase guarda o catálogo de produtos e suas fotos aprovadas. Preços, preço anterior, tema, formato, confirmação e posição da embalagem permanecem temporários na memória do navegador.
- EAN/GTIN continua sendo a identidade única de um produto codificado. Uma nova oferta reutiliza a mesma linha e nunca cria outra linha para o mesmo código.
- `canonical_name` preserva o nome de referência do produto. Um novo `display_name` guarda o último nome aprovado pelo operador para aparecer no cartaz.
- Reutilizar um produto ativo pode atualizar somente `display_name`; não regrava preço, posição, apresentação, imagem ou origem quando esses dados não foram alterados.
- As tabelas de campanha já existentes permanecem no schema, mas `campaigns`, `campaign_items` e `campaign_exports` não serão ligadas ao aplicativo neste corte. Não haverá exclusão destrutiva de schema.
- **Criar nova oferta** aparece somente depois de uma exportação bem-sucedida, abaixo da confirmação de download. A ação limpa o rascunho, preserva tema e formato, leva a interface até a pesquisa e foca o campo.
- O cadastro manual fica visível, mas só pode ser aberto com a pesquisa vazia. Enquanto o formulário manual estiver aberto, a pesquisa normal fica indisponível.
- Produtos ativos do catálogo recebem borda verde, usando o mesmo token semântico do bullet **Já cadastrado**. O estado selecionado permanece distinguível sem trocar a borda para preto.
- A busca incremental começa a partir de dois caracteres de nome ou marca, mostra os produtos ativos com miniatura e nunca consulta Open Food Facts, Cosmos ou Kie.
- EAN/GTIN, inclusive completo, só pode acionar fontes externas por **Buscar** ou Enter. Digitação e debounce não consomem cota externa.

## Fora deste corte

- Persistência de preço, preço anterior, posição, tema, formato, confirmação, campanha ou exportação.
- Remoção ou modificação das tabelas de campanha existentes.
- Nova chamada à Kie ou alteração do relay da Kie.
- Consulta automática ao Cosmos ou ao Open Food Facts.
- Alteração das composições SVG, dos limites de arraste ou dos templates Story/Feed.
- Grades de 4 e 8 produtos.

## Resultado esperado

1. Digitar `NE` aguarda um debounce curto e mostra automaticamente produtos ativos cujo nome canônico, nome do cartaz ou marca correspondam à consulta.
2. Cada sugestão cadastrada exibe sua foto aprovada em miniatura e uma borda verde permanente.
3. Uma consulta numérica parcial não faz rede externa. Um EAN/GTIN completo também aguarda a ação explícita **Buscar** ou Enter antes de qualquer fallback externo.
4. Selecionar um produto cadastrado preenche o cartaz com seu `display_name` e sua imagem primária aprovada.
5. Editar o nome do cartaz e exportar atualiza somente `products.display_name` para o mesmo ID/EAN.
6. Repetir PNG ou PDF não duplica produto, ativo ou imagem e não apaga o rascunho atual.
7. Depois de um download bem-sucedido, **Criar nova oferta** limpa os dados temporários, preserva tema/formato e posiciona o foco na pesquisa.

## Incremento 1 — schema aditivo para o nome exibido

### Arquivos

- Criar `supabase/migrations/20260907xxxxxx_add_product_display_name.sql` com timestamp real no momento da implementação.
- Atualizar `supabase/tests/001_catalog_schema.sql`.

### Implementação

1. Não editar a migração inicial já aplicada.
2. Adicionar `products.display_name text` de forma aditiva.
3. Preencher produtos existentes com `canonical_name`, tornar a coluna obrigatória e adicionar validação de texto não vazio e comprimento máximo de 200 caracteres.
4. Atualizar `set_product_search_text()` para normalizar `canonical_name`, `display_name` e `brand_name`, mantendo todos pesquisáveis por `search_active_products`.
5. Fazer o trigger reagir a mudanças em `canonical_name`, `display_name` ou `brand_name`.
6. Preservar a restrição única `products_gtin_unique`; `display_name` nunca participa da identidade do produto.
7. Não criar coluna de preço, posição ou campanha.

### Testes primeiro

- A migração preenche `display_name` do Nescau e de qualquer produto existente sem alterar o ID, GTIN ou imagem.
- `display_name` vazio ou acima do limite é recusado.
- Atualizar `display_name` altera o texto pesquisável e não altera nome canônico, marca, apresentação, status ou GTIN.
- Busca parcial por `ne` encontra um produto ativo por nome canônico, nome exibido ou marca.
- Inserção concorrente ou repetida do mesmo GTIN continua bloqueada pela unicidade.
- RLS e privilégios do navegador continuam inalterados.

### Portão remoto

O histórico remoto da migração inicial foi aplicado pelo SQL Editor e ainda precisa ser reconciliado antes do próximo DDL. A migração aditiva deve ser validada localmente e aplicada ao projeto correto somente por um caminho de escrita controlado, sem imprimir a service role. Se a reconciliação não estiver disponível, parar antes da aplicação remota; não improvisar alteração manual não versionada.

## Incremento 2 — domínio e atualização restrita do nome

### Arquivos

- `src/domain/catalog.ts`
- `src/domain/catalog.test.ts`
- `src/domain/productSearch.ts`
- `src/domain/productSearch.test.ts`
- `src/api/catalogClient.ts`
- `src/api/catalogClient.test.ts`
- `server/catalogRepository.ts`
- `server/catalogApi.ts`
- `server/catalogApi.test.ts`

### Implementação

1. Adicionar `displayName` a `CatalogProduct`, `DraftProductInput` e `ValidatedProductInput`.
2. Manter no candidato selecionado os dois conceitos: nome canônico da fonte e nome preferido do cartaz.
3. Para um produto novo, persistir `canonicalName` a partir dos metadados selecionados e `displayName` a partir do campo **Nome no cartaz** validado.
4. Para um produto ativo já persistido, criar uma operação específica `updateProductDisplayName(productId, displayName)` que execute somente um `UPDATE` dessa coluna.
5. Expor a operação em uma rota local específica, protegida por `assertLocalMutation`, com UUID válido, texto obrigatório e limite de tamanho. Não expor SQL genérico nem a service role.
6. No cliente, chamar a atualização antes do download quando o nome válido diferir do `displayName` recuperado.
7. Se a foto já está persistida, não baixar seus bytes novamente e não chamar `validateProductWithImage`.
8. Se a foto mudou, preservar o fluxo existente de hash, ativo e imagem primária; ainda assim, a alteração do nome fica separada da troca de imagem.
9. Atualizar o candidato em memória com o `displayName` confirmado pelo servidor para que downloads seguintes sejam no-op.
10. Falha ao salvar o novo nome bloqueia o download e informa o erro; retry reutiliza o mesmo produto.

### Testes primeiro

- Validação aceita um nome de cartaz válido e recusa vazio ou longo.
- A rota recusa origem não local, método incorreto, UUID inválido e payload malformado.
- O repositório atualiza somente `display_name` de um produto existente.
- Reexportar sem trocar nome nem imagem não escreve novamente no catálogo.
- Editar preço sem editar nome não chama nenhuma atualização de produto.
- Editar o nome de produto ativo chama a atualização uma vez antes do download e não reenvia a imagem.
- Um produto novo persiste nome canônico e nome exibido separadamente.

## Incremento 3 — busca incremental segura e cadastro manual exclusivo

### Arquivos

- `src/components/ProductSearch.tsx`
- `src/components/ProductSearch.test.tsx`
- `src/components/ManualProductForm.tsx`
- Criar ou atualizar `src/components/ManualProductForm.test.tsx` conforme a separação de responsabilidades.

### Implementação

1. Reutilizar `classifyCatalogSearch()` antes de qualquer agendamento de busca.
2. Para `registered_name` com dois ou mais caracteres normalizados, agendar busca após 300 ms sem nova digitação.
3. Para `exact_gtin` e `invalid_numeric`, não agendar busca automática. Apenas **Buscar** ou Enter executa o fluxo explícito existente.
4. Cancelar o timer e o `AbortController` anteriores ao mudar a consulta, desmontar o componente, iniciar uma busca explícita ou abrir cadastro manual.
5. Ignorar respostas antigas mesmo que o transporte conclua depois do cancelamento.
6. Manter **Buscar** e Enter como atalhos que executam imediatamente a busca atual e cancelam o debounce pendente.
7. Mostrar os cards atuais como sugestões incrementais. Produtos cadastrados reutilizam a URL assinada da imagem primária como miniatura; não criar uma segunda busca de imagem.
8. Com consulta vazia, limpar resultados, erros e qualificação sem fazer rede.
9. Manter **Abrir cadastro manual** visível. Habilitá-lo somente quando `query.trim().length === 0`; quando desabilitado, associar a ajuda “Limpe a pesquisa para cadastrar manualmente.”
10. Ao abrir o formulário manual, desabilitar campo de pesquisa e **Buscar**. Fechar/cancelar restaura a pesquisa vazia sem consulta.

### Testes primeiro

- `n` não pesquisa; `ne` pesquisa uma vez após 300 ms.
- Digitar `nes` antes do timer cancela `ne` e pesquisa somente `nes`.
- Busca explícita cancela o debounce e não duplica a chamada.
- Número parcial e GTIN completo não fazem busca automática.
- Enter em GTIN completo continua executando o caminho local-first e só então o fallback externo.
- Resultado cadastrado aparece com nome, marca, apresentação e miniatura aprovada.
- Resposta antiga não substitui uma consulta mais recente.
- Cadastro manual fica desabilitado com texto, reabilita ao limpar e torna busca indisponível enquanto aberto.
- Nenhum teste de busca incremental chama Cosmos, Open Food Facts ou Kie.

## Incremento 4 — hierarquia visual dos produtos cadastrados

### Arquivos

- `src/components/ProductSearch.tsx`
- `src/components/ProductSearch.test.tsx`
- `src/styles.css`

### Implementação

1. Aplicar uma classe semântica `is-registered` quando o candidato possuir `catalogProductId`.
2. Usar `var(--success)`, o mesmo verde de `.search-status-dot-registered`, na borda do card cadastrado.
3. O hover não pode trocar essa borda para preto.
4. O produto cadastrado selecionado usa borda verde mais forte e indicação adicional discreta, como `box-shadow` interno e fundo verde muito suave.
5. Produtos externos permanecem neutros; cadastro manual mantém o acento próprio já usado na interface.
6. Preservar contraste, navegação por teclado, toque e os layouts de duas/três colunas existentes.

### Testes e aceite visual

- O card cadastrado recebe `is-registered`; externo não recebe.
- Seleção mantém simultaneamente `is-registered` e `is-selected`.
- A miniatura possui texto alternativo decorativo coerente com o card e não duplica a leitura do leitor de tela.
- O usuário confirma visualmente o verde contra a captura do Nescau em desktop e em largura móvel.

## Incremento 5 — encerramento explícito com “Criar nova oferta”

### Arquivos

- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/app/App.persistence.test.tsx`
- `src/components/ProductSearch.tsx`
- `src/styles.css`

### Implementação

1. Após PNG ou PDF concluído, manter os dois downloads disponíveis e mostrar a confirmação atual.
2. Exibir abaixo da confirmação o botão secundário **Criar nova oferta**.
3. Qualquer alteração posterior nos dados da oferta, produto, foto ou posição invalida o sucesso e oculta o botão até nova exportação.
4. Ao clicar, abortar medições e tarefas em andamento, revogar URLs de objeto pertencentes ao aplicativo e limpar produto, fotos, erros, preços, apresentação, confirmação, placement e estado de exportação.
5. Preservar `selectedTheme` e `selectedPreviewFormat` como preferências da sessão.
6. Limpar consulta, resultados e formulário manual do `ProductSearch` sem recarregar a página nem remontar o aplicativo inteiro.
7. Rolar a seção de pesquisa para uma posição visível e focar o campo sem disparar busca externa.
8. Não criar, alterar ou apagar qualquer registro no Supabase durante o reset.

### Testes primeiro

- O botão não existe antes de uma exportação bem-sucedida.
- Falha de persistência ou download não mostra o botão.
- PNG ou PDF bem-sucedido mostra o botão sem limpar a oferta automaticamente.
- O segundo formato ainda pode ser baixado antes do reset.
- Editar nome, preço, foto ou posição oculta o botão.
- Clicar limpa todos os dados temporários, mantém tema/formato, restaura posição automática, limpa a busca, rola e foca o campo.
- Reset não chama catálogo, Open Food Facts, Cosmos ou Kie.

## Incremento 6 — validação integrada e documentação

### Validação automatizada

1. Executar primeiro os testes direcionados de domínio, API, repositório, busca, formulário manual e aplicativo.
2. Executar `npm test` completo.
3. Executar `npm run build`.
4. Executar os testes pgTAP contra um banco descartável ou transação com rollback.
5. Confirmar que nenhuma chamada externa foi feita pelos testes de busca incremental.

### Validação remota controlada

1. Confirmar o projeto Supabase correto sem revelar segredos.
2. Reconciliar o histórico e aplicar somente a nova migração aditiva.
3. Confirmar que o Nescau existente recebeu `display_name` sem mudar ID, GTIN ou imagem.
4. Atualizar o nome exibido, pesquisar pelas duas formas relevantes e confirmar que permanece uma única linha para o GTIN.
5. Não criar campanha, exportação ou nova tarefa Kie durante o smoke.

### Validação visual do usuário

1. Digitar `NE` e confirmar o aparecimento automático do Nescau com miniatura.
2. Confirmar borda verde em repouso, hover e seleção.
3. Confirmar que o cadastro manual fica desabilitado enquanto existe consulta.
4. Selecionar o Nescau, alterar somente o nome no cartaz e baixar PNG.
5. Baixar PDF ou repetir o PNG sem duplicar produto/foto.
6. Clicar em **Criar nova oferta** e confirmar reset, rolagem e foco.
7. Pesquisar novamente e confirmar que o último `display_name` aparece como sugestão.

## Critérios de aceite

- O mesmo GTIN corresponde a exatamente um produto antes e depois de qualquer número de downloads.
- O banco persiste apenas produto, foto e metadados técnicos necessários; nenhum dado circunstancial da oferta entra no fluxo.
- O nome canônico continua recuperável e o último nome aprovado do cartaz reaparece em nova oferta.
- A busca incremental responde a partir de dois caracteres e mostra miniatura apenas de produto ativo do catálogo próprio.
- Nenhuma digitação automática consulta fonte externa ou consome Cosmos.
- O card cadastrado usa a mesma semântica verde da legenda e mantém estado selecionado inequívoco.
- Cadastro manual e busca não podem ficar ativos simultaneamente.
- O reset acontece somente por ação explícita depois do download e nunca por editar/apagar um dígito da pesquisa.
- A aplicação não recarrega a página para iniciar outra oferta.
- Todos os testes e o build passam; a validação visual final é confirmada pelo usuário.

## Portão de implementação

O usuário aprovou a execução em 7 de setembro de 2026. A implementação local foi concluída sem reiniciar o Vite nem disparar consulta Cosmos/Kie. Passaram 200 testes em 27 arquivos e o build de produção.

O projeto remoto correto foi confirmado no painel como `ytwbhphmsdntrxfyzhtt` (**Projeto Teste**), contendo o Nescau de GTIN `7891000053508`. Como a CLI local estava autenticada em outra organização, a reconciliação foi executada de forma controlada pelo SQL Editor: a tabela oficial `supabase_migrations.schema_migrations` foi inicializada, a migração inicial foi marcada como já aplicada e `20260907111500_add_product_display_name.sql` foi aplicada dentro da mesma transação. O histórico remoto contém agora as versões `20260906120158` e `20260907111500`.

O smoke posterior confirmou uma única linha para o GTIN do Nescau, uma única imagem primária aprovada, o mesmo ID de produto, `display_name` preenchido e busca local `NE` respondendo HTTP 200. Na interface, a sugestão apareceu automaticamente com miniatura, classe `is-registered`, borda verde e estado selecionado distinto. Nenhuma consulta Cosmos ou Kie foi disparada.
