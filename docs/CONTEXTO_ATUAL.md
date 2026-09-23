# Contexto atual do projeto

**Atualizado em:** 17 de setembro de 2026
**Aplicação local:** `http://127.0.0.1:4173/`

Este é o documento de retomada e o **ponto de entrada** da documentação. Ele guarda
apenas o que muda de sessão para sessão: o estado funcional, o estado do banco e o
próximo passo. Regras estáveis, mapa de arquivos e histórico foram separados para que
este arquivo continue curto e possa ser lido inteiro no início de qualquer sessão.

## Onde está cada coisa

| Arquivo | O que guarda | Muda quando |
| --- | --- | --- |
| **este arquivo** | estado funcional, estado do Supabase, próximo passo | a cada sessão |
| [`referencia/DECISOES.md`](referencia/DECISOES.md) | limites do produto, ordem das camadas, regras visuais validadas, regras de busca/foto/medição, forma de validação | só por decisão explícita do usuário |
| [`referencia/MAPA_DO_PROJETO.md`](referencia/MAPA_DO_PROJETO.md) | mapa de pastas e arquivos, integrações e segredos, testes existentes | quando nasce arquivo, integração ou suíte |
| [`GUIA_OPERACAO_LOCAL.md`](GUIA_OPERACAO_LOCAL.md) | como subir e operar a interface local | raramente |
| [`superpowers/specs/`](superpowers/specs/) | especificação canônica do produto | por decisão de produto |
| [`superpowers/plans/`](superpowers/plans/) | planos aprovados, com estado | a cada incremento |
| [`superpowers/notes/`](superpowers/notes/) | histórico das sessões e aprendizados | a cada sessão |

**Antes de alterar o projeto**, leia este arquivo e
[`referencia/DECISOES.md`](referencia/DECISOES.md). Os demais só quando o assunto pedir.

## Estado funcional atual

- Há uma tela de preenchimento à esquerda e prévia ao vivo do Story à direita.
- Em desktop (a partir de `980px`), a prévia ocupa a coluna direita como painel fixo abaixo da barra superior; ela não acompanha o fim do formulário. Em telas menores, permanece no fluxo vertical normal.
- O topo da prévia permite selecionar Story ou Feed. As duas opções são funcionais para um produto: Story renderiza `1080 × 1920` e Feed renderiza um SVG independente de `1080 × 1350`, com fundo, placa, linha de base e regras de texto próprias. Selecionar Feed troca a prévia e o PNG; o PDF continua exclusivo do Story vertical.
- A coluna de preenchimento expõe temas selecionáveis de interface: Padrão, Dia das Mães, Dia dos Pais, Natal, Páscoa, Festa Junina, Carnaval, Dia dos Namorados, Dia das Crianças, Black Friday e Ano-Novo. Padrão é o estado inicial; nesta etapa a escolha é apenas visual e não altera o SVG, a prévia ou a exportação.
- O bloco de busca de embalagem separa três entradas: nome/marca procura somente produtos ativos do catálogo próprio; EAN/GTIN exato verifica primeiro o banco e só consulta Open Food Facts/Cosmos após ausência confirmada; cadastro manual cria um produto `draft` separado.
- Para PNGs transparentes, o validador tolera uma margem de antialiasamento de até 1 px na borda da silhueta. Um toque real na borda continua bloqueando a foto como corte. Desde 6 de setembro, fotos em fundo branco também são medidas na resolução original em vez do canvas reduzido, o que corrigiu a reprovação indevida de packshots pequenos e bem enquadrados.
- O Story é um SVG de `1080 × 1920`; o Feed é um SVG de `1080 × 1350`. Cada prévia gera seu próprio PNG pela mesma árvore SVG exibida; o PDF permanece uma página do Story.
- Em 6 de setembro, os textos dinâmicos da placa do Feed/1 foram baixados dentro da área segura para aproveitar a parte inferior do painel. Como no Story, o SVG sobrepõe uma extensão vermelha central à faixa fixa do PSD. Para 1 e 2 linhas, a unidade fica centralizada logo após a base reta da faixa vermelha; para 3 linhas, ela vai para o canto direito da área amarela. Nome, unidade e preço usam coordenadas próprias do Feed.
- No estado de três linhas do Feed, a unidade do canto direito fica em `x=411`, `y=840`: afastada da faixa vermelha e ainda com margem até a borda. O preço riscado fica em `x=277`, `y=856`, centralizado entre a ponta vermelha e o preço promocional.
- A tipografia do Feed/1 segue os estados validados no Story, escalados pela largura útil da placa (`226 / 308`): nome e unidade mantêm hierarquia proporcional em 1, 2 e 3 linhas; preço usa uma tabela por número de dígitos derivada da tabela do Story, sem redução adicional quando há preço anterior.
- A composição do nome não divide uma palavra entre linhas, tanto no Story quanto no Feed. No Story, a fonte padrão continua em `44 px` e reduz a própria linha até `24 px`; no Feed, parte de `32 px` e reduz até `18 px`. Acima de 16 caracteres em uma palavra, o campo bloqueia o nome e informa o limite, em vez de quebrar ou truncar o texto. Nomes com várias palavras podem ocupar até três linhas, mas apenas nos espaços entre palavras.
- O fluxo atual é de **um produto**. Feed/1 e Story/1 são funcionalidades concluídas localmente; as variações de 4 e 8 produtos continuam como objetivos futuros.
- Nome, quantidade, unidade, preço promocional e preço anterior opcional são editáveis. O operador confirma produto, apresentação e preço antes de liberar a exportação.
- A unidade de uma peça individual é armazenada como `unidade`, mas é apresentada como **`UN`** tanto no seletor quanto na placa, para não ocupar espaço desnecessário.
- A busca aceita nome, marca, EAN ou GTIN, mas nome/marca nunca descobre produto em fonte externa. A seleção e a associação final com a foto continuam sendo sempre humanas.
- O schema remoto do Supabase já existe, mas a campanha ainda não foi ligada à persistência. Até esse corte terminar, o rascunho visual atual continua na memória do navegador e uma recarga ou remount do React pode limpá-lo.


## Estado do Supabase — 7 de setembro de 2026

- Projeto confirmado: referência `ytwbhphmsdntrxfyzhtt` (`Projeto Teste`).
- Em 17 de setembro o projeto estava pausado por inatividade, causando `ENOTFOUND` e atrasos de 7–12 segundos antes de a busca falhar. Ele foi retomado pelo painel, voltou ao estado **Healthy** e a rota local recuperou o Nescau cadastrado com imagem em aproximadamente 1,1 segundo.
- Foram criadas as nove tabelas essenciais: `assets`, `store_themes`, `products`, `product_images`, `artwork_templates`, `campaigns`, `campaign_items`, `campaign_exports` e `integration_daily_usage`.
- As nove tabelas estão com RLS habilitado. O bucket privado `catalog-assets` e as sete funções controladas do domínio existem.
- Depois da limpeza do smoke técnico, o primeiro ensaio real criou o Nescau; o usuário confirmou o produto cadastrado e recuperável com sua foto. Temas, campanhas e templates permanecem fora do fluxo atual. Em especial, Feed permanece sem linha de template.
- O fundo local e o renderer `FeedPoster` já foram validados para Feed/1, mas não há ativo nem linha `feed + 1` no Supabase enquanto o upload durável de ativos do incremento 3 não estiver concluído.
- A migração foi aplicada pelo SQL Editor em uma transação única porque o MCP desta conversa continuou sem `apply_migration`. O arquivo versionado local é a fonte canônica; o histórico interno de migrações do Supabase ainda precisa ser reconciliado em uma sessão com MCP de escrita antes da próxima mudança de schema.


## Próximo ponto de trabalho

- Em 23 de setembro de 2026, a busca passou a travar o GTIN/EAN após a escolha de um produto e a trocar **Buscar** por **Alterar busca**. Desbloquear a pesquisa preserva a oferta e a foto atuais até uma nova seleção. A mudança foi validada por 245 testes e build; falta o aceite visual do usuário na interface publicada.

## Decisões em aberto — lembrar a cada sessão

Estas ficaram **explicitamente em aberto por decisão do usuário** em 7 de setembro. O
agente não deve resolvê-las sozinho: deve trazê-las de volta quando o assunto voltar.

**1. Limite inferior do arraste.** Hoje `maxVisibleBottom` é o mesmo número de
`baselineY` nos dois formatos, e por isso a embalagem não desce **nenhum** pixel
abaixo da posição automática. O usuário acha que dá para descer mais, e a arte
concorda. Medições do PNG, para a decisão chegar pronta:

| | linha automática (`baselineY`) | frente do tampo do pedestal | folga disponível |
| --- | --- | --- | --- |
| Feed | `1113` | `≈1138` no centro (`1137` em x=650, `1138` em x=460) | **≈ 24 px** |
| Story | `1608` | `≈1621` no centro; `≈1610` já em x=820 | **≈ 12 px no centro, quase nada nas laterais** |

A pergunta real é se `baselineY` (onde a embalagem **repousa** sozinha) e
`maxVisibleBottom` (até onde o operador **pode empurrar**) devem deixar de ser o
mesmo número. Separar os dois manteria o encaixe automático como está e liberaria a
descida. A folga do Story é bem menor que a do Feed e some nas laterais do tampo,
então o valor não pode ser o mesmo nos dois.

**2. Extensão vermelha da placa do Story.** Passa cerca de 4,5 px além da abertura
interna pela direita (`H453` contra a borda em `448,5`) e pinta sobre a moldura
prateada — o mesmo defeito corrigido no Feed em 7 de setembro. Não foi mexido porque
o Story já estava dado como validado pelo usuário. A correção é a mesma: encaixar o
caminho na abertura medida e recortá-lo pelo formato interno.


## Fase atual — validação manual do encerramento da oferta

A política local-first continua válida: nome/marca consulta somente produtos ativos do catálogo próprio; EAN/GTIN exato verifica primeiro o banco e só usa fontes externas depois de ausência local e ação explícita. A pesquisa incremental já reutiliza essa fronteira e nunca agenda consulta numérica automática.

Na legenda e nos cards, o verde fica reservado aos produtos cadastrados. A borda verde, a busca incremental com miniatura, o `display_name`, a exclusividade do cadastro manual e o botão **Criar nova oferta** estão implementados e cobertos por testes locais.

A migração aditiva versionada em `supabase/migrations/20260907111500_add_product_display_name.sql` foi aplicada ao projeto correto `ytwbhphmsdntrxfyzhtt` (**Projeto Teste**) em 7 de setembro. Como a CLI local estava autenticada em outra organização, o SQL Editor inicializou a estrutura oficial `supabase_migrations.schema_migrations`, marcou a versão inicial `20260906120158` como já aplicada e executou a versão `20260907111500` na mesma transação. O histórico remoto passou a listar exatamente essas duas versões.

O smoke remoto preservou o Nescau de GTIN `7891000053508` com o mesmo ID, uma linha de produto e uma imagem primária aprovada. `display_name` foi preenchido com o nome canônico, o texto normalizado foi recalculado e `GET /api/catalogo/products?name=ne` respondeu 200 com o produto e sua foto. Na interface, `NE` mostrou automaticamente o Nescau com miniatura e borda verde; a seleção manteve `is-registered is-selected`, fundo verde suave e realce interno. O cadastro manual ficou desabilitado durante a consulta. Nenhuma fonte externa ou tarefa Kie foi chamada.

## Endurecimento da rota da Kie — 7 de setembro

Feito antes de gastar qualquer um dos 2 créditos restantes, e sem tocar no provedor.

- **O `taskId` deixou de se perder.** Ele é registrado no terminal do Vite no instante da criação da tarefa, que é o único passo cobrado. Consultar estado e rebaixar o resultado são gratuitos, então um crédito gasto continua recuperável por `GET /api/kie/remove-background/<taskId>/image` mesmo que a exibição falhe. O operador continua sem ver ID na interface, como decidido em 5 de setembro.
- **O download do resultado passou a seguir redirecionamento.** `redirect: "error"` derrubava qualquer 3xx do CDN com um `fetch failed` sem diagnóstico. Cada salto é resolvido no código e revalidado pela mesma guarda da URL original, no máximo 3 vezes.
- **Erros passaram a nomear a etapa** (`upload`, `createTask`, `recordInfo`, `download`), com o status HTTP e a `cause` que o `fetch` do Node esconde.
- **A foto da busca deixou de depender da medição para existir.** Ela entrava no cartaz apenas dentro do `then` de `measureProductPlacement`; quando a medição falhava, a foto sumia e o botão da Kie ia junto, porque ele depende de `productImageUrl`. Isso trancava justamente a foto difícil em fundo branco. O upload manual nunca teve esse portão, e agora os dois caminhos se comportam igual, para foto do Open Food Facts ou do Cosmos indistintamente.
- **Um resultado sem geometria não é mais descartado.** O PNG já pago continua revisável e aprovável mesmo que a medição falhe.
- **Uma consulta de estado que falha não encerra mais a tarefa**: são toleradas até 3 falhas seguidas. Um estado intermediário desconhecido passou a valer como "ainda trabalhando" em vez de erro fatal; só `fail` explícito desiste.

O portão registrado em 7 de setembro está cumprido: a rota é exercitada ponta a ponta
contra um provedor falso em `server/kieBackgroundRemovalRoute.test.ts`. A suíte passou
com **29 arquivos e 216 testes**, mais o build. Falta apenas o ensaio real, com
autorização explícita do usuário.

## Ensaio real da Kie e mudança do fluxo de revisão — 7 de setembro

- **O fluxo foi validado com crédito real.** Cappuccino Solúvel Chocolate 3 Corações, 200 g, foto de fundo branco vinda da busca. A tarefa `3a644a990f9dde3e41d76d9a68f0714f` concluiu, o PNG transparente chegou pelo relay local e o recorte ficou correto, apoiado no pedestal. Restou 1 crédito.
- O identificador é hexadecimal, sem prefixo `task_` — o formato que já tinha derrubado a integração antes e que agora passa. Ele ficou registrado no terminal do Vite, e o resultado continua recuperável por `GET /api/kie/remove-background/<taskId>/image` enquanto a Kie mantiver o arquivo.
- **A etapa de revisão foi removida por decisão do usuário.** O card mostrava o PNG transparente sobre fundo branco, onde ele fica idêntico à foto original de fundo branco: pedia uma comparação que ele próprio impedia. O recorte passou a entrar no cartaz direto, e a conferência é o cartaz em tamanho real, antes da exportação.
- Com isso saíram dois estados inteiros do `App` (`kieCandidateImageUrl` e `kieCandidateGeometry`) e as ações de aprovar/descartar. O que sobrou é `kieImageUrl`/`kieGeometry`, uma camada sobre a foto original, que permanece intacta.
- **Não há desfazer, e sim Refazer com a Kie**, sempre a partir da foto original — recorte nunca se empilha sobre recorte. Refazer é uso normal: o custo por geração é irrisório e tentar de novo não é incidente. Ver as regras 11 a 13 em [`referencia/DECISOES.md`](referencia/DECISOES.md).

## Arraste do Feed e hierarquia da placa — 7 de setembro

- **O arraste chegou ao Feed/1** com o mesmo mecanismo já aceito no Story: `DraggableProduct`, limiar de 3 px, captura de ponteiro, prévia em `requestAnimationFrame` e alvo de interação fora do SVG exportado. A sombra acompanha o eixo horizontal e continua apoiada no pedestal.
- **Os limites são do Feed, não do Story.** Foram recalculados contra a arte do Feed a partir dos conceitos aceitos: base `y=1113`, esquerda `x=407`, direita `x=737`, teto `y=332` e faixa do fallback entre `y=488` e `y=773`. A derivação está em [`referencia/DECISOES.md`](referencia/DECISOES.md).
- **Cada formato tem o seu deslocamento.** Arrastar no Feed não mexe no Story; trocar produto, foto ou refazer com a Kie devolve os dois ao encaixe automático; soltar a embalagem invalida a confirmação de revisão.
- **A extensão vermelha da placa do Feed parou de pintar sobre a moldura.** O usuário viu o defeito nas laterais e nos ombros de baixo do triângulo. A abertura interna foi medida no PNG (laterais em `203,5` e `417,5`, levemente inclinada) e a extensão passou a nascer dentro dela e a ser recortada por `#feed-sign-inner`. O mesmo desenho no Story ainda passa ~4,5 px pela direita e **não foi mexido**, porque o Story já estava validado — a correção está descrita e aguarda decisão do usuário.
- A suíte passou com **30 arquivos e 227 testes**, mais o build. Falta o aceite visual do usuário com uma foto real, arrastando no Feed.

## Qualificação de foto por fonte — 17 de setembro

- A avaliação visual deixou de bloquear fotos do Cosmos. Depois de GTIN exato, origem autorizada e carregamento válido, a miniatura permanece selecionável mesmo que o diagnóstico aponte fundo, enquadramento, resolução, desfoque ou múltiplos objetos; a decisão estética é do operador e a Kie continua explícita.
- Fotos do Open Food Facts mantêm o filtro de qualidade anterior. A fonte continua útil para metadados mesmo quando sua imagem é descartada.
- Uma foto Cosmos que não carrega continua bloqueada. Selecionar a foto não aciona Kie nem nova consulta Cosmos.
- O caso real `7896877500919`, cuja foto JPEG do Cosmos possui fundo preto até a borda, motivou a mudança e aguarda aceite visual do usuário na prévia. A suíte passou com **30 arquivos e 229 testes**, além do build.

## Calibração do peso visual da embalagem — 17 de setembro

- O Danoninho horizontal revelou que a medição estava correta, mas a antiga caixa máxima favorecia embalagens verticais: ele parava em `330 × 233,89`, enquanto um pacote alto podia usar toda a altura de `520`.
- Story e Feed agora compartilham uma função de escala por área visual, mantendo calibrações próprias. No Story a área-alvo é `135.200 px²`, limitada a `440 × 520`; no Feed é `72.200 px²`, limitada a `298 × 380`.
- O Danoninho de referência passa para aproximadamente `437 × 310` no Story. Uma embalagem vertical `1:2` permanece em `260 × 520`, e proporções extremas continuam presas aos limites seguros.
- A mudança não adicionou escala manual, não alterou pedestal, camadas, sombra ou regras de arraste e não chamou Cosmos nem Kie. Os testes direcionados passaram com **48/48**; a suíte completa passou com **30 arquivos e 236 testes**, além do build de produção.
- Falta o aceite visual do usuário com o Danoninho no Story e no Feed e, depois, uma embalagem vertical para comparação.

## Encerramento desta rodada e ideia futura — 17 de setembro

- O usuário encerrou por enquanto a rodada manual de testes e informou que ela cobriu o que precisava validar nesta etapa. Não há rascunho ativo que precise ser preservado no navegador.
- A calibração de peso visual permanece implementada e coberta automaticamente. Se o tema voltar, a comparação Danoninho horizontal versus embalagem vertical pode servir como uma nova conferência visual, sem ser tratada como bloqueio para encerrar esta sessão.
- **Ideia futura, ainda fora do escopo:** investigar integração com o Instagram para gerar a arte no aplicativo e publicá-la depois da confirmação do operador.
- Antes de qualquer plano ou implementação, verificar na documentação oficial da Meta: tipos de conta aceitos, necessidade de Página vinculada, autenticação e renovação de token, permissões e revisão do aplicativo, limites de publicação, exigência de URL pública para a mídia, formatos aceitos, custos e restrições comerciais.
- Não assumir que a publicação é gratuita nem que funciona para contas pessoais. A investigação deve acontecer separadamente e voltar para aprovação de escopo; postagem automática continua fora do MVP atual.

## Handoff obrigatório para a próxima sessão

1. O usuário valida visualmente o Nescau já selecionado, sem nova busca externa: miniatura, borda verde, estado selecionado e preenchimento do cartaz.
2. Alterar somente o nome no cartaz, baixar PNG e confirmar que a interface conclui a exportação.
3. Repetir PNG/PDF e confirmar que produto/foto não duplicam; depois testar **Criar nova oferta**, foco e preservação de tema/formato.
4. Se o aceite manual passar, encerrar este incremento e seguir somente para o próximo ponto solicitado pelo usuário.
5. Manter fora do corte: campanhas/exportações persistidas e grades 4/8.
6. **Retomar a seção "Decisões em aberto"** deste arquivo antes de mexer no arraste ou na placa: o limite inferior e a ponta vermelha do Story ficaram para o usuário decidir, não para o agente resolver.

**A Kie saiu do "fora do corte" em 7 de setembro**, por pedido explícito do usuário, e o
incremento foi concluído: rota endurecida, fluxo de revisão substituído e ensaio real
bem-sucedido. O que resta dela é apenas o aceite visual do comportamento novo — aplicar
direto no cartaz e **Refazer com a Kie** —, porque o que o usuário viu com crédito real
foi o fluxo anterior, com o card de revisão. Detalhes nas duas seções acima.

O trabalho visual anterior continua válido. A próxima validação manual pertence ao usuário depois que testes e build passarem.


Para operar a interface, siga [`GUIA_OPERACAO_LOCAL.md`](GUIA_OPERACAO_LOCAL.md).
