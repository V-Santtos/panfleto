# Registro das sessões de 5 a 7 de setembro de 2026

**Natureza deste arquivo:** histórico. Relata o que aconteceu em cada sessão e por
quê. Serve para entender a origem de uma decisão; não é fonte de estado corrente nem
de regra vigente. Onde este registro divergir de
[`../../CONTEXTO_ATUAL.md`](../../CONTEXTO_ATUAL.md) ou de
[`../../referencia/DECISOES.md`](../../referencia/DECISOES.md), valem aqueles.

## Aprendizados do teste Kie — 2026-09-05

- Fluxo validado com a garrafa branca Xandô sobre fundo branco: foto manual → upload temporário Kie → `recraft/remove-background` → PNG transparente → revisão humana → SVG do Story.
- A Kie concluiu todas as tarefas; seus IDs reais são hexadecimais e não têm necessariamente o prefixo `task_`. A integração local aceita o identificador devolvido pelo provedor sem inventar um formato próprio.
- O PNG final deve passar por relay local antes de chegar ao navegador. Isso evita depender de CORS, mantém a URL externa fora do SVG e permite baixar o resultado imediatamente, antes da expiração do link da Kie.
- O resultado aprovado precisa aparecer na seção **Embalagem do produto**, identificado como “Resultado da Kie aprovado”, com ações de trocar ou remover. O operador não vê chave, URL, ID de tarefa, campo de recuperação ou referência à infraestrutura Kie.
- Foto original, candidato de revisão e resultado aprovado são estados distintos. A imagem só muda no Story após a aprovação explícita; erros antigos do recorte local não permanecem visíveis depois dessa aprovação.
- Durante o teste ao vivo, pequenas alterações de cliente por HMR preservaram o rascunho; não reiniciar Vite, não recarregar a página e não fazer nova busca ou tarefa externa sem autorização explícita.


## Correções da sessão de 6 de setembro

- A guarda de corte da qualificação passou a medir na resolução original. Antes ela cobrava margem proporcional ao tamanho do arquivo e reprovava o packshot 500 × 500 do Cosmos, que tem 3 px reais de margem.
- O roteamento da medição passou a exigir **borda** transparente. Antes, um único pixel com alfa < 250 fazia uma foto em fundo branco ser medida pelo canal alfa, e a caixa virava a tela inteira: produto pequeno e flutuando, sem erro visível.
- O consumo do resultado da Kie voltou a buscar o relay direto. O status já devolve `/api/kie/remove-background/<task>/image` na mesma origem; passá-lo para a rota de importação, que exige URL absoluta em `kieops.com`, fazia a tarefa concluída na Kie ser recusada aqui.
- O botão **Remover fundo com Kie** passou a valer também para foto vinda da busca por EAN/GTIN, e a fonte enviada nunca é a própria saída aprovada da Kie.
- A base física medida fica na linha `y=1608` do pedestal. O centro comum dos produtos está em `x=708`, levemente à esquerda do centro anterior para o equilíbrio visual do Story.
- O arquivo-fonte não é cortado nem deformado. A escala respeita largura e altura seguras do slot.
- Quando a imagem não possui sombra própria sob a silhueta, o SVG renderiza uma sombra radial de contato proporcional. Se ela já possui sombra, não duplica o efeito.
- No último teste visual concluído, o pote de Toddy vindo do Cosmos foi reconhecido como PNG transparente e ficou corretamente apoiado após a calibração da base. A nova sombra foi implementada e coberta por teste automatizado, mas ainda precisa de uma próxima seleção real para avaliação visual.
- **Exceção aprovada em 6 de setembro de 2026:** há ajuste direto da posição da embalagem por arraste no Story/1, limitado à silhueta alfa e ao palco quando a geometria está disponível. Não é um editor livre: o produto não é redimensionado, rotacionado nem separado dos dados da oferta; texto, preço, unidade, fundo e identidade continuam fixos. Fotos manuais ainda sem geometria usam provisoriamente a caixa da imagem e os limites gerais do Story para que o gesto possa ser validado. Feed/1 aguarda o aceite do Story.


## Resultado do primeiro teste real e decisões seguintes — 7 de setembro

- O usuário confirmou que o fluxo real concluiu corretamente e que o Nescau foi criado no Supabase, recuperado pela pesquisa do catálogo próprio e exibido com sua foto aprovada.
- A persistência foi deliberadamente restringida ao produto e à foto. Preços, preço anterior, posição, tema, formato, confirmação e demais dados da oferta continuam temporários; as tabelas de campanha existentes não serão ligadas ao aplicativo neste corte.
- EAN/GTIN permanece único. O nome de referência será preservado em `canonical_name` e o último nome aprovado para o cartaz ficará em `display_name`. Reutilizar um produto atualiza somente `display_name` quando necessário.
- Depois de PNG ou PDF bem-sucedido, a oferta permanece aberta para correção ou segundo formato. Um botão **Criar nova oferta** aparece abaixo do sucesso; ele limpa o rascunho, preserva tema/formato, rola até a pesquisa e foca o campo.
- **Abrir cadastro manual** permanece visível, mas desabilitado enquanto a pesquisa possui texto. Com o formulário manual aberto, a busca fica indisponível até fechar/cancelar.
- Busca por nome/marca passa a ser incremental a partir de dois caracteres, com debounce, somente no catálogo próprio e mostrando a miniatura já persistida. Número parcial ou GTIN completo nunca dispara fonte externa sem **Buscar** ou Enter.
- Cards de produtos já cadastrados recebem borda verde com o mesmo token do bullet **Já cadastrado**; o estado selecionado continua distinguível sem voltar a borda para preto.
- O plano consolidado é [`superpowers/plans/2026-09-07-catalogo-reutilizavel-busca-e-nova-oferta.md`](../plans/2026-09-07-catalogo-reutilizavel-busca-e-nova-oferta.md) e aguarda aprovação antes da implementação.


## Ajuste validado — autocomplete e coerência da seleção, 7 de setembro

- A busca incremental não empilha mais cards grandes no fim da seção. Os resultados aparecem em linhas horizontais num dropdown ligado à base do campo, com miniatura e dados essenciais.
- Produto cadastrado comunica o estado antes do clique: borda e trilho verdes, fundo verde suave, bullet e rótulo **Já cadastrado**. Hover ou navegação por teclado intensificam o realce sem criar um falso estado persistido.
- O campo implementa semântica de combobox, aceita setas, Escape e Enter. Selecionar preenche o campo com `display_name`, fecha as sugestões e não agenda uma segunda busca automática.
- Pesquisa e seleção agora formam um único estado coerente. Editar ou apagar o texto depois de selecionar desfaz o produto anterior e limpa foto, processamento, resultado Kie pendente e placement; campo vazio nunca mantém **Embalagem do produto** visível.
- Essa limpeza não é o reset completo de **Criar nova oferta**, não escreve no Supabase e não consulta fontes externas.
- A validação automatizada passou em **27 arquivos e 202 testes**, além do build. O ensaio visual real com `NE` mostrou o Nescau no dropdown verde com miniatura; apagar uma seleção removeu a seção da foto.


## Ponto exato de retomada — plano aguardando aprovação

**Objetivo declarado do teste naquele momento:** implementar, depois da aprovação do plano, o catálogo reutilizável com nome exibido persistente, busca incremental local, estados visuais de produto cadastrado e encerramento explícito por nova oferta. Esse objetivo foi cumprido; a linha está preservada aqui porque saiu do documento de retomada ao ser dividido.

- O Vite continua rodando em `http://127.0.0.1:4173/` e não deve ser reiniciado. O primeiro fluxo real de produto/foto foi aprovado pelo usuário.
- A implementação seguinte é exclusivamente o plano [`superpowers/plans/2026-09-07-catalogo-reutilizavel-busca-e-nova-oferta.md`](../plans/2026-09-07-catalogo-reutilizavel-busca-e-nova-oferta.md), depois de sua aprovação humana.
- Antes de editar React, avisar que o HMR pode desmontar o rascunho atualmente aberto. Não recarregar o navegador nem iniciar outro Vite.
- Implementar com testes primeiro: `display_name`, atualização restrita, busca incremental com miniatura, cadastro manual exclusivo, borda verde e **Criar nova oferta**.
- Não ligar campanhas/exportações, não consultar Cosmos automaticamente e não gastar créditos Kie.

