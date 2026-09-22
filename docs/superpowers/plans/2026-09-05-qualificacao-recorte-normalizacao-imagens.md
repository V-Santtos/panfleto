# Plano — qualificação, recorte e normalização de imagens

Data: 5 de setembro de 2026
Estado: aprovado pelo usuário em 5 de setembro de 2026; Etapas 1 e 2 implementadas; primeiro recorte determinístico integrado para calibração visual. Recorte neural, cache e persistência permanecem pendentes.

## Correção de direção recebida durante a execução

O usuário exige que o grid mostre somente o produto isolado em fundo branco ou transparente, exemplificado por Terra Viva e Xandô. Esta instrução substitui, para a exibição de candidatas, a aceitação de fundo sólido colorido, fotos recuperáveis de ambiente e o fallback de três fotos ruins. A foto precisa passar pelo filtro antes de aparecer; nenhum fundo será removido para fazer uma foto informal parecer candidata já tratada. Sem foto aprovada, mostrar estado explicativo, nunca reinserir reprovadas.

Em correção posterior, o usuário esclareceu que a descoberta do produto é prioritária: o operador precisa encontrar o SKU por nome, marca ou GTIN/EAN mesmo que não exista uma foto utilizável. Portanto, o grid mantém a candidata textual relevante quando não há foto ou quando a foto é reprovada, mas não exibe a foto crua; apresenta estado de "sem foto aprovada" e oferece upload local da embalagem. O filtro visual passa a decidir somente se a foto de uma fonte externa pode preencher automaticamente o Story, e não se o produto pode ser encontrado. A busca por GTIN/EAN consulta o registro exato, com validação de dígito verificador; GS1 continua sendo uma futura fonte contratada, não uma integração implícita.

Em 05/09/2026, o usuário aprovou substituir o campo fixo de peso por uma apresentação comercial modular. O formulário precisa registrar valor e unidade separadamente, preencher ambos a partir da quantidade retornada pela busca e permitir correção manual. Para manter o conteúdo comercial legível e validável no MVP, as unidades iniciais são g, kg, ml, L e unidade. O SVG deve mostrar exatamente a combinação confirmada; a mudança não depende do processamento de imagem.

Na revisão seguinte, o usuário apontou que o menu nativo de unidades no Windows quebra a coerência visual e comprime o campo de valor. A apresentação passa a usar um seletor próprio, com seta, opções alinhadas e estado selecionado visível. Em painéis estreitos, apresentação e preço ficam empilhados para que valor, unidade e mensagens de validação não se comprimam nem desalinharem.

Na sequência, o usuário aprovou remover da tela rótulos técnicos que não ajudam o operador, incluindo o marcador de teste, a fonte de busca e a regra interna de qualificação da foto. A busca mantém nome, marca, EAN e GTIN como orientação curta. O mesmo pedido revisa a restrição anterior de PDF: o MVP passa a oferecer, ao lado do PNG, um PDF local de uma página 9:16 que contém a mesma renderização aprovada do Story. Não há novo layout de impressão, exportação multipágina nem serviço externo.

Por pedido explícito posterior, a integração da Kie fica pré-configurada sem disparar tarefas nem consumir créditos. O servidor Vite local lê `KIE_API_KEY` de `.env.local`, expõe somente rotas internas de criação e consulta de tarefa e limita a entrada a URLs HTTPS públicas de embalagens do Open Food Facts. A chave não entra no bundle, uploads manuais continuam fora desse caminho e a seleção de produto não chama a Kie automaticamente. Esse recorte de escopo permite testar a chamada futuramente sem transformar o projeto em backend público ou definir hospedagem temporária de arquivos.

O primeiro teste prático de recorte confirmou que caixas com contorno definido, como Leite Ninho, são um bom caso para o recorte determinístico. A primeira tentativa com garrafa branca Xandô atravessou o contorno claro e foi considerada falha: o algoritmo foi endurecido para comparar o fundo com a cor dos cantos e não com qualquer pixel claro, e a qualificação passou a rejeitar produtos que já chegam encostados na borda da foto. Isso não prova cobertura de todas as embalagens; garrafas e itens brancos com limite visual ambíguo continuam sendo critério para roteamento ao recorte neural ou upload manual, nunca para publicação automática de um recorte danificado.

Após nova calibração, o recorte determinístico passou a amostrar todo o anel de borda, usar tolerâncias adaptativas para luminância/saturação, interromper o preenchimento em gradientes Sobel e executar a máscara em 2× antes de reduzir o PNG. O portão pós-recorte mede a fração removida e componentes restantes. No teste repetido, Xandô foi bloqueado com a mensagem de componentes desconexos, em vez de aparecer parcialmente apagado: este é o resultado seguro esperado enquanto a rota neural não estiver implementada.

A Etapa 1 foi testada com 47 testes e build; a comparação real de Nescau/leite integral mostrou a necessidade de executar agora o filtro visual. Seguem autorizadas as demais etapas do plano, mas o incremento atual prioriza esse filtro conforme a correção do usuário.
Entrada: especificação enviada pelo usuário nesta sessão, no anexo `pasted-text.txt`, e imagem complementar com as três prioridades.

## Objetivo e escopo

Adicionar à busca existente uma camada de relevância e qualidade, processar somente a imagem escolhida e entregar um PNG transparente normalizado ao Story. Upload, cache e métricas completam o mesmo fluxo local.

A solicitação atual amplia explicitamente a bancada experimental para incluir remoção de fundo, upload e IndexedDB, antes excluídos pelos documentos de 4 de setembro e pela nota de busca. Esta ampliação fica registrada neste plano; não altera as metas futuras de 1/4/8 produtos e Feed/Story. Não inclui autenticação, publicação, banco remoto, multitenancy, IA generativa nem trabalho específico para mobile.

O projeto exige aprovação do plano antes da implementação. A skill `superpowers:writing-plans` não foi encontrada nas pastas locais de skills/plugins; este plano foi preparado diretamente, com arquivos, sequência e verificações definidos.

## Estado observado

- `src/domain/productSearch.ts`: consulta Search-a-licious pelo proxy `/api/product-search`, examina até 100 registros e retorna até 33 imagens únicas. Já exige imagem frontal, mas não país nem correspondência textual.
- `src/components/ProductSearch.tsx`: exibe miniaturas cruas depois da resposta completa; clique escolhe imediatamente o produto.
- `src/app/App.tsx`: associa a URL original ao Story; não possui processamento ou cache de imagens.
- `src/components/StoryPoster.tsx`: recebe uma URL e usa SVG compartilhado com a exportação. Manter esse contrato visual.
- `src/export/svgToPng.ts`: incorpora imagens por fetch ao serializar o SVG; receberá a URL local do PNG normalizado.
- `vite.config.ts`: já contém proxy local de busca em `127.0.0.1:4173`.
- Não há repositório Git nesta pasta. Preservar os arquivos existentes e não presumir disponibilidade de rollback por Git.

## Decisões propostas para pontos ambíguos

1. **Proxy:** usar uma rota de imagens no servidor local do Vite, não criar edge function. É uma adaptação explícita para conciliar a necessidade de CORS com localhost. Análise, recorte e armazenamento continuam no navegador. A rota deve ter timeout, limite de tamanho, validação de conteúdo e destinos permitidos; não virar proxy irrestrito. Para URLs externas de drag-and-drop, tentar CORS direto e oferecer colar/selecionar arquivo se o host não for atendido.
2. **Fallback:** mostrar até seis candidatas aprovadas, progressivamente. Se nenhuma alcançar 40, mostrar até três de baixa pontuação apenas quando passarem relevância, país, frontal e critérios eliminatórios, com aviso e upload destacado. Se não existir nenhuma, exibir estado explicativo e upload permanente. “Grid nunca vazio” passa a significar fluxo sempre utilizável, sem inventar resultados ou reinserir reprovadas por critérios eliminatórios.
3. **Limite das heurísticas:** borda, nitidez e ocupação não identificam semanticamente uma prateleira, uma mão ou um produto errado. A meta de nenhuma cena no grid será medida no conjunto de 30 produtos; não pode ser prometida como garantia geral desses cálculos. Registrar falsos positivos e reprovar o aceite se ocorrerem no conjunto validado.
4. **Alpha:** borda transparente acima de 90% permite dispensar remoção de fundo, mas não dispensa resolução, conteúdo não vazio, nitidez e ocupação. Um pixel de produto dentro de um PNG transparente não recebe aprovação automática.
5. **Ocupação:** medir a bounding box estimada do objeto em relação à área original. Medir depois de cortar para a própria bounding box tornaria a métrica inútil. Se fundo não permitir estimativa confiável, registrar ocupação desconhecida e encaminhar como recuperável, sem selo verde automático. A seleção precisa ser conferida após o recorte.
6. **Pontuação e roteamento:** score alto sozinho não autoriza flood fill. `PRONTO` requer fundo branco/sólido confiável ou transparência válida. Fundo incerto com score alto fica em `RECUPERÁVEL`. Registrar score, métricas e motivo do roteamento separadamente.
7. **Cache:** EAN é índice de reutilização, não identidade universal de arquivo. Chave inclui origem, EAN quando disponível, identidade da imagem e versão de processamento. Upload sem EAN usa hash do conteúdo; nunca gerar EAN fictício. A mesma imagem e configuração não repetem recorte; uma embalagem diferente do mesmo EAN não herda silenciosamente a foto antiga. Alterar escala refaz apenas normalização a partir do recorte guardado.
8. **Prazo:** medir primeiro uso neural com download e uso com modelo em cache separadamente. Os limites de 15/30 segundos são metas a verificar no computador/rede de teste, incluindo primeiro uso em relatório próprio, não garantias antecipadas.

Essas decisões fazem parte do que será aprovado com este plano.

## Sequência de incrementos

### 1. Relevância da busca e procedência desde a entrada

Modificar `src/domain/productSearch.ts`; criar `src/domain/productSearch.test.ts` e `src/images/types.ts`; ajustar `src/components/ProductSearch.tsx` apenas para estados e mensagens necessários.

- Preservar endpoint e mecanismo atuais. Usar sintaxe de filtro do Search-a-licious para Brasil e verificar o campo de país da resposta. Não copiar parâmetros da API v2 para esse endpoint sem comprovação.
- Escapar texto digitado ao compor a consulta para não permitir que operadores da linguagem de busca neutralizem o filtro.
- Normalizar acentos, caixa e separadores para comparar tokens com nome/marca. Remover tokens sem conteúdo, como preposições isoladas; pelo menos um token significativo precisa coincidir. Não confundir isso com garantia de SKU exato.
- Ordenar correspondências mais completas antes de correspondências parciais; não usar quantidade/unidade isolada como evidência de relevância.
- Exigir frontal selecionada. Confirmar os campos reais e a maior resolução oferecida para essa frontal; não selecionar foto crua nem adivinhar URLs trocando extensão.
- Acrescentar `origem: openfoodfacts`, nome, marca, EAN/código e URL original no adaptador de entrada. Definir também as demais origens solicitadas, sem implementar integrações GS1/Cosmos.
- Preparar cancelamento por AbortController e identificador da busca para impedir resultados antigos de substituírem uma consulta nova.

Testes: Nescau exclui Love Hearts; acentos e caixa; marcas em array/string; país ausente/incorreto; frontal ausente; duplicatas; texto com operadores; consultas curtas; resposta vazia/erro/cancelamento. Verificar resposta real de Nescau e um termo genérico no navegador.

**Primeiro ponto de revisão:** comparar o grid após este incremento com a busca atual, antes de desenvolver processamento de pixels. Registrar contagens antes/depois e limitações de cobertura. Não declarar as etapas seguintes concluídas com base nessa melhora.

### 2. Análise de imagens em Worker e grid progressivo

Criar `src/images/analysis.ts`, `analysis.test.ts`, `imageLoader.ts`, `qualification.worker.ts`, `qualificationClient.ts` e configurações versionadas de thresholds. Acrescentar rota local de imagens em `vite.config.ts` ou módulo de desenvolvimento separado.

- Carregar a frontal de maior resolução disponível, registrar suas dimensões reais e reduzir o lado maior a no máximo 256 px para métricas.
- Transferir buffers/ImageBitmap ao Worker; fechar bitmaps e revogar object URLs quando não forem mais necessários. Não analisar canvas cheio na thread da interface.
- Fila limitada, inicialmente duas imagens simultâneas, para evitar baixar/decodificar todas em paralelo. Publicar um resultado por candidata e encerrar trabalhos obsoletos.
- Calcular alpha na borda, luminância/desvio no anel de 3 px, uniformidade cromática, Laplaciano, ocupação estimada e contato com bordas. Luminância uniforme sozinha não prova cor uniforme.
- Aplicar resolução mínima de 600 px no lado maior e ocupação conhecida entre 30% e 92%. Detectar imagem vazia ou indecodificável.
- Configurar inicialmente a soma: fundo 35, nitidez 30, resolução 20 e enquadramento/ocupação 15; penalidade por contato com bordas até 25. Limitar score a 0–100. Transparência válida permite 100 após os eliminatórios. Calibrar thresholds de nitidez/fundo com fixtures e registrar qualquer ajuste; não fabricar precisão a partir dos pesos.
- Exibir seis melhores avaliadas, score/estado e selo verde somente para PRONTO. Mostrar progresso de quantidade avaliada e estabilizar a seleção por ID mesmo que o ranking mude.
- Aplicar o fallback descrito acima somente quando houver evidência suficiente de que não há aprovadas, evitando piscar reprovadas enquanto ainda há candidatas pendentes.

Testes: branco/sólido/texturizado, cores de mesma luminância, nítido/desfocado, 599/600 px, ocupação 29/30/92/93%, alpha vazio/parcial/válido, borda cortada, falha de CORS/decodificação, resultados fora de ordem, troca de consulta. Confirmar que o primeiro resultado aparece antes de terminar a fila e que os controles continuam respondendo.

### 3. Recorte determinístico e normalização compartilhada

Criar `src/images/cutout.ts`, `normalize.ts`, `processing.worker.ts`, `processingClient.ts` e respectivos testes.

- Iniciar processamento somente após clique ou confirmação do upload.
- Alpha válido mantém o recorte original. Fundo branco/sólido usa flood fill conectado aos quatro cantos com tolerância calibrável; não apagar indiscriminadamente pixels claros do interior da embalagem.
- Feather de 1 px junto ao limite da máscara. Verificar resultado vazio, perda excessiva de objeto e halo; não converter falha em sucesso silencioso.
- Guardar PNG recortado na resolução original. Calcular bounding box de alpha com limiar explícito para evitar ruído isolado.
- Normalizar em 1000×1000 com área útil 840×840 (80 px de margem por lado), proporção preservada, centro horizontal em 500 e base em 920.
- Escalar dentro da área útil: garrafão/fardo 1,00; caixa/lata 0,75; pote 0,65; sachê/tablete 0,50. Categoria desconhecida usa fator neutro 1,00 claramente ajustável; não inferir escala física pela aparência sem dados.
- Salvar categoria/fator junto da normalização. Alteração refaz o encaixe usando o recorte existente e invalida confirmação de exportação.
- Usar estados explícitos: analisando, aguardando escolha/aviso, recortando, normalizando, pronto, erro/cancelado.

Testes: embalagem branca sobre fundo branco, áreas claras internas desconectadas do fundo, produto alto/largo, furos e transparência parcial, bordas suaves, PNG vazio, padding/base/escala exatos e leitura real do PNG final. Conferência visual de halo e integridade de rótulo; geometria correta não comprova recorte correto.

### 4. Recorte neural sob demanda

Criar `src/images/neuralCutout.ts` e integrar ao Worker de processamento; alterar dependências somente neste incremento.

- Confirmar versões compatíveis de `@imgly/background-removal` e `onnxruntime-web`, tipos reais da configuração e empacotamento Vite.
- Usar `isnet_quint8`, import preguiçoso e execução em Worker; jamais importar/carregar o modelo como consequência de uma busca ou de uma candidata analisada.
- Usar progresso real no download; durante inferência sem percentual observável, mostrar etapa indeterminada, sem inventar porcentagem.
- Verificar requisitos de Worker, WASM, isolamento de origem e headers com os ativos do aplicativo. Evitar duas camadas de workers incompatíveis com a biblioteca.
- Arquivos de modelo/runtime devem poder ser servidos localmente; registrar download inicial e comportamento sem rede. Não enviar imagens para inferência remota.
- Cancelamento/troca de seleção descarta resultados antigos e libera recursos. Falha mantém o usuário no fluxo de escolha/upload.
- Normalização posterior é exatamente a mesma da etapa determinística.

Testes: nenhuma chamada neural durante busca/grid; clique recuperável carrega uma vez; segunda seleção reutiliza modelo; falha de download; cancelamento; troca rápida de produto; resultado vazio; exportação bloqueada enquanto processamento não termina. Medir primeiro uso e uso em cache.

Nota de dependência: a documentação oficial declara licença AGPL e opções alternativas de licenciamento. Registrar a licença escolhida e suas condições antes de distribuição; a autorização deste protótipo não resolve uma decisão comercial futura. A documentação confirma `isnet_quint8` e download sob demanda, mas a integração deve usar versões compatíveis verificadas no momento da instalação.

### 5. Upload sempre visível e integração com o Story

Criar `src/components/ImageUpload.tsx`, `ImageUpload.test.tsx` e `src/images/upload.ts`; integrar `ProductSearch.tsx`, `App.tsx` e estilos existentes.

- Área permanente junto ao grid, com instrução para copiar uma imagem e colar com Ctrl+V; seletor e arrastar/soltar como alternativas.
- Paste lê Blob de imagem, sem tomar atalhos de colagem textual dos campos. Remover listeners na desmontagem.
- Drop aceita File e examina URI/HTML quando o navegador fornecer imagem arrastada de outra aba. URL de uma página de resultados não é arquivo de imagem; se não houver Blob/URL utilizável, explicar como copiar a imagem ou escolher arquivo.
- Validar tipo, tamanho de arquivo, dimensões máximas e decodificação antes de alocar canvas grande. Não inserir HTML recebido na interface.
- Rodar as mesmas métricas antes do recorte. Baixa resolução/nitidez apresenta aviso específico com valor medido e confirmação para continuar; nunca processar silenciosamente após reprovação. Casos perigosos para memória ou arquivo inválido permanecem bloqueados.
- Registrar `origem: upload_usuario`; EAN/nome/marca não são inventados a partir da foto.
- Trocar `selectedProduct` por seleção que associa metadados ao ativo processado. Somente publicar imagem normalizada no Story quando o trabalho correspondente terminar com sucesso.
- Preservar preço e demais dados comerciais, exigir confirmação após troca e usar o mesmo PNG local no preview e exportação SVG. A apresentação comercial já é modular: preencher valor e unidade quando a quantidade da candidata for reconhecida, e permitir que o operador ajuste ambos antes da confirmação.

Testes: Blob colado, colagem de texto, arquivo, drop de URL válido/não permitido, imagem de 320 px com aviso específico, confirmação/cancelamento, falha de processamento, seleção obsoleta e exportação durante processamento. Testar clipboard real no navegador, além das simulações de eventos.

### 6. Persistência de ativos e cache

Criar `src/images/imageCache.ts` e testes com IndexedDB de teste ou testes de navegador apropriados.

Registro mínimo: `id`, `ean` opcional, `nome`, `marca`, `origem` obrigatória, `score`, `url_original` opcional em uploads locais, `png_recortado` Blob, `png_normalizado` Blob, `largura`, `altura`, `criado_em`. Definir largura/altura como dimensões do recorte original e guardar explicitamente dimensões normalizadas, hash/identidade da fonte, versão do pipeline, categoria e escala.

- Índice por EAN e origem; procurar antes de iniciar processamento. Deduplicar trabalhos simultâneos para a mesma chave.
- Gravar as duas versões em transação; não persistir object URLs, pois não sobrevivem à sessão.
- Cache correto evita reprocessar; troca de fonte ou configuração usa as regras da seção de decisões.
- Tratar quota, indisponibilidade e registros incompletos. Permitir resultado em memória com aviso de que não será reutilizado se a persistência falhar.
- Nenhuma sincronização/servidor nesta etapa. Origem permite separação futura, mas não prova autorização de redistribuição. Metadados contratuais e licenças de cada fonte deverão ser verificados antes de banco compartilhado; origem GS1/Cosmos por si só não libera envio.

Testes: hit/miss, mesmo EAN com origens/fotos distintas, uploads sem EAN, mudança apenas de escala, recarga, falha de quota, transação incompleta e procedência obrigatória.

### 7. Telemetria local e painel de debug

Criar `src/telemetry/imageTelemetry.ts`, testes e `src/components/ImageDebugPanel.tsx`.

- Um ID por tentativa de busca/resolução. Registrar contagem bruta, pós-relevância, avaliada, scores ≥70 e ≥40, eliminadas, erros e efetivamente exibidas; limiares contam apenas elegíveis.
- Registrar resolução por busca/upload, cache hit/miss e pipeline determinístico/neural/alpha.
- Medir desde a primeira edição que inicia a tentativa até PNG normalizado pronto; guardar separadamente clique Buscar, retorno da API, análise, escolha, download do modelo, recorte e normalização. Upload sem consulta mede desde a entrada do arquivo e marca termo ausente.
- Definir rejeição da primeira sugestão como escolha explícita de outra imagem após a sugestão inicialmente apresentada, sem contar reordenação automática do grid. Guardar ID/rank apresentado e trocas posteriores separadamente.
- Painel recolhível com contagens e tempos, persistência local versionada e exportação CSV correta para acentos, aspas, vírgulas e quebras de linha. Neutralizar fórmulas em texto exportado.
- Não transmitir telemetria nem incluir bytes das imagens no CSV.

Testes: contagens consistentes, busca seguida de upload, cancelamento, repetição de consulta, primeira sugestão trocada, cache, tempos com relógio controlado e exportação CSV.

## Validação final com 30 produtos

Selecionar SKUs reais de mercado brasileiro e registrar marca, variante, peso/volume, consulta, EAN quando existir e data da coleta. Lista inicial de categorias/termos a concretizar:

1. Nescau; 2. Toddy; 3. arroz branco; 4. arroz integral; 5. feijão carioca; 6. feijão preto; 7. refrigerante cola 2 L; 8. guaraná 2 L; 9. água mineral 1,5 L; 10. suco de uva; 11. sabão em pó; 12. sabão líquido; 13. detergente; 14. amaciante; 15. leite integral longa vida; 16. leite desnatado longa vida; 17. biscoito recheado; 18. biscoito cream cracker; 19. café moído; 20. açúcar; 21. óleo de soja; 22. macarrão; 23. molho de tomate em sachê; 24. leite condensado; 25. creme de leite; 26. milho em lata; 27. sardinha em lata; 28. maionese em pote; 29. margarina em pote; 30. chocolate em tablete.

Não presumir cobertura de limpeza no Open Food Facts. Resultados ausentes também são evidência; testar o upload correspondente e registrar a fonte, sem trocar de API silenciosamente.

Criar relatório em `docs/superpowers/notes/` com os 30 casos, tempos reais, cache frio/quente, capturas do grid e normalizados, falhas de associação, cenas indevidas, recortes danificados e disponibilidade. Não marcar teste manual ou humano como executado sem evidência.

Aceite:

- Nenhum resultado textual sem relação nem cena indevida no conjunto validado; registrar qualquer falha como reprovação.
- PNGs selecionados 1000×1000, transparência real, proporção e alinhamento corretos; nenhum rótulo/preço alterado pelo pipeline.
- Clipboard real, drop e seletor utilizáveis; fallback oferece saída mesmo sem candidata.
- Metas <15 s determinístico e <30 s neural medidas e reportadas, com download inicial separado e também incluído no total frio.
- Interface responde durante análise/inferência; verificar interação real e tarefas longas, não inferir fluidez apenas pela existência de Worker.
- Preview/exportação usam o mesmo ativo normalizado, sem foto antiga após corrida assíncrona.
- Cache reutiliza processamento e mantém procedência; painel/CSV distinguem busca e upload.
- Executar `npm test` e `npm run build` por incremento relevante; testes novos acompanham a menor implementação e verificações de navegador cobrem APIs que o jsdom não comprova.

## Referências técnicas consultadas

- [Sintaxe de consulta do Search-a-licious](https://openfoodfacts.github.io/search-a-licious/users/explain-query-language/): filtros na linguagem de consulta; confirmar campos no índice ativo.
- [API Search-a-licious](https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/).
- [Documentação oficial da biblioteca IMG.LY](https://github.com/imgly/background-removal-js/blob/main/packages/web/README.md): modelo, Worker/runtime, download, progresso e licença.

## Aprovação solicitada

Aprovar este plano e suas decisões explícitas libera a implementação incremental, começando pela relevância da busca e origem obrigatória. A primeira comparação do grid será apresentada antes de avançar para o processamento de imagens, conforme a prioridade enviada pelo usuário.
