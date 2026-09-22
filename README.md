# Catálogo Promocional para Supermercados

Aplicação local em React, TypeScript e Vite que transforma um produto, sua apresentação e preço em um Story promocional consistente. A prévia e a exportação usam o mesmo SVG.

## Estado atual

O Story de **um produto** está funcional em `http://127.0.0.1:4173/`, com:

- busca por nome/marca somente no catálogo próprio e por EAN/GTIN exato com verificação local primeiro;
- Open Food Facts e Cosmos usados apenas para um código exato ainda ausente do catálogo;
- cadastro manual separado, sempre iniciado como rascunho;
- fotos validadas por origem, seleção humana e upload manual como alternativa;
- remoção de fundo feita pela Kie, sob comando do operador, tanto para upload manual quanto para foto vinda da busca; o projeto não recorta fundo branco por código;
- medição da silhueta sem alterar a foto, ancoragem no pedestal e sombra de contato adaptativa;
- quantidade/unidade modular, usando `UN` para unidade;
- exportação local do SVG em PNG e PDF.

Feed de um produto está funcional. As composições de 4 e 8 produtos continuam planejadas.

**Pendência conhecida:** a foto do produto deve ficar atrás da placa e na frente do fundo, sem nenhum recorte. Hoje a placa está pintada dentro do PNG de fundo, então essa camada não existe e o cartaz ainda mostra artefato. Falta um PNG por template contendo só a placa — ver [`docs/superpowers/notes/2026-09-06-camada-da-placa-pendente.md`](docs/superpowers/notes/2026-09-06-camada-da-placa-pendente.md).

O projeto Supabase dedicado já contém as nove tabelas, funções controladas, RLS e o bucket privado. A ligação de ativos, campanha e exportação à interface ainda está em implementação; o banco continua sem dados reais e sem template Feed.

## Executar localmente

```powershell
npm run dev
```

Abra `http://127.0.0.1:4173/`. Para testes e build:

```powershell
npm test
npm run build
```

As instruções para evitar reinício durante uma demonstração estão em [`docs/GUIA_OPERACAO_LOCAL.md`](docs/GUIA_OPERACAO_LOCAL.md).

## Documentação

- Ponto de retomada e estado atual: [`docs/CONTEXTO_ATUAL.md`](docs/CONTEXTO_ATUAL.md)
- Limites, ordem das camadas e regras visuais validadas: [`docs/referencia/DECISOES.md`](docs/referencia/DECISOES.md)
- Mapa de arquivos, integrações e testes: [`docs/referencia/MAPA_DO_PROJETO.md`](docs/referencia/MAPA_DO_PROJETO.md)
- Operação da interface local: [`docs/GUIA_OPERACAO_LOCAL.md`](docs/GUIA_OPERACAO_LOCAL.md)
- Especificação canônica: [`docs/superpowers/specs/2026-09-04-catalogo-promocional-mvp-design.md`](docs/superpowers/specs/2026-09-04-catalogo-promocional-mvp-design.md)
- Veredito e critérios de MVP: [`atlas-output/go/catalogo-promocional-supermercados/2026-09-04-veredito-e-escopo-mvp-v1.md`](atlas-output/go/catalogo-promocional-supermercados/2026-09-04-veredito-e-escopo-mvp-v1.md)
- Planos e registros históricos: [`docs/superpowers/`](docs/superpowers/)

## Segredos locais

Crie `.env.local` a partir de `.env.example` e preencha as chaves somente no computador local. Não exponha `KIE_API_KEY`, `COSMOS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` ou `.env.local`. A service role do Supabase é usada somente pelo servidor local Vite e nunca deve receber prefixo `VITE_`.
