# Foto Cosmos observável e legítima

**Data:** 6 de setembro de 2026  
**Estado:** implementado e verificado em 6 de setembro de 2026  
**Origem:** teste real do GTIN `7891000053508` (Nescau 400 g)

## Problema confirmado

O resultado da busca exibiu metadados parciais do Open Food Facts e "Sem foto
aprovada", embora o CDN do Cosmos entregue para esse GTIN um JPEG válido de
500 × 500. O fluxo atual deixa uma falha do Cosmos invisível quando a fonte
gratuita retorna algum metadado: `Promise.allSettled` preserva o candidato
gratuito, mas descarta o erro do Cosmos. A interface tampouco diferencia uma
foto ausente, uma foto que não carregou e uma foto rejeitada pelo qualificador.

O qualificador atual mede fundo, enquadramento, resolução, múltiplos objetos e
nitidez. Ele não possui uma regra explícita para ilustrações genéricas do
Cosmos, como a referência de esmalte apresentada pelo operador.

## Decisões propostas

1. Uma busca por GTIN continua executando Cosmos e Open Food Facts em paralelo
   somente após ausência no catálogo próprio. Nenhuma busca adicional será
   disparada automaticamente para diagnóstico ou retentativa.
2. Um insucesso, resposta divergente ou resposta estruturalmente inválida do
   Cosmos será devolvido como **aviso de fonte**, mesmo se o Open Food Facts
   puder formar um candidato. O produto permanece utilizável e o upload manual
   continua disponível.
3. Cada foto candidata passa a ter estado auditável na interface:
   `aprovada`, `sem foto na fonte`, `não carregou` ou `reprovada`, com motivo
   curto e compreensível. Apenas a aprovada pode entrar no cartaz.
4. Fotos genéricas não serão aprovadas. Sem introduzir IA ou um editor, o
   qualificador adicionará um veto determinístico de **ilustração genérica**:
   uma base gráfica grande, quase uniforme e pouco texturizada (por exemplo,
   o halo circular cinza de um ícone) envolvendo um objeto menor. O veto será
   combinado com os critérios existentes; não dependerá de nome, marca nem
   inferência de SKU. Fotos reais com fundo branco/transparente, embalagem
   inteira e textura suficiente continuam elegíveis.
5. O motivo técnico detalhado fica restrito ao estado interno/testes. A tela
   usa frases operacionais e não exibe URLs, tokens nem segredos.

## Implementação mínima

1. **Resultado e erros por fonte**
   - Estender `ProductSearchResult` em `src/domain/productSearch.ts` com avisos
     tipados por origem.
   - Preservar o resultado válido de uma fonte quando a outra falhar, mas
     registrar a falha do Cosmos, resposta malformada ou GTIN divergente em vez
     de silenciosamente descartá-la.
   - Cobrir em `src/domain/productSearch.test.ts`: Cosmos com thumbnail válida,
     Cosmos indisponível junto de OFF válido, resposta divergente e ausência de
     foto sem erro global.

2. **Qualificação rastreável**
   - Ajustar `src/images/qualificationClient.ts` para devolver avaliação de
     todas as fotos, inclusive as reprovadas e as que não carregam, preservando
     a lista aprovada usada na seleção.
   - Expor em `src/components/ProductSearch.tsx` o estado por origem e uma
     mensagem curta por motivo; manter `onSelect` sem URL de imagem para fotos
     não aprovadas.
   - Cobrir a interface em `src/components/ProductSearch.test.tsx` sem mudar o
     comportamento de foto já aprovada.

3. **Veto de ilustração genérica**
   - Acrescentar `generic-illustration` aos motivos de
     `src/images/packshotAnalysis.ts` e à sua tradução para a interface.
   - Calcular o sinal apenas com pixels do arquivo local: identificar uma massa
     quase uniforme, de baixa saturação e baixa variação de luminância que
     circunda uma segunda região de produto. Rejeitar somente quando essa massa
     ocupar uma parcela dominante, formar uma geometria de halo e coexistir com
     a região menor; evitar reprovar embalagens grandes, fotos brancas e PNGs
     transparentes.
   - Criar fixtures sintéticas em `src/images/packshotAnalysis.test.ts` que
     representem (a) foto real isolada aprovada, (b) ícone genérico com halo
     reprovado e (c) embalagem retangular clara que não pode ser falsamente
     classificada como ilustração.

4. **Verificação**
   - Executar os testes relacionados durante a implementação e, ao final,
     `npm test` e `npm run build`.
   - Não recarregar, reiniciar Vite nem pesquisar novamente o GTIN de teste
     enquanto o operador mantiver o rascunho aberto. A validação visual real
     fica para uma busca explícita do operador após a alteração.

## Fora deste corte

- IA, visão computacional remota, classificação por marca/SKU ou consulta
  adicional ao Cosmos.
- Alterar a associação humana final produto–imagem.
- Persistir a foto no catálogo, alterar o schema remoto ou criar um editor.

## Critérios de aceite

- Uma foto válida do Cosmos que chega ao cliente é apresentada como candidata e
  pode ser escolhida após aprovação.
- Falha do Cosmos ao lado de metadados do OFF permanece visível, sem bloquear
  produto, preço ou alternativa manual.
- A tela explica se a imagem faltou, falhou ao carregar ou foi reprovada, sem
  expor detalhes de infraestrutura.
- A referência sintética de ilustração genérica é bloqueada, e as fotos/PNGs
  válidos existentes continuam aprovados nos testes.
- Preview e exportação não são modificados por este corte.

## Validação executada

- `npm test`: 22 arquivos e 158 testes aprovados.
- `npm run build`: TypeScript e build Vite aprovados.
- Não houve nova consulta ao endpoint Cosmos durante a implementação ou a
  validação automatizada.
