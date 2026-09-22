# Instruções persistentes do projeto

## Fonte de verdade

Antes de alterar o projeto, leia integralmente:

1. `docs/superpowers/specs/2026-09-04-catalogo-promocional-mvp-design.md`
2. `atlas-output/go/catalogo-promocional-supermercados/2026-09-04-veredito-e-escopo-mvp-v1.md`

A especificação do Superpowers define o produto e a arquitetura. O dossiê do GO explica as premissas, riscos e critérios de validação.

## Estado e portões

- Nenhum código deve ser criado antes da aprovação humana da especificação.
- Após a aprovação, produzir primeiro o plano em `docs/superpowers/plans/` usando as instruções de `superpowers:writing-plans`.
- O plano deve ser aprovado antes da implementação.
- Não ampliar o escopo silenciosamente.

## Restrições do MVP

- Executar em `localhost`.
- Não adicionar autenticação, nuvem, backend, banco remoto ou multitenancy.
- Não adicionar IA, editor livre, ERP, planilha, código de barras, postagem automática, PDF ou remoção de fundo.
- Usar SVG parametrizado como fonte única para preview e exportação.
- Manter identidade, dados dos produtos e regras de layout separados.
- Preservar as opções de 1, 4 e 8 produtos para feed e Story.
- Priorizar exatidão de preço, unidade, validade e associação produto–imagem.

## Forma de trabalho

- Fazer mudanças pequenas e testáveis.
- Escrever testes antes ou junto da menor implementação possível.
- Testar casos-limite de texto, preço, unidade, imagem e fonte.
- Não considerar uma arte visualmente bonita como validação de produto.

## Operação da interface local

Quando o usuário pedir para "subir o sistema", "subir o visual", "rodar o app" ou "abrir a prévia", isso significa iniciar ou reutilizar a interface Vite deste projeto em `http://127.0.0.1:4173/`.

1. Verificar primeiro se a URL já está respondendo; se estiver, reutilizar o servidor existente e não abrir uma cópia.
2. Se estiver desligado, executar `npm run dev` na raiz do projeto e manter o processo disponível.
3. Não pedir ao usuário para repetir essa convenção. O roteiro detalhado está em `docs/GUIA_OPERACAO_LOCAL.md`.
4. Durante uma demonstração com produto já selecionado, não reiniciar o Vite, recarregar a página, compilar nem alterar código que possa desmontar o React sem avisar antes: o rascunho atual ainda vive na memória do navegador.
5. Não executar nova busca Cosmos durante esse teste sem pedido explícito, pois uma consulta exata pode consumir a cota diária.

## Lições registradas

- **Camadas são camadas; falta de ativo é falta de ativo.** Quando o pedido for ordem de empilhamento (produto atrás da placa, por exemplo) e o elemento da frente estiver embutido em outro arquivo, diga isso e peça o ativo separado. Não simule a camada recortando o fundo: todo pixel de fundo que cair no recorte é pintado sobre o conteúdo de baixo e aparece como corte. Refinar o recorte não corrige a natureza do erro.
- **Antes de "melhorar" um caminho que funciona, confirme o que ele já resolve.** A rota de status da Kie devolve um relay na mesma origem; trocá-la por uma rota de importação "para evitar CORS" quebrou o fluxo, porque o CORS já estava resolvido.
- **Uma decisão de produto invalida a correção do sintoma.** Se o usuário descartar um mecanismo, pare de consertá-lo, mesmo com a correção pronta e testada.
- **Cota externa é orçamento, não detalhe.** Estado vivo no navegador vale chamadas pagas. Antes de editar código que dispare recarga, avise, e prefira validar no DOM ou com o código real rodando sobre os bytes reais.

## Retomada de contexto

A documentação está dividida por **taxa de mudança**, para que uma sessão não precise ler tudo:

| Ler | Quando |
| --- | --- |
| `docs/CONTEXTO_ATUAL.md` | **sempre**, antes de propor alteração. Curto: estado funcional, estado do Supabase e próximo passo. |
| `docs/referencia/DECISOES.md` | **sempre**. Limites do produto, ordem das camadas, regras visuais validadas e regras de busca/foto/medição. |
| `docs/referencia/MAPA_DO_PROJETO.md` | quando precisar localizar arquivo, integração ou teste. |
| `docs/superpowers/notes/` | quando precisar da origem de uma decisão. É histórico, não estado vigente. |

Onde o histórico divergir do contexto ou das decisões, valem o contexto e as decisões.

### Onde registrar o quê

- Mudou o **estado** (o que funciona, o que falta, próximo passo) → `docs/CONTEXTO_ATUAL.md`.
- Mudou uma **regra de produto** → `docs/referencia/DECISOES.md`, e só com decisão explícita do usuário.
- Nasceu **arquivo, integração ou suíte** → `docs/referencia/MAPA_DO_PROJETO.md`.
- Aconteceu algo digno de relato na sessão → um arquivo datado em `docs/superpowers/notes/`.

### Escrita concorrente

Mais de um agente trabalha nesta pasta. Antes de gravar em qualquer arquivo de contexto,
releia o arquivo imediatamente antes de escrever: se ele mudou desde a leitura inicial,
descarte o rascunho, releia e refaça a edição sobre a versão nova. Nunca sobrescreva
contexto compartilhado com base numa leitura antiga, e prefira commits pequenos e
temáticos, que permitem reverter uma alteração ruim sem levar o resto junto.
