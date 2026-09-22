# Catálogo Promocional — Design do MVP Local

**Data:** 4 de setembro de 2026  
**Estado:** MVP local aprovado e testado; fase pós-MVP de persistência Supabase aprovada em 6 de setembro de 2026  
**Escopo:** protótipo técnico local para um supermercado

## 1. Visão do produto

O produto é uma aplicação web local que transforma uma seleção de produtos e preços em duas peças promocionais prontas: uma para feed e outra para Story.

O supermercado não recebe um editor de design. A identidade, os elementos gráficos e as composições são preparados previamente. O operador somente informa os dados comerciais, confere o resultado e exporta os arquivos.

### Proposta de valor

> Suas ofertas, com a identidade do seu supermercado, prontas para publicar em poucos minutos — sem montar cada arte do zero.

### Objetivo desta versão

Validar que um motor SVG consegue produzir peças visualmente fortes, corretas e consistentes para 1, 4 e 8 produtos em dois formatos.

Esta versão não valida ainda aquisição de clientes, retenção, preço ou aumento de vendas.

## 2. Decisões aprovadas

- Aplicação executada exclusivamente em `localhost`.
- Front-end em React e TypeScript.
- Ferramenta de desenvolvimento e build: Vite.
- Motor de composição baseado em SVG parametrizado.
- Um supermercado e uma identidade visual.
- Um template promocional genérico.
- Dez produtos locais com imagens PNG transparentes.
- Quantidades fixas de 1, 4 e 8 produtos.
- Formatos de feed e Story.
- Exportação final em PNG e PDF de uma página do Story.
- Nenhum backend, autenticação, nuvem ou banco de dados próprios. Rotas locais de desenvolvimento podem intermediar os conectores opcionais da Kie e do Cosmos, mantendo as chaves fora do navegador.

## 3. Princípios do design

### Resultado fechado

O operador não escolhe fontes, muda cores nem reposiciona livremente os elementos. Isso protege a qualidade e diferencia o produto de editores genéricos.

**Exceção aprovada em 6 de setembro de 2026 — ajuste direto e restrito da embalagem:** depois de selecionar uma foto aprovada, o operador pode arrastar somente a imagem daquele produto dentro da área de posicionamento definida pelo layout. O gesto é direto por ponteiro ou toque, sem setas, campos de coordenadas ou editor de camadas. A regra não autoriza redimensionar, rotacionar, recortar, trocar a ordem dos elementos, mover texto/preço/unidade, nem arrastar o produto para fora dos limites do seu layout.

### Identidade exclusiva

Logo, paleta, tipografia, grafismos e hierarquia visual são definidos como um tema do supermercado. O tema deve poder ser substituído futuramente sem alterar o fluxo do aplicativo.

### Fidelidade

O preview e a exportação usam o mesmo SVG. Não haverá uma implementação visual para a tela e outra para o arquivo.

### Exatidão antes de estética

Preço, unidade, validade e associação entre nome e imagem nunca podem ser truncados, trocados ou ocultados para preservar o layout.

### Escopo mínimo

O MVP comprova o mecanismo. Recursos comerciais e de plataforma serão discutidos somente depois dessa prova.

## 4. Arquitetura

```text
Catálogo local
  + dados da campanha
  + tema do supermercado
  + definição do layout 1/4/8
        ↓
Modelo normalizado da peça
        ↓
Componente SVG compartilhado
        ├── preview reduzido
        └── PNG e PDF de Story
```

### Camadas

1. **Catálogo:** mantém os dez produtos e caminhos dos ativos locais.
2. **Campanha:** mantém título, validade, observação, seleção e preços.
3. **Tema:** mantém logo, cores, fontes e grafismos.
4. **Layout:** define posições e limites para 1, 4 ou 8 cards em cada formato.
5. **Compositor SVG:** transforma tema, campanha e layout em uma peça.
6. **Exportador:** rasteriza o SVG aprovado para PNG e PDF de uma página.
7. **Interface:** conduz seleção, edição, revisão, preview e download.

Essas responsabilidades devem permanecer separadas. Nenhum layout poderá conter produtos, preços ou identidade escritos diretamente em seu código.

## 5. Formatos e composições

| Canal | Dimensão | 1 produto | 4 produtos | 8 produtos |
| --- | ---: | ---: | ---: | ---: |
| Story | 1080 × 1920 | Sim | Sim | Sim |
| Feed vertical | 1080 × 1350 | Sim | Sim | Sim |

As seis composições compartilham componentes visuais, mas possuem coordenadas e regras próprias. O feed não é um corte ou redimensionamento do Story.

O preview adapta seu tamanho ao celular ou computador, preservando a proporção do SVG original.

## 6. Dados

### Produto

```ts
type Product = {
  id: string;
  name: string;
  defaultUnit: string;
  imagePath: string;
};
```

### Item de campanha

```ts
type CampaignItem = {
  productId: string;
  unit: string;
  currentPriceCents: number;
  previousPriceCents?: number;
};
```

### Campanha

```ts
type Campaign = {
  title: string;
  startsOn: string;
  endsOn: string;
  note?: string;
  itemCount: 1 | 4 | 8;
  items: CampaignItem[];
};
```

### Tema

```ts
type StoreTheme = {
  storeName: string;
  logoPath: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    display: string;
    body: string;
    price: string;
  };
};
```

Valores monetários serão armazenados em centavos inteiros. A apresentação em tela e na arte usará `Intl.NumberFormat` com localidade `pt-BR` e moeda `BRL`.

## 7. Jornada do operador

1. Abrir a aplicação.
2. Escolher 1, 4 ou 8 produtos.
3. Selecionar exatamente essa quantidade entre os dez produtos.
4. Informar preço promocional de cada item.
5. Informar preço anterior quando existir.
6. Confirmar ou ajustar a unidade.
7. Informar título e período de validade.
8. Avançar para a revisão.
9. Ver feed e Story lado a lado no desktop ou alternados no celular.
10. Voltar e corrigir qualquer dado sem perder a seleção.
11. Confirmar a conferência final.
12. Gerar e baixar o PNG ou PDF do Story.

Não haverá dashboard. A tela inicial começa diretamente na criação da campanha.

## 8. Validações e erros

### Bloqueios antes do preview

- A quantidade selecionada deve ser exatamente 1, 4 ou 8.
- O mesmo produto não pode aparecer duas vezes.
- Todos os itens precisam de preço promocional maior que zero.
- O preço anterior, quando usado como comparação, precisa ser maior que o promocional.
- Unidade e nome precisam respeitar o contrato de conteúdo do layout.
- Data final não pode preceder a inicial.

### Bloqueios antes da exportação

- Logo, fontes e imagens precisam estar carregados.
- Nenhum texto pode exceder seus limites.
- Nenhuma imagem pode estar ausente.
- O operador precisa marcar a confirmação de revisão dos dados.

### Comportamento em falhas

- Erros aparecem junto ao campo correspondente.
- Falhas de ativo indicam exatamente qual logo, fonte ou produto não carregou.
- O botão de gerar permanece desabilitado enquanto houver erro.
- A exportação exibe estado de progresso e impede cliques duplicados.
- Se o compartilhamento nativo não estiver disponível, o download permanece disponível.
- Nenhuma falha pode produzir ou baixar uma arte parcialmente renderizada.

## 9. Exportação

- O SVG visível será serializado e rasterizado em canvas nas dimensões finais.
- O sistema aguardará o carregamento completo das fontes antes de medir ou exportar texto.
- Todos os ativos serão locais para evitar falhas de CORS.
- PNG e PDF de uma página do Story serão gerados no navegador, sem serviço externo.
- Nomes dos arquivos seguirão `campanha-AAAA-MM-DD-story.png` e `campanha-AAAA-MM-DD-story.pdf`.
- PNG e PDF estarão disponíveis lado a lado após a mesma confirmação de revisão. O PDF usa a renderização do SVG em uma página vertical 9:16, sem criar um segundo layout nem um fluxo de impressão.
- Compartilhamento pela Web Share API será um aprimoramento progressivo, nunca requisito para o download.

### Recorte neural opcional

- A integração da Kie usa o modelo `recraft/remove-background` somente mediante chamada explícita futura; não é acionada automaticamente ao selecionar um produto.
- A chave fica exclusivamente em `KIE_API_KEY` no `.env.local` do servidor Vite local. Ela nunca recebe o prefixo `VITE_`, não entra no bundle e não é devolvida à interface.
- A rota local aceita apenas URLs HTTPS públicas das imagens de embalagem aprovadas do Open Food Facts. Upload manual não é enviado à Kie até que exista uma decisão separada para hospedagem temporária.
- A rota cria a tarefa e consulta seu estado; callbacks não se aplicam ao `localhost` e ficam fora desta configuração inicial.

### Consulta opcional ao Cosmos

- Em uma busca exata por GTIN/EAN, a ação explícita do operador consulta Open Food Facts e Cosmos em paralelo. Os retornos são unidos exclusivamente quando confirmam o mesmo código; busca textual continua usando apenas a fonte gratuita nesta etapa.
- `COSMOS_TOKEN` e `COSMOS_USER_AGENT` ficam exclusivamente no `.env.local` do servidor Vite local, sem prefixo `VITE_`, sem bundle e sem retorno à interface.
- O servidor limita a 25 chamadas externas por dia no fuso de São Paulo. A reserva persistente no catálogo é preferida; se ela falhar, o servidor local usa seu contador atômico em disco como recuperação para não bloquear o conector já validado. Em ambos os casos, a 26ª é bloqueada antes de sair do computador; ler o status não consome a cota.
- As fotos candidatas de cada fonte aparecem separadamente e identificadas pela origem. Apenas fotos aprovadas pelo validador local podem ser escolhidas; em seguida, fundo branco pode receber o recorte determinístico já existente.
- A qualificação informa se cada foto foi aprovada, não carregou ou foi recusada e por quê. Além de fundo, enquadramento, resolução, objetos múltiplos e nitidez, ela bloqueia o padrão determinístico de ilustração genérica conhecido: um halo circular grande, quase uniforme e pouco texturizado envolvendo um objeto menor. Não usa IA, nome, marca ou inferência de SKU para essa decisão.
- Se Open Food Facts retornar metadados enquanto o Cosmos falhar, divergir no GTIN ou retornar dados inválidos, o produto disponível permanece utilizável e a interface mostra o aviso da fonte; a falha não pode desaparecer silenciosamente.
- Se Cosmos não retornar produto, foto, exceder a cota ou falhar, o resultado gratuito permanece disponível. Se não houver foto aprovada, o upload manual continua como alternativa. Nome, apresentação, preço, foto e associação final continuam sujeitos à revisão explícita do operador.
- Antes da prévia, o processamento mede a silhueta visível do arquivo pelo canal alfa, ignorando margem transparente e sombra muito fraca. O layout escala essa silhueta dentro da área segura, ancora a sua base numa linha fixa do topo do pedestal e aplica uma sombra radial de contato proporcional somente quando o arquivo não trouxer uma sombra própria. O arquivo-fonte não é cortado nem deformado.

### Ajuste direto e restrito da embalagem

- A posição automática continua sendo o ponto de partida: silhueta medida pelo alfa, escala segura e base no pedestal.
- O arraste converte o ponteiro para as coordenadas nativas do SVG e limita o deslocamento pela **silhueta visível**, não pela margem transparente do arquivo.
- Cada layout informa, além da sua área segura, o teto, a borda direita, o limite inferior do pedestal e a pequena sobreposição autorizada sobre a placa à esquerda. A base visível nunca passa abaixo do pedestal; a silhueta nunca ultrapassa a borda direita nem o teto do palco.
- A pequena sobreposição autorizada à esquerda é renderizada atrás da placa e de todos os dados comerciais. A árvore SVG mantém a ordem: fundo/pedestal, sombra, produto, placa e texto/preços. Portanto o produto nunca encobre nome, apresentação ou preço.
- Um movimento mínimo separa clique de arraste; durante o gesto, a prévia é atualizada de forma fluida. Ao soltar, somente a posição já limitada é registrada no estado da campanha. Cancelar o ponteiro restaura a posição anterior.
- A mesma posição faz parte do modelo normalizado consumido pela prévia e pela exportação. PNG e PDF não podem recalcular uma posição diferente.
- A posição é específica do item de campanha e do layout. Uma foto nova começa na posição automática; o futuro histórico persistido da campanha deve guardar o deslocamento aplicado na exportação.

## 10. Contrato visual e casos-limite

Cada layout definirá explicitamente:

- área segura;
- limites de arraste da silhueta e sobreposição máxima autorizada sobre a placa;
- número máximo de linhas do nome;
- comprimento máximo da unidade;
- largura mínima do selo de preço;
- escala mínima e máxima da imagem;
- comportamento com e sem preço anterior;
- margens mínimas entre elementos.

Casos obrigatórios de teste:

- nomes com 10, 30, 50 e 70 caracteres;
- acentos, cedilha, hífen e caixa alta;
- preços `R$ 0,99`, `R$ 99,99`, `R$ 999,99` e `R$ 1.299,90`;
- unidades `kg`, `100 g`, `500 ml`, `2 L`, `unidade` e `pacote 5 kg`;
- preço anterior presente e ausente;
- imagens altas, largas, pequenas e com margens transparentes diferentes;
- logo e fontes indisponíveis;
- exportação em viewport móvel.

Quando o conteúdo não couber, a interface deve pedir correção. Não reduzir fonte indefinidamente e não truncar silenciosamente.

## 11. Testes

### Unitários

- Formatação de preço.
- Validação das datas.
- Validação da quantidade de produtos.
- Detecção de produto repetido.
- Validação do preço anterior.
- Normalização do modelo da campanha.
- Seleção da configuração correta para cada layout.

### Componentes

- Seleção e remoção de produtos.
- Edição de preço e unidade.
- Navegação entre formulário, revisão e preview.
- Exibição dos seis layouts.
- Estados de carregamento e erro.

### Regressão visual

- Imagens de referência para as seis composições.
- Comparação das saídas com tolerância pequena e explícita.
- Casos com e sem preço anterior.
- Casos de maior nome, unidade e preço aceitos.

### Ponta a ponta

- Criar campanha de 1 produto e baixar os dois formatos.
- Criar campanha de 4 produtos e corrigir um preço antes da exportação.
- Criar campanha de 8 produtos e verificar todas as associações.
- Confirmar que dados inválidos bloqueiam a geração.
- Confirmar funcionamento em viewport móvel e desktop.

## 12. Critérios de aceite

- Todas as seis composições são renderizadas.
- Preview e PNG usam a mesma árvore SVG e não apresentam diferença material.
- Nenhum caso aceito produz overflow, colisão ou corte involuntário.
- Produto, foto, unidade e preço permanecem corretamente associados.
- Exportação gera PNG válido nas dimensões definidas.
- Uma campanha pode ser corrigida sem reiniciar o fluxo.
- Download funciona mesmo sem suporte a compartilhamento.
- Uma pessoa não envolvida no desenvolvimento consegue concluir o fluxo local.

## 13. Fora do escopo

- Deploy público ou hospedagem.
- Login, contas, funções e permissões.
- Backend, APIs próprias e banco de dados.
- Histórico persistente de campanhas.
- Multiempresa e multilojas.
- Editor visual livre.
- Alteração de marca pelo operador.
- Cadastro definitivo de produtos.
- Upload de imagens pelo operador.
- Busca automática de imagens.
- Remoção neural automática ou de uploads manuais sem chamada explícita.
- Importação de planilha ou lista.
- Leitura por câmera de código de barras e integração automática com estoque/ERP.
- Integração com ERP ou estoque.
- Impressão, cartazes ou encartes multipágina.
- Publicação ou agendamento em redes sociais.
- Vídeos e animações.
- Métricas de marketing ou vendas.
- Cobrança e assinaturas.
- Templates temáticos e datas comemorativas.

## 14. Ativos necessários para a implementação visual

Antes da fase visual, o usuário fornecerá ou aprovará:

- logo do supermercado;
- referências públicas ou arquivos da identidade;
- dez produtos do case;
- imagens autorizadas dos produtos;
- textos institucionais e contatos que devem aparecer;
- condições comerciais padrão do rodapé.

Enquanto esses ativos não forem fornecidos, a engenharia do motor pode usar uma marca e produtos fictícios claramente identificados como material de teste.

## 15. Estratégia de construção

1. Criar o modelo de dados e as validações.
2. Implementar primeiro uma composição SVG de oito produtos para Story.
3. Testar os casos-limite e a exportação em PNG.
4. Extrair os componentes visuais compartilhados.
5. Criar a versão de feed para oito produtos.
6. Expandir para quatro e um produto.
7. Construir a jornada completa de seleção, revisão e exportação.
8. Executar regressão visual e testes de ponta a ponta.

Esse caminho ataca primeiro a composição mais congestionada. Se oito produtos funcionarem com qualidade, os layouts menores reutilizam o motor já provado.

## 16. Continuidade depois do MVP

Somente após a aprovação do mecanismo local serão discutidos:

1. uso real pelo operador do supermercado;
2. persistência e histórico;
3. backend e autenticação;
4. cadastro e preparação de novos produtos;
5. templates temáticos;
6. operação para vários supermercados;
7. modelo de cobrança e expansão regional.

Esses itens não fazem parte do plano de implementação do MVP local.

## 17. Fase pós-MVP aprovada — persistência no Supabase

Em 6 de setembro de 2026, depois do teste do Story local de um produto, o usuário aprovou o planejamento e o início de uma fase posterior ao MVP técnico. A interface continua em `http://127.0.0.1:4173/`, single-tenant e sem autenticação, mas catálogo, ativos aprovados, templates, campanhas e histórico de exportação passam a ter persistência no projeto dedicado `supabase_catalogo`.

Esta fase segue o plano [`docs/superpowers/plans/2026-09-06-persistencia-supabase-catalogo-campanhas.md`](../plans/2026-09-06-persistencia-supabase-catalogo-campanhas.md) e altera de forma explícita, somente para a evolução pós-MVP, as restrições anteriores de banco/backend remoto. Não autoriza hospedagem pública da interface, multitenancy, ERP, editor livre, publicação social ou autenticação.

Política aprovada para entrada de produtos:

- busca por nome consulta somente produtos já cadastrados, validados e ativos no catálogo próprio;
- texto nunca consulta Open Food Facts, Cosmos ou outra fonte externa;
- produto novo entra somente por EAN/GTIN exato ou cadastro manual explícito;
- consulta exata verifica primeiro o catálogo próprio e somente em caso de ausência consulta os endpoints exatos de Open Food Facts e Cosmos;
- o produto só fica pesquisável por nome depois da confirmação de metadados, apresentação e imagem e da ativação de sua linha;
- Feed permanece sem template ativo até o usuário entregar e aprovar sua base visual.

Toda escrita do aplicativo passa por rotas do servidor Vite local, com credenciais fora do bundle. Alterações de schema são versionadas em migrações e exigem validação antes da aplicação remota.

### Ajuste de escopo aprovado em 7 de setembro de 2026

Depois do primeiro teste real bem-sucedido de persistência, o usuário restringiu a finalidade atual do Supabase ao catálogo reutilizável de produtos e fotos aprovadas. Preço, preço anterior, posição, tema, formato, confirmação e demais dados circunstanciais da oferta permanecem na memória do navegador e não serão ligados a `campaigns`, `campaign_items` ou `campaign_exports` neste corte. As tabelas já existentes permanecem inativas e não serão removidas.

EAN/GTIN continua sendo a identidade única. `canonical_name` preserva o nome de referência, enquanto um `display_name` persistente guardará o último nome aprovado para o cartaz. Reutilizar um produto ativo pode atualizar somente esse nome exibido; não cria nova linha nem regrava a foto quando ela não mudou.

A continuidade aprovada está no plano [`docs/superpowers/plans/2026-09-07-catalogo-reutilizavel-busca-e-nova-oferta.md`](../plans/2026-09-07-catalogo-reutilizavel-busca-e-nova-oferta.md): busca incremental local a partir de dois caracteres com miniatura, borda verde para cadastrados, exclusividade do cadastro manual e encerramento explícito por **Criar nova oferta** depois do download.
