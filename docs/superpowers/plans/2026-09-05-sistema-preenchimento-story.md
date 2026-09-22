# Plano de implementação — preenchimento do template Story

**Data:** 5 de setembro de 2026  
**Estado:** aprovado para o teste mínimo solicitado pelo usuário em 5 de setembro de 2026  
**Primeiro incremento:** Story de um produto em `1080 × 1920`  
**Referência visual:** `assets/reference-templates/story.psd`

**Atualização de escopo aprovada em 5 de setembro de 2026:** além do fluxo de Story, o ambiente local pode expor conectores manuais e opt-in para Kie e Cosmos. Credenciais permanecem no `.env.local`. Uma busca exata por GTIN/EAN consulta Open Food Facts e Cosmos em paralelo, une apenas retornos com o mesmo código e apresenta fotos de cada origem para aprovação e escolha. Busca textual não consulta Cosmos nesta etapa. Para Cosmos, a configuração inclui limite persistente de 25 chamadas externas por dia no fuso de São Paulo; se esse limite, uma foto ou a fonte falhar, a busca gratuita e o upload manual permanecem disponíveis. A modelagem do microcatálogo de até três produtos e a primeira consulta real ficam para uma etapa posterior, sob ação explícita do usuário.

**Regra de posicionamento aprovada em 5 de setembro de 2026:** o Story mede a caixa visível de cada PNG pelo canal alfa, ignorando margem transparente e sombra fraca. A base dessa silhueta é alinhada a uma linha fixa do pedestal; a escala usa limites máximos de largura e altura visíveis. O PNG completo é mantido e nunca é deformado ou recortado para obter esse encaixe.

**Ajuste visual aprovado em 5 de setembro de 2026:** o ponto comum das embalagens fica levemente à esquerda do centro original do pódio. Quando a medição não encontrar sombra própria sob a embalagem, o SVG inclui uma sombra radial de contato proporcional; com sombra própria detectada, o efeito adicional não é renderizado.

## 1. Resultado deste incremento

Construir em `localhost` o menor fluxo completo que permita:

1. escolher um produto previamente cadastrado;
2. informar preço promocional, preço anterior opcional e unidade;
3. informar título e período de validade da campanha;
4. visualizar o Story preenchido;
5. bloquear conteúdo inválido ou que não caiba;
6. exportar exatamente o mesmo SVG do preview como PNG de `1080 × 1920`.

O operador não poderá mover, redimensionar ou editar livremente elementos do template.

## 2. Decisões preservadas

- React, TypeScript e Vite.
- Execução exclusiva em `localhost`.
- Nenhum backend, autenticação, nuvem ou banco remoto.
- SVG parametrizado como fonte única do preview e da exportação.
- Identidade, catálogo, campanha e regras de layout em módulos separados.
- Valores monetários armazenados em centavos inteiros.
- Nenhum truncamento silencioso de nome, unidade, preço ou validade.
- O PSD é referência de design; o navegador não editará nem preencherá o PSD.
- As opções de 4 e 8 produtos e o Feed continuam no MVP, mas serão implementadas após a validação do Story de um produto.

## 3. Mapeamento inicial do PSD

O arquivo `story.psd` tem `1080 × 1920` e contém os grupos relevantes:

| Grupo atual | Papel no sistema | Tratamento |
| --- | --- | --- |
| `Fixo` | fundo, logo, título, grafismos, carrinho e pódio | exportado como ativo fixo do template |
| `PEDESTAL FOR OFFER POSTER | (DOUBLE CLICK TO EDIT)` | placa que recebe os dados comerciais | estrutura visual fixa com textos renderizados pelo SVG |
| `Produto` | produto demonstrativo | substituído por uma imagem PNG transparente do catálogo |

Antes do código visual, os grupos serão exportados e conferidos separadamente contra o PNG composto de referência. Caso algum elemento fixo precise ficar à frente do produto, o template terá camadas fixas de fundo e sobreposição.

### Portão de direção visual e tokens

Antes de criar ou consolidar os tokens de design, será apresentada ao usuário uma proposta visual específica para este supermercado e para o PSD, incluindo:

- cores extraídas e organizadas a partir do template;
- tipografia de display, corpo e preço;
- escala de espaçamento e dimensões dos controles;
- bordas, raios, sombras e estados de foco;
- hierarquia de títulos, campos, erros e ações;
- comportamento visual do formulário ao lado do Story;
- duas ou três amostras aplicadas em componentes reais, e não apenas uma tabela abstrata.

Os tokens não serão derivados de um preset genérico nem congelados sem a opinião do usuário. A implementação visual só continuará depois da aprovação ou dos ajustes dessa proposta.

**Direção inicial fornecida pelo usuário:** a interface deve ser neutra, com predominância de branco e preto. A proposta deve explorar uma linguagem editorial e precisa, com bastante respiro, contraste alto, tipografia forte, linhas e divisores discretos e uma escala de cinzas funcional. O amarelo e o vermelho do template promocional devem permanecer dentro da arte, sem dominar o painel de preenchimento. Estados de erro e sucesso poderão usar cor de forma contida quando isso melhorar a compreensão e a acessibilidade.

O componente anexado pelo usuário será considerado somente como referência de ritmo, grade e composição. Ele não determina automaticamente o uso de shadcn, Tailwind, dependências ou tokens prontos; essas escolhas continuarão subordinadas à arquitetura do projeto e à aprovação visual.

## 4. Estrutura planejada

```text
src/
  app/
    App.tsx
  catalog/
    products.ts
  campaign/
    campaignTypes.ts
    campaignValidation.ts
    campaignForm.tsx
  themes/
    storeTheme.ts
  templates/
    story/
      single/
        storySingleLayout.ts
        StorySingleSvg.tsx
        storySingleValidation.ts
  export/
    svgToPng.ts
  shared/
    money.ts
    assetLoading.ts
public/
  templates/story/single/
  products/
tests/
  fixtures/
  visual/
```

O nome definitivo dos arquivos poderá mudar durante o scaffold, mas as responsabilidades não serão misturadas.

## 5. Sequência de implementação

### Etapa 1 — preparar e validar os ativos do Story

- Exportar a composição final do PSD como referência visual.
- Exportar o grupo fixo sem produto e sem textos dinâmicos.
- Exportar, quando necessário, uma camada de sobreposição frontal.
- Isolar a estrutura gráfica da placa de preço.
- Registrar posições, áreas seguras e dimensões do slot do produto e dos textos.
- Confirmar as fontes e suas licenças ou definir substitutas aprovadas.
- Comparar visualmente os ativos extraídos com o PSD composto.

**Saída verificável:** pacote de ativos fixos e contrato de coordenadas do Story.

### Etapa 2 — criar o esqueleto testável da aplicação

- Inicializar Vite com React e TypeScript.
- Configurar Vitest, Testing Library e verificação de tipos.
- Adicionar scripts de desenvolvimento, teste e build.
- Criar a tela inicial diretamente no fluxo de campanha, sem dashboard.
- Preparar somente a estrutura técnica dos tokens; apresentar a proposta visual ao usuário antes de definir seus valores finais.

**Teste primeiro:** a aplicação monta o fluxo inicial e rejeita uma configuração de layout desconhecida.

### Etapa 3 — modelar dados e validações

- Implementar `Product`, `CampaignItem`, `Campaign` e `StoreTheme` conforme a especificação.
- Implementar parsing de moeda para centavos e formatação com `Intl.NumberFormat` em `pt-BR`/`BRL`.
- Validar produto obrigatório, preço maior que zero, preço anterior maior que o promocional, unidade e intervalo de datas.
- Manter erros associados aos respectivos campos.

**Testes obrigatórios:**

- `R$ 0,99`, `R$ 99,99`, `R$ 999,99` e `R$ 1.299,90`;
- preço anterior presente, ausente e inválido;
- datas válidas e data final anterior à inicial;
- unidades `kg`, `100 g`, `500 ml`, `2 L`, `unidade` e `pacote 5 kg`;
- caracteres acentuados, cedilha, hífen e caixa alta.

### Etapa 4 — montar o SVG parametrizado do Story

- Criar um SVG com `viewBox="0 0 1080 1920"`.
- Compor camada fixa de fundo, imagem do produto, placa de preço, textos e eventual sobreposição frontal.
- Encaixar o produto com regra controlada de `contain`, sem deformação.
- Renderizar nome, unidade, preço atual, preço anterior opcional e validade.
- Definir limites explícitos de linhas, larguras e tamanhos mínimos.
- Retornar erro de contrato quando o conteúdo não couber.

**Testes obrigatórios:**

- nomes com 10, 30, 50 e 70 caracteres;
- imagens altas, largas, pequenas e com margens transparentes diferentes;
- maior preço aceito;
- carregamento ausente de produto, logo ou fonte;
- associação correta entre produto, imagem, unidade e preço.

### Etapa 5 — construir o formulário de preenchimento

- Seleção de um produto do catálogo local.
- Campos de preço atual, preço anterior opcional e unidade.
- Campos de título, início e fim da validade.
- Atualização imediata do modelo normalizado e do preview.
- Mensagens de erro junto aos campos.
- Preservação dos dados ao voltar da revisão para o formulário.

**Teste primeiro:** preencher, corrigir e revisar sem perder seleção ou valores.

### Etapa 6 — revisão e exportação PNG

- Exigir confirmação explícita da associação produto–imagem–unidade–preço–validade.
- Aguardar fontes e imagens antes de habilitar a exportação.
- Serializar o mesmo SVG exibido no preview.
- Rasterizar em canvas de `1080 × 1920`.
- Impedir cliques duplicados enquanto a exportação estiver em andamento.
- Baixar como `campanha-AAAA-MM-DD-story.png`.
- Nunca baixar uma imagem parcial após falha.

**Testes obrigatórios:** dimensões finais, nome do arquivo, bloqueio por ativo ausente e equivalência material entre preview e PNG.

### Etapa 7 — validação visual e responsiva

- Registrar imagem de referência aprovada do Story.
- Executar comparação visual com tolerância pequena e explícita.
- Testar viewport de celular e desktop.
- Garantir que o preview preserve a proporção sem alterar o SVG final.
- Fazer uma pessoa não envolvida no desenvolvimento concluir o fluxo.

## 6. Continuidade para 4 e 8 produtos

Depois de aprovar o Story de um produto:

1. extrair componentes visuais compartilhados;
2. definir contratos independentes para Story de 4 e 8 produtos;
3. manter o mesmo modelo de campanha e a mesma validação de associação;
4. adicionar testes de produto repetido e quantidade exata;
5. gerar referências visuais próprias para cada composição.

## 7. Continuidade para Feed

O Feed reutilizará catálogo, campanha, validações, componentes de preço e exportador, mas terá coordenadas e contrato visual próprios.

Existe uma decisão pendente antes dessa etapa: o PSD disponível tem `2200 × 2200`, enquanto a especificação define Feed vertical em `1080 × 1350`. Não haverá corte, esticamento ou mudança de proporção sem aprovação explícita. As alternativas são:

- adaptar o design quadrado para Feed vertical; ou
- revisar a especificação e adotar Feed quadrado.

## 8. Itens necessários antes da fidelidade final

- imagens separadas e autorizadas dos produtos;
- arquivo ou exportação do produto demonstrativo, se ele continuar no piloto;
- fontes usadas nos textos dinâmicos ou substitutas aprovadas;
- conteúdo definitivo da placa: nome, preço, unidade, preço anterior e validade;
- confirmação das condições comerciais do rodapé.

Enquanto esses itens não estiverem disponíveis, testes técnicos poderão usar conteúdo fictício claramente identificado.

## 9. Portão para implementação

Nenhum código da aplicação será criado até a aprovação deste plano. A aprovação libera somente o incremento Story de um produto descrito aqui; mudanças de escopo serão registradas antes de serem implementadas.
