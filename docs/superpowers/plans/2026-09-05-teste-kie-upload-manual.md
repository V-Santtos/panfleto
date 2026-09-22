# Plano — teste assistido de remoção de fundo Kie para upload manual

Data: 5 de setembro de 2026  
Estado: aprovado para o primeiro incremento em 5 de setembro de 2026. Hospedagem pública temporária foi recusada; a compatibilidade de `data URL` será testada sob ação explícita do operador.

## Objetivo

Permitir testar, em `localhost`, a qualidade do modelo `recraft/remove-background` em até oito fotos reais de embalagens enviadas manualmente pelo operador. O primeiro caso é deliberadamente difícil: uma garrafa branca sobre fundo branco.

O teste deve mostrar e preservar a foto original, disparar a Kie somente por uma ação explícita, apresentar o PNG tratado para revisão humana e permitir manter, substituir ou remover a foto. Nenhum resultado será usado automaticamente no Story sem aprovação do operador.

## Escopo autorizado para este incremento

- Um produto por vez, no Story atual.
- Arquivos PNG, JPEG e WebP, respeitando os limites publicados pela Kie (até 5 MB, 16 MP e dimensão entre 256 e 4096 px); a interface explica qualquer bloqueio antes de enviar.
- Foto original e resultado tratado lado a lado, com indicação inequívoca de qual está ativo no cartaz.
- Ações: escolher/trocar arquivo, remover a foto, iniciar remoção de fundo, cancelar/ignorar o resultado e aprovar o resultado.
- Estados: arquivo validado, enviando, aguardando processamento, pronto para revisão, falhou e aprovado.
- Polling local do `taskId`, pois o app continua em `localhost` e não oferece callback público.
- Registro manual dos oito casos (foto, resultado, tempo e defeitos visuais) em nota de teste; não há telemetria externa, catálogo persistente nem novo fluxo de busca.

## Limite técnico que precisa de decisão

A rota atual `server/kieBackgroundRemoval.ts` aceita apenas URLs HTTPS de Open Food Facts. Isso protege a chave, mas impede que um `File` local alcance a Kie. A documentação pública do modelo mostra o campo `input.image` como URL e não documenta transporte de um arquivo local pelo endpoint de tarefa.

Antes de codificar a chamada para upload manual, decidir uma destas alternativas:

1. **Upload Base64 temporário oficial da Kie (escolhido):** enviar a foto escolhida como `data:image/...` ao endpoint oficial de upload da Kie. O servidor local recebe a URL temporária emitida pela própria Kie e a entrega ao `recraft/remove-background`. Não existe hospedagem mantida pelo projeto; a documentação da Kie declara expiração automática do arquivo temporário. Só será adotado se a Kie confirmar a tarefa e retornar um PNG utilizável.
2. **Hospedagem temporária pública:** recusada pelo usuário e fora deste plano.

Não será criado um backend público, túnel, nuvem permanente, banco remoto ou envio automático de arquivos. A chave continua exclusivamente em `KIE_API_KEY` no servidor Vite e nunca chega ao navegador.

## Estado atual confirmado

- `src/components/ImageUpload.tsx` valida tipo e tamanho e chama `onSelect(file)`, mas não mostra miniatura nem permite remover o arquivo atual.
- `src/app/App.tsx` guarda o upload como object URL e o põe imediatamente no Story; imagens de fontes externas passam pelo recorte determinístico em Worker.
- `src/images/kieClient.ts` cria/consulta tarefas na rota local, porém apenas a partir de `imageUrl`.
- `server/kieBackgroundRemoval.ts` envia `model: "recraft/remove-background"`, aceita somente hosts Open Food Facts e já protege chave, método, tamanho do JSON, timeout e formato de `taskId`.
- O modelo não expõe prompt de texto: o teste avalia a remoção automática do modelo, não uma engenharia de prompt.

## Implementação em incrementos pequenos

### 1. Contrato de estado e testes de interface

Criar um tipo de estado para a foto manual, separando `original`, `resultado Kie`, geometria medida, tarefa atual, erro e escolha aprovada. Não misturar esse estado com a foto automática do catálogo.

Atualizar `src/components/ImageUpload.tsx` e seus testes para:

- mostrar a miniatura do arquivo selecionado e seus dados essenciais;
- oferecer **Trocar foto** e **Remover foto**;
- expor botão **Remover fundo com Kie** apenas depois de um arquivo local válido;
- desabilitar ações incompatíveis enquanto houver tarefa pendente;
- preservar a foto original em caso de erro ou rejeição do resultado.

Testes: arquivo válido/inválido, limites da Kie, miniatura, troca, remoção, estados de botão e ausência de chamada de rede antes de clique explícito.

### 2. Transporte escolhido e fronteira segura do servidor

Depois da decisão acima, adaptar `src/images/kieClient.ts`, `server/kieBackgroundRemoval.ts` e testes.

- A rota recebe somente o formato escolhido e rejeita qualquer outro payload, arquivo grande ou tipo não permitido.
- Continuar usando `Authorization: Bearer` somente no processo Vite, timeout e respostas sem cache.
- Criar uma tarefa somente mediante POST originado pela ação do operador; escolher produto, subir arquivo e abrir a tela não consomem créditos.
- Manter consulta de status limitada a `task_recraft_*`; normalizar uma resposta concluída para URL do PNG e uma falha para mensagem segura.

Testes: chave ausente, método inválido, corpo e tipo inválidos, tamanho excedido, tarefa reconhecida, resposta malformada da Kie e garantia de que a chave nunca está no cliente.

### 3. Revisão do resultado e integração segura ao Story

Em `src/app/App.tsx`:

- iniciar e consultar a tarefa apenas após o clique;
- baixar o PNG final pelo caminho seguro já usado para imagens externas, analisar o alpha e calcular a geometria para o pedestal;
- exibir original e tratado em revisão;
- trocar a imagem do Story somente quando o operador aprovar o resultado;
- se o resultado estiver vazio, sem alpha significativo, não puder ser baixado/decodificado ou falhar na análise, mantê-lo fora do cartaz e preservar o original;
- exigir nova confirmação comercial depois de aprovar, trocar ou remover uma foto.

Testes: sucesso, polling pendente/concluído/falha, troca de produto durante tarefa, troca de arquivo durante tarefa, resultado inválido, aprovação/rejeição e revogação de object URLs.

### 4. Bateria de oito testes e decisão de qualidade

Criar `docs/superpowers/notes/2026-09-05-bateria-kie-upload-manual.md` como formulário de evidência. Cada caso registra original, resultado, duração, aceitação e defeitos: corte de borda, perda de tampa/rótulo, halo, transparência indevida, sombra errada e identificação prejudicada.

Cobrir: garrafa branca em fundo branco; embalagem escura; rótulo claro; caixa; pote; embalagem com tampa colorida; produto com sombra; e uma foto deliberadamente ruim. A conclusão não será “a IA funciona” em geral: será aprovada, condicionada ou reprovada para essa amostra de embalagens.

## Verificação de cada incremento

Executar `npm test` e `npm run build`. Para a etapa com a Kie configurada, fazer chamadas reais somente com autorização explícita do operador em cada item da bateria, registrar o `taskId` apenas localmente durante a sessão e nunca imprimir token, payload de imagem ou URL privada em logs/documentação.

## Fora do escopo

- Busca textual no catálogo próprio, banco de produtos, persistência após recarga e reuso por nome.
- Processamento automático de qualquer upload ou de fotos das fontes externas.
- Hospedagem pública permanente, callback público, túnel, autenticação, nuvem, integração ERP ou publicação social.
- Alterações de Feed ou dos layouts de quatro e oito produtos.

## Aprovação solicitada

Aprovar este plano e escolher a alternativa de transporte do upload libera a implementação incremental, começando pela interface e seus testes. A primeira chamada que puder consumir crédito será sempre apresentada como ação manual do operador.
