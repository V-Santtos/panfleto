# Catálogo Promocional para Supermercados

## Veredito e escopo do MVP — v1

- Data: 4 de setembro de 2026
- Origem: sessão de definição e crítica com o método GO
- Estado: construção do MVP liberada
- Case inicial: supermercado real já identificado; identidade e dados serão fornecidos em uma etapa posterior

## 1. Veredito

**VEREDITO: SEGUIR**

Construir o MVP é justificável porque o teste é pequeno, tecnicamente plausível, barato de abandonar e existe um canal local de venda. O produto, entretanto, deve nascer como **serviço local assistido com software próprio**, e não como uma tentativa de criar um SaaS nacional inédito.

### Aposta central

> Isso só funciona se um funcionário do supermercado conseguir transformar ofertas reais em peças corretas e publicáveis, sozinho e em poucos minutos, repetir esse uso e aceitar pagar pela economia de tempo, consistência e suporte local.

### O que aguentou o ataque

- A atividade existe: supermercados comunicam ofertas e várias empresas vendem ferramentas para isso.
- A proposta técnica é estreita e reversível: seis layouts, dez produtos e exportação PNG.
- O usuário tem acesso direto a supermercados de cidades próximas.
- A meta de aproximadamente 20 clientes permite operação local e implantação personalizada.
- Identidade pronta e fluxo limitado podem vencer ferramentas genéricas em simplicidade.
- Implantação mais mensalidade é compatível com o trabalho humano envolvido.

### O que quebrou

- A funcionalidade não é inédita; existem concorrentes brasileiros com recursos iguais ou superiores.
- Uma demonstração gratuita e bonita não valida demanda nem disposição a pagar.
- Dez produtos perfeitamente preparados escondem o possível gargalo da rotina: cadastrar, localizar e tratar novos produtos.
- O aplicativo não pode prometer aumento causal de vendas sem evidência.
- “Os mercados ainda não usam porque a solução não chegou até eles” é uma hipótese, não um fato confirmado.

### Formulação aprovada para seguir

> Serviço assistido de comunicação promocional para supermercados locais, apoiado por uma aplicação web de marca própria que reduz o tempo entre a definição das ofertas e a publicação de peças profissionais para feed e Stories.

### Proposta de valor inicial

> Suas ofertas, com a identidade do seu supermercado, prontas para publicar em poucos minutos — sem precisar montar cada arte do zero.

Não usar inicialmente como promessa principal: “o aplicativo aumenta suas vendas”.

## 2. Matriz de cobertura crítica

| Bateria | Estado | Evidência principal | Confiança |
| --- | --- | --- | --- |
| Falsificação | RESISTIU | Há critérios observáveis de uso, publicação, tempo, erro e pagamento capazes de refutar a tese. | Alta |
| Pre-mortem 90 dias | RESISTIU | Risco principal identificado: demonstração bonita, mas operador não adota ou comete erro de preço. | Alta |
| Pre-mortem 12 meses | RESISTIU | Risco principal identificado: personalização e suporte crescerem junto com a receita e destruírem a margem. | Alta |
| Por que ninguém fez | QUEBROU | Muitos já fizeram; há concorrentes verticais brasileiros ativos. Originalidade não pode ser a tese. | Alta |
| Substituição | RESISTIU | O produto compete com Canva, designer, agência, foto simples, materiais de fornecedor e não publicar. | Alta |
| Quem perde | RESISTIU | Trabalho repetitivo de funcionário/designer é reduzido; agências podem resistir ou virar canal white-label. | Média |
| Realidade econômica | RESISTIU | Meta de 20 clientes pode gerar renda adicional se implantação for cobrada e suporte for limitado. Valores ainda são hipóteses. | Média |
| Distribuição | RESISTIU | Venda presencial, relacionamento local e indicação são canais coerentes com uma meta pequena. CAC ainda não foi medido. | Média |
| Custo de reversão | RESISTIU | Escopo técnico curto, single-tenant e sem integrações torna barato descobrir que a tese está errada. | Alta |
| Alternativa mais barata | RESISTIU | Um protótipo renderizador e piloto instrumentado é a alternativa de 20% do esforço; multitenancy e automações ficam para depois. | Alta |

## 3. Produto

### O que é

Uma aplicação web responsiva, inicialmente dedicada a um único supermercado, que combina produtos e preços com layouts previamente desenhados e exporta artes promocionais prontas.

### O que não é

- Não é catálogo navegável para consumidores.
- Não é loja virtual.
- Não é editor livre semelhante ao Canva.
- Não é sistema de estoque ou ERP.
- Não é agência que produz manualmente toda campanha.
- Não é plataforma multiempresa no primeiro ciclo.

### Cliente e operadores

- Comprador: proprietário ou gestor do supermercado.
- Operador principal: funcionário responsável pela divulgação das ofertas.
- Administradores do MVP: os criadores, responsáveis pela marca, produtos e layouts iniciais.

## 4. Objetivo do MVP

Provar duas coisas separadamente:

1. **Prova técnica:** o motor combina dados e imagens e exporta seis tipos de peças com fidelidade e qualidade.
2. **Prova de produto:** um operador real usa sozinho, publica sem retrabalho, repete o processo e o proprietário aceita pagar.

O primeiro build pode concluir a prova técnica. O piloto é que pode concluir a prova de produto.

## 5. Escopo funcional

### 5.1 Configuração fixa do case

- Uma única identidade visual.
- Logo do supermercado.
- Paleta de cores.
- Tipografia licenciada ou de uso permitido.
- Elementos gráficos da marca.
- Um único tema promocional genérico.
- Rodapé padrão com informações comerciais.

A configuração será feita manualmente por nós. O cliente não terá editor de marca no MVP.

### 5.2 Base de produtos

- Exatamente dez produtos de teste preparados manualmente.
- Imagens PNG com fundo transparente.
- Nome do produto.
- Apresentação ou unidade, como `5 kg`, `1 L`, `500 g`, `kg` ou `unidade`.
- Preço promocional informado para a campanha.
- Preço anterior opcional.

Não será construída nesta etapa uma solução definitiva de cadastro, busca de imagens, planilha, leitura por câmera de código de barras ou integração com estoque.

O ambiente local pode manter configurada uma rota opcional para o recorte neural da Kie. A chave permanece no servidor local e a chamada continua manual: não há processamento automático, callback público, hospedagem de upload ou promessa de uso em produção nesta etapa.

O ambiente local também pode manter configurado o conector opcional do Cosmos para testes controlados. Ao pesquisar um GTIN/EAN exato, a ação do operador consulta Cosmos e Open Food Facts em paralelo, unindo os retornos somente quando o código corresponde. O token e o `User-Agent` ficam exclusivamente no servidor Vite local. Um contador persistente local limita a 25 chamadas externas por dia no fuso de São Paulo e bloqueia a 26ª antes da saída da rede. Fotos de cada fonte são exibidas com procedência e passam pelo validador local antes da escolha. Se a cota acabar, não houver foto ou o Cosmos falhar, a busca gratuita e o upload manual continuam funcionando. A consulta permanece uma sugestão que exige confirmação humana de nome, apresentação, foto, preço e associação final; nenhuma busca textual usa Cosmos automaticamente nesta etapa.

Depois do aceite da foto, o motor mede o retângulo visível da embalagem pelo canal alfa, despreza margem transparente e sombra muito fraca e usa a base medida como âncora do pedestal. A escala respeita largura e altura seguras do slot e não recorta nem deforma a imagem original. Quando a imagem não possui sombra própria abaixo da silhueta, o SVG aplica uma sombra radial de contato proporcional; quando ela já possui, não duplica o efeito.

### 5.3 Criação de campanha

O operador poderá:

1. Iniciar uma nova campanha.
2. Escolher a quantidade de produtos: **1, 4 ou 8**.
3. Selecionar produtos sem repetição entre os dez disponíveis.
4. Informar ou revisar preço promocional.
5. Informar preço anterior, opcionalmente.
6. Revisar apresentação/unidade.
7. Informar período de validade da oferta.
8. Revisar as informações antes da geração.

### 5.4 Composições

Serão desenhadas seis composições independentes dentro do mesmo sistema visual:

| Canal | 1 produto | 4 produtos | 8 produtos |
| --- | ---: | ---: | ---: |
| Story vertical | Sim | Sim | Sim |
| Feed vertical | Sim | Sim | Sim |

O criativo final terá dimensões fixas. Apenas a interface de pré-visualização será responsiva.

### 5.5 Pré-visualização e confirmação

- Mostrar feed e Story antes da exportação.
- Usar a mesma fonte de dados e o mesmo modelo de composição da exportação.
- Exibir checklist final de produto, imagem, unidade, preço, preço anterior e validade.
- Impedir exportação quando campos obrigatórios estiverem ausentes ou o conteúdo ultrapassar o contrato do layout.
- Não truncar informações comerciais silenciosamente.

### 5.6 Exportação

- Gerar arquivos PNG em alta qualidade.
- Gerar também um PDF local de uma página vertical do Story, a partir da mesma renderização aprovada.
- Gerar feed e Story na mesma operação.
- Permitir download individual dos dois arquivos.
- Em dispositivos compatíveis, oferecer compartilhamento nativo.
- Manter download como alternativa quando o compartilhamento não estiver disponível.
- Usar nomes de arquivo legíveis contendo campanha, formato e data.

## 6. Fluxo principal

```text
Abrir aplicativo
  → iniciar campanha
  → escolher 1, 4 ou 8 produtos
  → selecionar produtos
  → preencher preços e validade
  → revisar informações
  → visualizar Story e feed
  → confirmar
  → baixar PNG ou PDF
```

## 7. Regras de conteúdo

- Preços devem ser armazenados em centavos inteiros e formatados em `pt-BR`.
- Preço à vista precisa estar claro e legível.
- Produto e apresentação devem ser identificados sem ambiguidade.
- Produtos fracionados devem informar a unidade relevante.
- Quando houver preço anterior, apresentar `de R$ X por R$ Y`; não comunicar apenas percentual.
- Toda campanha deve possuir data inicial e final.
- Condição de clube, CPF, forma de pagamento, limite por consumidor ou loja participante deve aparecer quando afetar a oferta.
- O operador precisa confirmar a associação entre foto, produto, unidade e preço.
- O MVP deve guardar dados suficientes para reproduzir a última arte e investigar um erro.

No primeiro case, evitar produtos com publicidade especialmente regulada até revisão específica, como tabaco, fórmulas infantis, medicamentos e bebidas alcoólicas.

Referências oficiais:

- Lei 10.962/2004: https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.962.htm
- Decreto 5.903/2006: https://planalto.gov.br/ccivil_03/_ato2004-2006/2006/decreto/d5903.htm
- Código de Defesa do Consumidor: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Orientações do Procon-SP para fornecedores: https://www.procon.sp.gov.br/wp-content/uploads/2024/05/Procon_Orientacoes_ao_Fornededor_2024.pdf

## 8. Requisitos não funcionais

### Qualidade visual

- Nenhum overflow, colisão, corte involuntário ou texto ilegível.
- Área segura validada com uma publicação real em conta privada.
- Preview e arquivo exportado sem diferenças materiais.
- Imagens normalizadas em dimensões, margens transparentes e proporção.
- Fontes carregadas antes da exportação; nenhum fallback silencioso.

### Dispositivos

- Interface mobile-first.
- Funcionamento em Android intermediário definido como aparelho de referência.
- Verificação adicional em iPhone/iOS e desktop.
- Uso por toque, sem depender de hover.

### Desempenho

- Exportação visada em até cinco segundos no aparelho de referência.
- Indicador de progresso durante a geração.
- Prevenção de exportações duplicadas por múltiplos toques.
- Carregar somente imagens necessárias para a campanha atual.

### Confiabilidade

- Zero associação incorreta entre produto, imagem, preço e unidade.
- Download continua funcionando se o compartilhamento falhar.
- Mensagens claras quando texto, imagem ou valor não couberem no layout.

## 9. Contrato de conteúdo e casos-limite

O motor deve ser testado com dados mais difíceis que os dez produtos do piloto:

- Nomes com 10, 30, 50 e 70 caracteres.
- Acentos, cedilha, hífen e caixa alta.
- `R$ 0,99`, `R$ 99,99`, `R$ 999,99` e `R$ 1.299,90`.
- Unidades curtas e longas.
- Preço anterior presente e ausente.
- Imagens altas, largas, pequenas e com margens transparentes diferentes.
- Falha ou atraso no carregamento de fonte e imagem.
- Rede móvel lenta.

Cada composição terá limites explícitos de linhas e tamanhos. Quando um item violar o limite, o sistema deve pedir correção, não degradar a arte silenciosamente.

## 10. Fora do MVP

- Multiempresa e múltiplas lojas.
- Cadastro, convite e permissões de vários usuários.
- Editor visual livre.
- Personalização pelo cliente.
- Processamento neural automático ou de upload manual sem chamada explícita.
- Busca automática de fotos.
- Importação por planilha.
- Leitura de código de barras.
- Integração com ERP ou estoque.
- Publicação direta em Instagram, Facebook ou WhatsApp.
- Agendamento de publicações.
- A4, cartazes ou encartes multipágina.
- Templates de açougue, hortifrúti e datas comemorativas.
- Vídeos, animações ou Reels.
- Métricas de alcance ou vendas.
- Cobrança e pagamentos dentro do aplicativo.
- Aplicativo nativo de celular.

## 11. Critérios de aceite técnico

O MVP técnico estará concluído quando:

- As seis combinações de formato e quantidade funcionarem.
- Os dez produtos puderem ser selecionados sem duplicação.
- Feed e Story forem gerados juntos.
- Todos os casos-limite definidos forem testados.
- Não houver diferença material entre preview e PNG.
- Download funcionar nos dispositivos de referência.
- Compartilhamento funcionar quando suportado e falhar de forma segura.
- Nenhuma exportação contiver erro de produto, preço, unidade ou validade.
- Uma pessoa não envolvida no desenvolvimento concluir o fluxo sem instruções especiais.

## 12. Protocolo do piloto

### Antes do aplicativo

Registrar pelo menos duas campanhas feitas pelo processo atual:

- Tempo ativo gasto.
- Pessoas envolvidas.
- Ferramentas utilizadas.
- Número de correções.
- Erros encontrados.
- Se a peça foi efetivamente publicada.

### Durante o piloto

- Duração inicial: 21 a 30 dias ou pelo menos três ciclos reais de ofertas.
- A primeira sessão pode ter treinamento.
- Depois dela, o operador deve trabalhar sem nossa intervenção.
- Registrar campanhas iniciadas, concluídas, exportadas e publicadas.
- Registrar tempo total, pedidos de suporte e correções externas.
- Parte do teste deve incluir produtos ou ofertas que não estavam perfeitamente preparados na demonstração.

### Critérios de aprovação

- Pelo menos seis campanhas reais geradas.
- Pelo menos três usos iniciados espontaneamente em semanas diferentes.
- Tempo mediano pelo menos 50% menor que o processo anterior.
- Meta operacional de até cinco minutos por campanha.
- Pelo menos 80% das artes exportadas efetivamente publicadas.
- Pelo menos 80% publicadas sem Canva ou correção externa.
- Zero erro crítico publicado de produto, preço, unidade ou validade.
- Queda dos pedidos de suporte após a primeira semana.
- Escolha explícita do aplicativo em vez do processo anterior.
- Primeiro pagamento ou compromisso comercial vinculante ao final.

### Critérios de interrupção ou reformulação

- O operador não reutiliza espontaneamente.
- O fluxo não economiza pelo menos 50% do tempo.
- Mais de 20% das peças exigem acabamento externo.
- O responsável volta ao processo anterior.
- O dono não aceita pagar preço comparável às alternativas.
- A entrada e preparação de produtos se revela o verdadeiro gargalo.
- O suporte recorrente ameaça ultrapassar 30–45 minutos por cliente/mês.

Um supermercado valida utilidade naquele case. Antes de concluir que há um negócio repetível para 20 clientes, repetir o experimento em três a cinco supermercados independentes, preferencialmente com operadores diferentes.

## 13. Modelo econômico a testar

### Oferta

- Taxa de implantação pela identidade, seis composições, configuração inicial, lote definido de produtos, treinamento e uma rodada de ajustes.
- Mensalidade pelo acesso, hospedagem, exportação e suporte limitado ao funcionamento.
- Novos templates, grandes lotes de recorte, redesenho e operação feita pela equipe cobrados separadamente.

### Faixas iniciais, ainda não validadas

- Implantação: testar aproximadamente **R$ 800 a R$ 1.500**.
- Mensalidade: testar aproximadamente **R$ 199 a R$ 299**.

Esses valores são hipóteses. Devem ser ajustados pelas horas reais de implantação, suporte, deslocamento, impostos e disposição local a pagar.

### Cenário-base para 20 clientes

- Implantação de R$ 1.000: R$ 20.000 de receita não recorrente.
- Mensalidade de R$ 249: R$ 4.980 de receita recorrente mensal.
- Suporte médio máximo de 45 minutos por cliente: 15 horas mensais.

Receita bruta não é lucro. A conta final deve incluir impostos, inadimplência, infraestrutura, manutenção, vendas e deslocamentos.

## 14. Estratégia de distribuição

1. Demonstração presencial usando a identidade do próprio supermercado.
2. Piloto curto com preço futuro informado desde o início.
3. Conversão do primeiro case para cliente pagante.
4. Pedido de indicação para outros dois proprietários.
5. Visitas a supermercados das cidades próximas.
6. Parcerias locais com designers, social medias, gráficas e fornecedores de automação.

Não priorizar anúncios pagos ou expansão nacional antes de provar retenção, preço e custo de suporte.

## 15. Concorrência observada

A categoria já contém soluções brasileiras que criam encartes, cartazes e posts:

- Encarte Fácil: https://portal.encartefacil.com/
- Ofertemais: https://ofertemais.com.br/
- OfertaPronta: https://ofertapronta.com/
- CriarOfertas: https://criarofertas.com.br/
- Oferta Fácil: https://www.ofertafacil.com.br/
- PriceFast: https://pricefast.com.br/app/pricefast/index.php
- WS Crie Ofertas: https://wscrieofertas.com.br/public/
- SuperWeb: https://superweb.app.br/
- Canva: https://www.canva.com/pt_br/precos/

O diferencial inicial não será quantidade de recursos. Será:

- implantação pronta;
- identidade exclusiva;
- fluxo extremamente curto;
- resultado fechado e sem necessidade de edição;
- proximidade comercial;
- treinamento e suporte local.

## 16. Premortem

### Em 90 dias

O protótipo gera uma demonstração bonita, mas o funcionário não o incorpora à rotina, precisa pedir ajuda e um erro de preço destrói a confiança.

### Em 12 meses

Existem clientes, mas não renda adicional: cada mudança vira atendimento manual, os templates divergem e 20 supermercados passam a exigir trabalho semelhante ao de uma agência.

### Proteções

- Tema, catálogo, campanha e layouts separados internamente.
- Escopo de implantação fechado.
- Uma rodada de ajustes incluída.
- Suporte recorrente medido e limitado.
- Novos serviços cobrados à parte.
- Operador precisa produzir campanhas sozinho.

## 17. Riscos residuais

- O supermercado pode não perceber consistência visual como dor prioritária.
- O preço local pode não sustentar implantação e suporte.
- A pessoa que aprova pode não ser quem opera.
- Produtos novos podem revelar que preparação de imagens é o verdadeiro gargalo.
- Concorrentes mais completos podem ser suficientemente simples quando apresentados ao cliente.
- Erros de oferta podem gerar prejuízo e risco jurídico.
- O primeiro case pode aceitar por relacionamento pessoal e não representar outros mercados.
- O ganho de vendas não pode ser atribuído ao aplicativo sem experimento separado.

## 18. O que não foi possível verificar

- Processo atual do supermercado-piloto.
- Frequência e tamanho reais das campanhas.
- Quem será o operador cotidiano.
- Dispositivo utilizado pelo operador.
- Tempo e custo atuais para produzir as peças.
- Estado e município do piloto e eventuais regras locais.
- Categorias dos dez produtos.
- Qualidade e licenças dos arquivos da marca, fotos e fontes.
- Disposição concreta a pagar implantação e mensalidade.
- Custo de aquisição, inadimplência e retenção.
- Se o mercado realmente desconhece as soluções concorrentes ou apenas decidiu não adotá-las.

## 19. Próximo portão

Antes de implementar a aplicação completa:

1. Receber os materiais do supermercado escolhido.
2. Definir os dez produtos e preparar suas imagens.
3. Desenhar a identidade do template genérico.
4. Criar primeiro a composição de oito produtos e atacá-la com casos-limite.
5. Confirmar o motor de exportação no celular.
6. Somente então expandir para as outras cinco composições e construir o fluxo completo.
