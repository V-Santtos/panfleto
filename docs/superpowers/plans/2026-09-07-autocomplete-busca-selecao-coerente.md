# Plano aprovado — autocomplete e seleção coerente da embalagem

**Data:** 7 de setembro de 2026  
**Estado:** concluído e validado  
**Escopo:** transformar os resultados incrementais em um autocomplete ligado ao campo, tornar o estado cadastrado verde antes da seleção e remover a embalagem quando a pesquisa deixa de representar um produto selecionado.

## Comportamento aprovado

1. A partir de dois caracteres, resultados do catálogo aparecem em linhas horizontais num painel ligado à base do campo de pesquisa.
2. Cada sugestão cadastrada mostra miniatura, nome, apresentação e indicação verde permanente antes do clique.
3. Mouse, setas e Enter permitem escolher uma sugestão; a seleção preenche o campo com o nome escolhido e fecha o painel.
4. Editar o valor depois de uma seleção desfaz a seleção anterior. Campo vazio significa nenhum produto e nenhuma seção **Embalagem do produto**.
5. Desfazer a seleção limpa foto e estados dependentes da embalagem, sem alterar o Supabase e sem executar o reset completo de **Criar nova oferta**.
6. Busca numérica continua dependendo de **Buscar** ou Enter; nenhuma digitação automática consulta Cosmos, Open Food Facts ou Kie.

## Arquivos e testes

- `src/components/ProductSearch.tsx`: combobox, painel, navegação e vínculo entre texto e seleção.
- `src/app/App.tsx`: limpeza explícita do produto e da foto quando a seleção é desfeita.
- `src/styles.css`: dropdown horizontal, verde permanente e realces de foco/seleção.
- `src/components/ProductSearch.test.tsx` e `src/app/App.persistence.test.tsx`: busca incremental, teclado, fechamento, limpeza e ausência do preview antigo.
- `docs/CONTEXTO_ATUAL.md`: registrar o comportamento validado.

## Critérios de aceite

- `NE` mostra o Nescau no próprio conjunto visual da barra, sem card solto abaixo da seção.
- A sugestão já é verde antes do clique e possui miniatura.
- Selecionar preenche o campo e exibe **Embalagem do produto**.
- Apagar ou editar a seleção esconde imediatamente a embalagem anterior.
- Cadastro manual continua indisponível enquanto o campo contém texto.
- Todos os testes e o build passam.

## Validação concluída

- `NE` abriu uma linha horizontal ligada ao campo, com miniatura, fundo verde suave, borda verde permanente e rótulo **Já cadastrado**.
- Enter escolhe a primeira sugestão; setas alteram o realce; seleção preenche o campo e fecha a lista sem refazer a busca.
- Apagar o campo após uma seleção removeu imediatamente **Embalagem do produto**, nome, quantidade, foto e placement em memória.
- O Supabase não foi alterado e nenhuma consulta Cosmos/Kie foi executada.
- Passaram 202 testes em 27 arquivos e `npm run build`.
