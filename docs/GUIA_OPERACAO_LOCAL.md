# Guia de operação local

Este guia define o significado de pedidos como **"subir o sistema"**, **"subir o visual"**, **"rodar o app"** ou **"abrir a prévia"** neste projeto.

## Subir a interface visual

No diretório raiz do projeto, iniciar:

```powershell
npm run dev
```

O Vite deve informar a URL local. A interface visual deste projeto é aberta em:

```text
http://127.0.0.1:4173/
```

Antes de iniciar outro processo, verificar se essa URL já responde. Se estiver ativa, reutilizar o servidor existente: não iniciar uma cópia e não reiniciar a sessão visual sem necessidade.

## Regra durante teste manual

O formulário e o produto selecionado vivem hoje na memória do navegador. Uma recarga, remount do React ou reinício do Vite pode limpar esses dados.

Portanto, durante um teste com produto já selecionado:

- não executar `npm run dev` novamente;
- não reiniciar nem atualizar a página;
- não compilar/alterar código que possa causar remount sem avisar antes;
- não disparar nova consulta Cosmos sem o pedido explícito do operador;
- preferir registrar a observação e fazer a alteração depois do teste, ou pedir que o operador confirme que o estado pode ser perdido.

## Configuração local uma única vez

1. Copiar `.env.example` para `.env.local`.
2. Preencher somente no computador local as chaves já contratadas:

```text
KIE_API_KEY=
COSMOS_TOKEN=
COSMOS_USER_AGENT=Cosmos-API-Request
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` só é usada pelas rotas Node/Vite locais. Ela nunca pode ser importada por código em `src/`, devolvida em resposta HTTP ou exposta ao navegador.

3. Nunca usar prefixo `VITE_` para segredos, nunca enviar `.env.local` ao Git e nunca revelar valores em uma conversa.
4. Depois de alterar `.env.local`, parar e iniciar o Vite uma vez, antes de começar um teste manual.

## Verificações seguras

| Objetivo | Ação | Consome Cosmos? |
| --- | --- | --- |
| confirmar que a interface está no ar | abrir `http://127.0.0.1:4173/` | não |
| confirmar que a fronteira do catálogo foi configurada | abrir `http://127.0.0.1:4173/api/catalogo/status` | não |
| confirmar se Cosmos foi configurado e ver o uso diário | abrir `http://127.0.0.1:4173/api/cosmos/status` | não |
| validar código e testes | `npm test` e `npm run build` | não |
| buscar nome/marca | digitar o texto e clicar em Buscar; consulta apenas o catálogo próprio | não |
| buscar um GTIN/EAN exato na interface | digitar o código e clicar em Buscar; fontes externas só entram após ausência local | sim, se o código não existir, Cosmos estiver configurado e a reserva no banco for aceita |

## Encerramento

O servidor de desenvolvimento pode ser encerrado com `Ctrl+C` somente quando não houver teste manual em andamento. `dist/` é descartável e pode ser recriado por `npm run build`; ele não substitui o servidor de desenvolvimento nem guarda o rascunho do operador.

Consulte também [`CONTEXTO_ATUAL.md`](CONTEXTO_ATUAL.md) para entender regras de foto, posicionamento e estado da implementação.
