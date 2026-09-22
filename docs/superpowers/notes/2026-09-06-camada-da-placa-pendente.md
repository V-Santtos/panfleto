# Camada da placa — problema em aberto

**Data:** 6 de setembro de 2026
**Estado:** **não resolvido.** O que está no código é paliativo e ainda produz artefato.

## A regra de produto, como o operador a definiu

A composição tem três camadas, nesta ordem:

1. **Fundo** (BG) — o cenário do cartaz.
2. **Produto** — a foto da embalagem, **qualquer** foto, venha ela com fundo branco ou já recortada.
3. **Placa** — a placa inteira, com todas as suas camadas e informações.

A foto do produto fica **atrás da placa e na frente do fundo**. Se a embalagem for maior que o espaço e passar para fora da placa, a parte que sobra aparece normalmente; a parte que fica sobre a placa some atrás dela.

**Nunca se recorta a foto para caber.** Não existe corte, máscara ou ajuste na foto por causa da placa. É só ordem de camadas.

## Por que ainda não funciona

A placa não é uma camada. Ela está **pintada dentro do PNG de fundo** (`story-base-empty.png` e `feed-base-empty.png`). Não existe nenhum arquivo que contenha só a placa.

Sem esse arquivo, não há o que desenhar na frente do produto. A tentativa desta sessão foi redesenhar o **próprio PNG de fundo** recortado na região da placa. Isso funciona onde há placa, mas todo pixel de fundo que cai dentro do recorte é pintado por cima da foto — e aparece como um corte na embalagem.

Refinar o recorte não resolve. Foi tentado retângulo e depois quadrilátero acompanhando a inclinação da placa do Story; o artefato diminui e continua existindo, porque a natureza do erro é redesenhar fundo em vez de placa.

## O que resolve

Um PNG por template contendo **apenas a placa**, com transparência em toda a volta:

- `public/templates/story/single/story-placa.png` — 1080 × 1920
- `public/templates/feed/single/feed-placa.png` — 1080 × 1350

Mesma dimensão do fundo e mesma posição, para entrar no SVG com `x=0 y=0 width=1080` e casar pixel a pixel sem cálculo nenhum.

Com esse arquivo, o `StoryPoster` e o `FeedPoster` passam a ser:

```
<image href={fundo} />
{sombra}
{produto}
<image href={placa} />     ← nova camada, sem clip, sem medição
{ponta vermelha}
{textos}
```

O `clipPath` e o `<use>` que existem hoje saem inteiros. Nenhuma coordenada é medida, e a regra passa a valer para qualquer produto e qualquer template futuro, inclusive as grades de 4 e 8.

## Medições feitas (descartáveis depois do PNG da placa)

Registradas só para não se perder caso alguém precise recortar o ativo do PSD:

- **Story:** placa de `x 121, y 947` (topo) a `x 478, y 1395` (base), levemente inclinada — a borda direita anda de 474 a 478 e a esquerda de 121 a 123. Mastro em `x 298..303` descendo ao pedestal.
- **Feed:** placa reta, `x 186..437`, `y 650..970`. Mastro em `x 306..315`.

## Lição

O pedido era uma ordem de camadas. Faltava um ativo para cumpri-la. Em vez de dizer isso e pedir o ativo, foram gastas várias rodadas medindo o fundo para simular a camada que não existe — e cada rodada entregou o mesmo defeito com outra forma. Quando falta um ativo, o caminho curto é pedir o ativo.
