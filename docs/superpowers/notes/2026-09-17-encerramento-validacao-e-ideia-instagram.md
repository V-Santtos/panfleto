# Encerramento da validação e ideia de integração com Instagram

**Data:** 17 de setembro de 2026  
**Natureza:** registro de sessão; não é especificação nem plano aprovado.

## Encerramento

O usuário encerrou por enquanto a rodada manual de testes após validar busca, uso de
foto Cosmos, remoção de fundo pela Kie, tempo de processamento e o comportamento de
tamanho das embalagens. A última mudança foi a escala automática por peso visual,
motivada pela diferença entre o pacote vertical de Croques e o multipack horizontal
de Danoninho.

A validação automatizada terminou com 30 arquivos e 236 testes, além do build de
produção. Não houve chamada real à Kie ou ao Cosmos durante os testes automatizados.
O navegador ficou sem rascunho ativo depois do HMR, e não há estado vivo a preservar.

## Ideia para investigar depois

Possível integração com o Instagram: gerar a arte no Oferta Lab e, depois da
confirmação humana, publicá-la no perfil da loja.

Esta ideia não entrou no MVP e não autoriza implementação. Quando for retomada, a
investigação deve usar documentação oficial da Meta e responder, no mínimo:

1. Quais tipos de conta podem publicar pela API e se uma Página do Facebook precisa estar vinculada.
2. Quais permissões, revisão do aplicativo e etapas de autenticação são exigidas.
3. Como funcionam validade e renovação de tokens sem expor credenciais no navegador.
4. Se a API e o fluxo de publicação têm custo, limites ou condições comerciais.
5. Se a mídia precisa estar hospedada em URL pública e por quanto tempo.
6. Quais formatos e proporções são aceitos para Feed e Story e se ambos podem ser publicados pela mesma interface.
7. Quais limites de volume, erros recuperáveis, idempotência e confirmação de postagem precisam ser tratados.
8. Como preservar o portão humano: gerar não significa publicar; a postagem deve exigir ação explícita e mostrar o destino.

Até essa investigação e uma nova aprovação de escopo, postagem automática permanece
fora do produto atual.
