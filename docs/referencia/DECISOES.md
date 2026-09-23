# Decisões e regras que não mudam sozinhas

**Natureza deste arquivo:** estável. Aqui ficam as regras que já foram decididas e
validadas e que não devem ser alteradas por conveniência de implementação. Uma
mudança neste arquivo é uma mudança de produto e exige decisão explícita do usuário.

O estado corrente do projeto vive em [`../CONTEXTO_ATUAL.md`](../CONTEXTO_ATUAL.md).
O mapa de arquivos e integrações vive em [`MAPA_DO_PROJETO.md`](MAPA_DO_PROJETO.md).

## Limites e decisões que não devem ser esquecidos

1. A aplicação não é um editor livre: produto, preço e apresentação permanecem associados. A única exceção aprovada é arrastar a imagem já selecionada dentro do palco seguro do layout; não há redimensionamento, rotação, reposicionamento de texto/preço/unidade ou mudança de camadas pelo operador.
2. Uma imagem bonita não prova que ela corresponde ao SKU. EAN/GTIN, marca, apresentação e foto exigem confirmação humana.
3. Foto é um complemento da busca de produto: ausência de foto não pode bloquear metadados, preço ou upload manual.
4. PNG de extensão `.png` não basta; a qualidade é verificada por conteúdo, transparência/enquadramento e procedência.
5. O Cosmos é complementar e limitado. Uma falha de cota nunca pode causar uma consulta sem reserva; OFF exato e upload manual continuam independentes.
6. Não fazer chamadas Cosmos em busca textual. Isso poupa a cota para códigos exatos.
7. A fase Supabase single-tenant foi explicitamente aprovada em 6 de setembro de 2026. Autenticação, interface pública, ERP, publicação automática e multitenancy continuam fora do escopo.
8. Mudança visual deve manter preview e exportação no mesmo SVG e trazer teste proporcional ao risco.
9. Durante uma demonstração/teste manual, não reiniciar a aplicação, não executar alteração que cause remount e não fazer nova consulta externa sem a autorização explícita do usuário.
10. A Kie pode devolver IDs hexadecimais sem o prefixo `task_`; a rota local não deve presumir o formato do provedor. O resultado é relido pela rota local e entregue ao navegador como imagem de mesma origem, evitando CORS e URLs externas no SVG.
11. O resultado da Kie entra no cartaz direto, sem etapa de revisão separada. **Decisão do usuário em 7 de setembro de 2026**, substituindo a regra anterior de aprovação explícita. O motivo é que a revisão era impossível de fazer: o card pintava o PNG transparente sobre fundo branco, onde ele fica visualmente idêntico à foto original de fundo branco, e pedia uma comparação que ele próprio impedia. A conferência passou a ser o cartaz, em tamanho real, antes da exportação — a caixa "Conferi produto, apresentação e preços" continua sendo o portão do arquivo final.
12. Não existe desfazer para a remoção de fundo. Voltar ao fundo branco devolveria o operador a um estado que ele já decidiu abandonar, porque a Kie é a única rota de saída daquele fundo. Um recorte ruim se resolve por **Refazer com a Kie** ou por trocar a foto. Refazer é uso normal da ferramenta, não incidente: o custo por geração é irrisório e duas ou três tentativas são aceitáveis — decisão do usuário em 7 de setembro de 2026. A escassez de crédito de uma sessão específica não vira regra de produto nem alarme de interface; a interface informa o que o botão faz, sem dramatizar custo.
13. A foto original nunca é substituída: ela continua em memória e o recorte é uma camada por cima. Por isso refazer parte sempre da foto original, e nunca da própria saída da Kie — recorte não se empilha sobre recorte.


## Forma de validação com o usuário — 7 de setembro

- O agente investiga a intenção da regra, implementa as mudanças no código e executa as validações automatizadas proporcionais ao risco.
- A validação visual final pertence ao usuário. Depois de uma mudança visual, o agente preserva o estado vivo da demonstração sempre que possível e pede que o usuário teste o resultado na prévia; não declara aprovação visual em nome do usuário.
- Inspeções técnicas de DOM, dimensões, SVG, console ou exportação continuam permitidas quando necessárias para diagnosticar o código, mas não substituem o aceite visual do usuário.
- O fluxo completo ainda não foi revalidado com crédito real. O defeito registrado entre a conclusão na Kie e a chegada do PNG ao aplicativo era o consumo do resultado pela rota de importação, corrigido em 6 de setembro; a frase original permaneceu no contexto sem nova medição. Em 7 de setembro o usuário autorizou explicitamente retomar essa integração, e o portão de teste local foi cumprido — ver o registro do endurecimento em [`../CONTEXTO_ATUAL.md`](../CONTEXTO_ATUAL.md).
- Em 7 de setembro, a API da Kie informou saldo de 2 créditos, equivalentes a 2 remoções. Consultar o saldo não consome crédito. Cada remoção real exige autorização explícita do usuário e só deve acontecer depois de testes locais cobrirem criação da tarefa, consulta de status, relay do resultado e preservação da imagem original em falhas.
- O arraste restrito vale agora para os dois formatos. Ele usa Pointer Events para mouse/toque, limita a silhueta visível ao palco, mantém a sombra na base do pedestal e remove o alvo interativo do SVG exportado. O Story foi aceito primeiro; o Feed recebeu o mesmo mecanismo em 7 de setembro, com limites próprios e aguardando o aceite visual do usuário.
- Limites do Story/1: esquerda `x=430`, teto `y=540`, direita `x=980` e base `y=1608`. A troca de produto ou foto restaura a posição automática.
- **Os limites do Feed nunca copiam os números do Story** — as telas têm `1350` e `1920` de altura, e placa e pedestal ficam em lugares diferentes. O que se copia é o conceito, recalculado contra a arte do Feed: base na linha do pedestal (`y=1113`), invasão à esquerda atrás da placa (`x=407`, 31 px além da borda em `438`), folga à direita da caixa automática (`x=737`, 71 px além de `666`) e teto (`y=332`, 401 px acima de `733`). As escalas usadas são as do próprio palco: `220/330` na largura e `380/520` na altura. A faixa do fallback sem geometria medida vai de `y=488` a `y=773`. Todos esses valores são calibração técnica e continuam sujeitos ao aceite visual do usuário.
- Cada formato guarda o seu próprio deslocamento. Arrastar no Feed não move a embalagem do Story, e vice-versa; trocar produto ou foto zera os dois.
- **Em aberto, por decisão do usuário:** o limite inferior. Hoje `maxVisibleBottom` repete `baselineY` nos dois formatos, então a embalagem não desce nada abaixo do encaixe automático; o usuário quer poder descer mais. As medições do tampo do pedestal e o enquadramento da decisão estão em [`../CONTEXTO_ATUAL.md`](../CONTEXTO_ATUAL.md), na seção **Decisões em aberto**. Não resolver isso sem ele.
- No primeiro teste manual, a foto trocada pelo operador não possuía geometria medida; por isso o SVG exibia a imagem, mas não criava o alvo de Pointer Events. O componente agora mantém o arraste disponível nesse estado usando a caixa da imagem como fallback. O gesto básico foi validado pelo usuário. Para esse fallback, a faixa vertical visualmente indicada no Story/1 foi calibrada com o topo da caixa entre `y=755.05615234375` e `y=1144.6849365234375`; o movimento horizontal continua limitado apenas pelo Story neste primeiro ensaio. A decisão entre arraste direto, clique para liberar e ajustes por teclado continua pendente.
- Em 7 de setembro, a confirmação humana seguida de **Baixar Story em PNG/PDF** passou a validar e persistir o produto/foto antes de iniciar o download. O servidor local verifica os bytes e dimensões de PNG/JPEG/WebP, grava o ativo no bucket privado por hash, cria ou reutiliza `products`, `assets` e `product_images`, chama `activate_product` e só então libera o arquivo. Falha do banco bloqueia o download e aparece como erro; retries reutilizam GTIN/hash em vez de duplicar silenciosamente. Um smoke test remoto criou um produto técnico, recuperou a foto do Storage, encontrou-o por nome e removeu somente os IDs/caminho do teste; a tabela `products` voltou a zero registros.


## Ordem das camadas — regra do operador, 6 de setembro de 2026

- A composição tem três camadas: **fundo**, depois **produto**, depois **placa**. A foto da embalagem fica sempre atrás da placa e na frente do fundo, venha ela com fundo branco ou já recortada.
- Se a embalagem passar para fora da placa, a parte que sobra aparece normalmente. A parte que fica sobre a placa some atrás dela.
- **Nunca se recorta a foto por causa da placa.** Não existe corte, máscara nem redimensionamento para caber. É só ordem de camadas.
- **A moldura da placa fica sempre por fora.** Tudo que o SVG desenha dentro da placa — hoje, a extensão vermelha — vive na abertura interna, nunca sobre a moldura prateada. No Feed essa abertura foi medida no PNG: laterais em `x=203,5` e `x=417,5`, com inclinação leve (topo de `665,5` a `667,5`, base de `954,5` a `956,5`). Por isso a extensão é recortada por `#feed-sign-inner` além de nascer dentro da abertura: a inclinação não se resolve com retângulo reto. **Pendência:** no Story o mesmo desenho ainda passa cerca de 4,5 px além da abertura pela direita (`H453` contra a borda interna em `448,5`); não foi corrigido porque o Story já estava dado como validado pelo usuário.
- **Pendência que impede a regra:** a placa está pintada dentro do PNG de fundo, então não existe camada para desenhar na frente do produto. Falta um PNG por template contendo só a placa, com transparência em volta e a mesma dimensão do fundo. O paliativo que está no código — redesenhar o fundo recortado na região da placa — ainda pinta fundo por cima da foto e aparece como corte. Detalhes e o caminho da solução em [`superpowers/notes/2026-09-06-camada-da-placa-pendente.md`](../superpowers/notes/2026-09-06-camada-da-placa-pendente.md).


## Regras visuais validadas — sessão de 6 de setembro

- **Story/1:** a distribuição interna da placa e a regra de nomes foram aprovadas visualmente. Texto curto usa o tamanho padrão; palavra longa não é dividida e reduz somente a fonte da sua linha, até o mínimo explícito. Não alterar essas regras sem novo teste visual.
- **Feed/1:** o arquivo-base local vem de `D:\daily-offers-retail-promotion-with-3d-product-shopping-cart\feed.psd`, convertido em `public/templates/feed/single/feed-base-empty.png`. O compositor mantém o fundo fixo e acrescenta no SVG somente os dados dinâmicos e a extensão vermelha da placa; preview e PNG vêm dessa mesma árvore SVG.
- Para 1 e 2 linhas no Feed, nome e unidade ficam centralizados na placa vermelha. Para 3 linhas, a unidade migra para o canto amarelo direito; sua coordenada validada é `x=411`, `y=840`. Não recolocá-la dentro da ponta vermelha nem rente à borda.
- O preço promocional do Feed permanece abaixo, em escala proporcional ao número de dígitos. O preço anterior riscado foi refinado visualmente para `x=277`, `y=856`: fica entre a faixa vermelha e o preço grande, sem tocar nenhum dos dois. Não centralizá-lo novamente sem nova validação.
- A regra modular de texto vale nos dois formatos: no máximo três linhas; quebra apenas entre palavras; redução de fonte limitada; palavra com mais de 16 caracteres é erro de campo, nunca corte ou quebra silenciosa. Casos de referência: `Nescau 2.0` preserva o tamanho padrão e `Ibituruninha` ocupa uma única linha menor.
- Durante a sessão, o Vite caiu uma vez e foi restaurado em `http://127.0.0.1:4173/`. Em testes futuros, reutilizar o servidor se estiver ativo; não recarregar a página nem reiniciar o Vite enquanto houver rascunho em edição.


## Busca de produto e imagem

### Seleção travada na busca — 23 de setembro de 2026

- Depois de escolher um produto ou uma foto, a barra mostra o GTIN/EAN quando ele existe e fica somente leitura. O botão **Buscar** passa a ser **Alterar busca**.
- **Alterar busca** libera e limpa o campo de pesquisa, a seleção, a foto, o recorte da Kie e os dados da oferta atual. A busca nova não é disparada automaticamente pelo desbloqueio.
- Ao escolher outro produto, a seleção substitui a anterior. **Criar nova oferta** continua sendo a ação separada que limpa o rascunho completo.
- O cadastro manual exige uma foto da embalagem antes de criar o produto. A foto é medida e salva junto com o produto; resultados manuais usam sinalização laranja. **Remover foto** retira a imagem também da prévia do cartaz.

### Catálogo próprio e motor gratuito — Open Food Facts

- Busca textual por nome/marca usa somente a função `search_active_products` no catálogo próprio.
- Busca por EAN/GTIN consulta o endpoint exato do Open Food Facts.
- O endpoint exato do Open Food Facts só é chamado depois que o GTIN não existe localmente. Ele permanece disponível mesmo sem foto ou quando a cota do Cosmos se esgota.

### Motor complementar — Cosmos BlueSoft

- Apenas uma busca **exata** por EAN/GTIN consulta Open Food Facts e Cosmos em paralelo.
- Os retornos só são unidos quando o código é idêntico. Busca por texto não consome Cosmos.
- O Cosmos pode trazer uma thumbnail de embalagem. Ela aparece separada como origem `Cosmos`, ao lado de eventual imagem do Open Food Facts.
- A cota é de 25 chamadas externas por dia no fuso de São Paulo. A reserva atômica no banco é o caminho preferido; quando ela falha, o servidor local recupera o comportamento já validado com um contador atômico local, em vez de bloquear a consulta.
- Consultar `GET /api/cosmos/status` não consome cota. Nunca expor nem registrar token em tela, commits ou documentação.
- Desde 6 de setembro, uma falha, resposta inválida ou GTIN divergente do Cosmos não é mais ocultada quando o Open Food Facts ainda forma o produto: a busca mantém o candidato disponível e mostra um aviso específico da fonte. Quando o Cosmos confirma o GTIN mas não fornece thumbnail utilizável, a interface também informa esse estado.
- No teste real do GTIN `7891000053508`, a chamada a `reserve_integration_usage` no Supabase falhou antes de incrementar a cota; por isso o Cosmos nunca foi contatado, embora token, User-Agent e leitura de status estivessem configurados. Para a operação local não voltar a depender dessa falha remota, o servidor preserva a reserva no Supabase como caminho principal e usa o contador local atômico de 25/dia somente como recuperação. Depois que a recuperação é acionada, o status reflete o contador local da sessão. Isso restabelece o comportamento funcional anterior sem expor chaves nem fazer consulta extra automática.

### Foto, validação e alternativa manual

- **A política de foto depende da fonte.** Decisão explícita do usuário em 17 de setembro de 2026. O Open Food Facts continua útil principalmente para nome, marca e apresentação; suas fotos passam pelo filtro de qualidade e podem ser descartadas. A foto do Cosmos, depois de GTIN exato, origem autorizada e bytes válidos, é exibida e pode ser escolhida pelo operador mesmo quando o diagnóstico visual aponta fundo, enquadramento, resolução, desfoque ou múltiplos objetos.
- A qualificação visual da foto do Cosmos é consultiva, não bloqueante. Fundo branco, preto ou de outra cor não exige regra especial: o operador escolhe a imagem e aciona a Kie explicitamente quando precisar remover o fundo. Somente falha técnica — imagem que não carrega, GTIN divergente, origem não autorizada ou arquivo inválido — impede o uso.
- A qualificação guarda também as fotos recusadas ou advertidas, não apenas as aprovadas. A interface informa problemas de enquadramento, fundo, resolução, múltiplos objetos, nitidez, foto dentro de foto ou imagem genérica; esses diagnósticos continuam bloqueando fotos do Open Food Facts e viram avisos nas fotos do Cosmos.
- O bloqueio de imagem genérica é deliberadamente estreito e determinístico, sem IA: detecta um halo grande, arredondado, quase uniforme e pouco texturizado que envolve uma região menor colorida, como os placeholders ilustrados do Cosmos. Fotos reais em fundo branco/transparente seguem os critérios existentes e não dependem de marca ou nome para aprovação.
- Desde 6 de setembro, o corte de embalagem em fundo branco é medido na resolução original da foto, e não mais no canvas reduzido de 256 px. A guarda antiga cobrava 2 px de margem no canvas, o que na prática exigia ~4 px de margem em um arquivo de 500 px e ~16 px em um de 2000 px; por isso o packshot 500 × 500 do Cosmos, que guarda 3 px reais de margem, era reprovado por `framing`. O worker passou a medir o anel externo de 1 px do arquivo original e só conta como corte um pixel claramente não branco (`min(r,g,b) < 232`, abaixo do piso de ruído JPEG de 241 medido no GTIN `7891000053508`), exigindo mais de 0,4 % do anel. A guarda antiga do canvas permanece como fallback para chamadas sem worker. Uma foto de fato cortada continua reprovada.
- A imagem só entra no cartaz após clique explícito do operador. Uma foto reprovada do Open Food Facts não é usada como fallback; uma foto advertida do Cosmos permanece selecionável porque a decisão final é humana.
- Se nenhuma foto for aceita, o produto continua selecionável e o operador pode enviar uma foto manual.
- A foto enviada manualmente aparece na própria seção de embalagem e pode ser trocada ou removida. Para a bateria experimental da Kie, o operador aciona explicitamente **Remover fundo com Kie**; o original permanece disponível e o resultado transparente só substitui o cartaz após aprovação humana.
- Não haverá hospedagem pública temporária mantida pelo projeto. A ponte local converte um PNG, JPEG ou WebP de até 5 MB em `data URL`, envia-o ao upload Base64 oficial da Kie e entrega ao `recraft/remove-background` somente a URL temporária retornada pela própria Kie. O original permanece local até o operador acionar o teste; rejeições não podem perder o arquivo original nem disparar novas tentativas automaticamente.
- No primeiro ensaio da ponte, o upload da Kie respondeu `success`, mas a aplicação rejeitou a tarefa porque restringia incorretamente o ID ao prefixo `task_recraft_`. A validação agora aceita o formato geral `task_*` usado pela Kie. A qualidade visual do resultado ainda precisa de novo ensaio explícito: não registrar a Kie como aprovada sem PNG tratado visível e conferido pelo operador.
- O proxy local aceita a frontal aprovada do Open Food Facts e a thumbnail Cosmos de GTIN correspondente. Para o CDN Cosmos, o proxy valida a assinatura binária de JPEG/PNG/WebP porque alguns arquivos reais não vêm com cabeçalho `Content-Type`.

### Medição e posicionamento

- O projeto **não recorta fundo branco por código**. Essa abordagem foi removida em 6 de setembro de 2026: ela resolvia uma lata cilíndrica em fundo branco, mas não embalagem transparente, relevo, sacaria ou garrafa com líquido colorido. A foto aprovada entra no cartaz como veio da fonte, medida mas nunca alterada.
- A remoção de fundo é feita pela Kie, sob comando explícito do operador. O botão **Remover fundo com Kie** vale tanto para upload manual quanto para foto trazida pela busca por EAN/GTIN, e desaparece quando a foto já está sem fundo. Selecionar um produto não consome chamada da Kie.
- Entre o clique no produto e a remoção do fundo, o cartaz mostra a embalagem dentro de um retângulo branco. Isso é deliberado: comunica que a foto ainda tem fundo. Não é estado de exportação — a conferência do operador continua sendo o portão do arquivo final.
- A medição de ancoragem escolhe o critério pela imagem: com alfa, mede a silhueta pelo canal alfa; opaca, mede a caixa do conteúdo não branco (`min(r,g,b) < 232`, exigindo ao menos 3 pixels por linha ou coluna). Como os dois critérios enquadram a mesma silhueta, o produto não salta de posição quando o fundo sai.
- **A escala automática usa peso visual, não apenas uma caixa máxima.** Decisão do usuário em 17 de setembro de 2026 após comparar um pacote vertical de Croques com um multipack horizontal de Danoninho. A silhueta busca uma área-alvo, preservando a proporção e parando antes dos limites seguros: no Story, `135.200 px²`, largura máxima `440` e altura máxima `520`; no Feed, `72.200 px²`, largura máxima `298` e altura máxima `380`. Assim, o Danoninho de referência passa de aproximadamente `330 × 234` para `437 × 310` no Story, enquanto uma embalagem vertical `1:2` permanece em `260 × 520`. Produtos de proporção extrema podem não alcançar a área-alvo. O operador continua sem controle livre de escala.
- Margem transparente e sombra muito fraca não alteram o encaixe.

