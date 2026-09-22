# Filtro de candidatas — 5 de setembro de 2026

Direção corrigida pelo usuário: mostrar somente produto isolado em branco/transparência, como Terra Viva e Xandô. Nenhuma foto informal deve entrar como fallback; não remover fundo para disfarçar a origem na galeria.

Implementado:

- País Brasil e tokens de nome/marca, procedência obrigatória, frontal selecionada em resolução completa e cancelamento de consultas antigas.
- Proxy local restrito às frontais do Open Food Facts: limite de 12 MB, timeout, validação JPEG e bloqueio de redirecionamentos/destinos arbitrários.
- Análise reduzida a 256 px em dois Workers; renderização progressiva somente após aprovação; no máximo seis fotos ordenadas pela pontuação.
- Veto de fundo não branco, imagem vazia, cena retangular com margem branca, vários objetos significativos, enquadramento insuficiente e desfoque. Sem recorte nem modelo neural neste incremento.
- O grid e a seleção usam a mesma imagem que foi analisada, via proxy local, preservando a URL original na procedência.
- Mensagem explícita se nenhuma candidata passar; nenhuma foto reprovada é reinserida.

Calibração dos exemplos: Xandô tem apenas 258×536 px, apesar do bom fundo. A exigência visual mais recente do usuário foi priorizada: fotos isoladas de 200–599 px podem aparecer com aviso de definição; menos de 200 px continuam bloqueadas. O piso de ocupação por área foi substituído por área mínima de 12% e lado dominante mínimo de 55%, para não excluir garrafas finas. Terra Viva tem pequena sombra/borda: exige-se borda majoritariamente branca (85%, luminância média >240), em vez de branco perfeito em todos os pixels. São decisões explícitas deste ajuste, não cumprimento literal dos thresholds originais.

Comparação da busca antes do filtro visual:

| Consulta | Registros originais | Fotos antes | Sem Brasil cadastrado entre as 33 antigas | Candidatas após país/texto |
| --- | ---: | ---: | ---: | ---: |
| Nescau | 63 | 33 | 1 | 49, com 33 na fila visual |
| Leite integral | 100 | 33 | 8 | 56, com 33 na fila visual |

Limitações: a regra textual de pelo menos um token permite correspondências parciais em termos genéricos. As métricas visuais são heurísticas conservadoras; não comprovam semanticamente a ausência de mãos/cenas em qualquer imagem futura e podem rejeitar embalagens muito retangulares. Não foi executado o aceite completo dos 30 produtos, upload, normalização ou cache IndexedDB. Esses itens permanecem nos incrementos seguintes.

Referência para frontais em resolução completa: https://openfoodfacts.github.io/openfoodfacts-server/api/how-to-download-images/

Testes automatizados cobrem relevância, país, seleção, cancelamento, invisibilidade de candidatas cruas/reprovadas, fundo branco/transparente/colorido, foto dentro de moldura branca, imagem vazia, múltiplos objetos e limites do proxy. Build inclui Worker separado.
