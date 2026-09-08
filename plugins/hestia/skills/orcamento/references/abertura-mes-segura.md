# Abertura segura do mês

Este protocolo governa somente o Fluxo 2 de `orcamento`. Ele coordena arquivos por um conector
que não oferece transação entre eles. Não prometa atomicidade: releitura e journal tornam estado
parcial detectável e reconciliável, mas outra pessoa ainda pode editar entre a última leitura e a
gravação.

## Arquivos e identidades

Além de `AAAA-MM.csv` e `recorrencias.csv`, mantenha
`aberturas-do-mes.jsonl` na mesma pasta de orçamento. Cada abertura tem um `operacao_id` único e
legível, com mês e instante UTC. Cada item tem um `item_id` único dentro da operação.

No plano e no journal, registre para cada item:

- a identidade lógica: `item_id`, mês aberto, número da linha de origem no snapshot e a linha
  completa de `recorrencias.csv`; linhas byte a byte idênticas continuam distintas pelo número
  no snapshot;
- o efeito no livro: linha exata esperada, com data, tipo, categoria, descrição, valor e método;
- o efeito na recorrência: linha exata antes e linha exata depois, ou `null` quando uma parcela
  chega a zero e deve ser removida;
- a decisão: `selecionado`, `pulado`, `ja_existia` ou `pendente_reconciliacao`, com motivo.

O dia do lançamento pertence ao mês aberto. Use o dia cadastrado ou o último dia daquele mês se
o número não existir nele. Não use a data de hoje para outro mês.

## Preparar sem escrever

1. Antes de preparar uma nova abertura, leia o journal. Se houver operação sem estado terminal,
   reconcilie-a pela seção abaixo antes de continuar.
2. Leia `recorrencias.csv` e o livro do mês completos e valide seus cabeçalhos. Guarde o conteúdo
   exato lido como snapshot. Se o cadastro não existir, ofereça criá-lo pelo Fluxo 3.
3. Compare pelo efeito completo esperado no livro, não só por nome e valor. Para uma recorrência
   fixa, uma correspondência exata preexistente pode virar `ja_existia` e ficar fora do lote. Para
   uma **parcelada**, uma linha preexistente sem journal pode ser o estado parcial de uma abertura
   antiga: marque `pendente_reconciliacao`, mostre livro e cadastro ao usuário e peça que ele
   confirme se a parcela já foi contabilizada e qual correção exata autoriza. Nunca infira o
   decremento. Duas ou mais linhas compatíveis, ou duas recorrências que produziriam o mesmo
   efeito, também são ambíguas e param para reconciliação manual. Nunca escolha pela ordem, pelo
   nome ou pelo valor.
4. Monte a lista completa: itens selecionados, itens pulados pelo usuário e itens já existentes.
   Para cada selecionado, mostre a linha que entrará no livro e, quando parcelado, o antes/depois
   em `recorrencias.csv` (inclusive remoção ao chegar a zero). Mostre também criação de cabeçalho
   e do journal, se necessárias, e os totais de despesas, receitas e saldo projetado.
5. Peça **uma confirmação para o efeito completo**: journal, linhas do livro e todos os
   decrementos ou remoções listados. Se o usuário recusar ou não confirmar, não escreva arquivo
   algum. Item pulado não entra no livro e não muda no cadastro.

## Executar após a confirmação única

1. Releia o journal, o livro e `recorrencias.csv`. Compare os dois CSVs com os snapshots usados
   na confirmação. Qualquer diferença é conflito: não grave, refaça o plano e peça nova
   confirmação. Isto detecta concorrência observável; não é compare-and-swap e não elimina a
   janela entre leitura e escrita.
2. Acrescente ao journal um registro `planejado` com o plano confirmado, o conteúdo exato dos
   snapshots completos antes e o conteúdo completo esperado depois de cada CSV. Releia e confirme que esse
   registro persistiu **antes do primeiro efeito financeiro**. Resultado ausente ou incerto para
   o journal interrompe a operação.
3. Faça **uma única gravação do lote completo no livro**: releia e compare com `livro_antes`,
   acrescente todas as linhas selecionadas numa só operação do conector e releia esperando
   `livro_depois` completo. Registre `livro_verificado` no journal. Não faça um append por item,
   pois o primeiro invalidaria o snapshot usado para conferir o segundo.
4. Faça **uma única gravação de `recorrencias.csv`**: releia e compare com
   `recorrencias_antes`, grave o conteúdo completo `recorrencias_depois` numa só operação e
   releia o arquivo inteiro. Registre `recorrencias_verificadas`. Não decremente item `pulado`,
   `ja_existia`, `pendente_reconciliacao` ou sem efeito no livro verificado para este
   `operacao_id`. Um retorno de conector sem releitura conclusiva é resultado incerto, não sucesso.
5. Após verificar os dois arquivos, acrescente `concluida` ao journal com o antes/depois observado
   por `item_id`. Termine com o total efetivamente lançado e o saldo projetado das recorrências.

## Reconciliar falha, crash ou resposta incerta

Nunca repita uma escrita porque o conector falhou ou demorou. Primeiro releia journal, livro e
cadastro e compare os conteúdos completos com `livro_antes`, `livro_depois`,
`recorrencias_antes` e `recorrencias_depois`, além dos estados de cada `item_id`:

- livro ausente e recorrência no estado anterior: o efeito ainda está pendente e pode continuar
  somente a partir do journal confirmado;
- livro presente uma vez e recorrência no estado anterior: verifique que a linha pertence ao
  `operacao_id` pelo plano persistido, então aplique uma única vez o estado posterior;
- livro presente uma vez e recorrência no estado posterior: marque o item verificado;
- recorrência no estado posterior sem a linha do livro, linha repetida, estado que não é nem o
  antes nem o depois, snapshot mudado por outra pessoa ou qualquer correspondência ambígua:
   registre `conflito`, pare e mostre ao usuário a diferença para reconciliação manual.

`conflito` **não é estado terminal nem prova de resolução**. Estados terminais são somente
`concluida` e `cancelada`. Para retomar, releia tudo e acrescente `reconciliada` ao journal com a
decisão humana e o novo estado observado. Se o efeito restante for exatamente o plano persistido,
a confirmação original continua registrada e autoriza concluir apenas esse efeito pendente. Se a
reconciliação mudar qualquer linha ou efeito confirmado, mostre o novo antes/depois e peça uma
nova confirmação antes de escrever.

Se o processo cair antes de persistir e reler `planejado`, qualquer linha preexistente continua
sem vínculo comprovado com a abertura. Para parcela, marque `pendente_reconciliacao` e peça uma
decisão humana; nunca use sua presença para inferir decremento. O mesmo vale para duas aberturas
concorrentes: a releitura pode detectar snapshots ou efeitos divergentes, mas não há trava global
nem garantia transacional.

## Exemplo sintético mínimo de journal

Cada linha abaixo é um objeto JSON completo. Os `\n` representam quebras dentro do snapshot;
nomes e valores são fictícios.

```jsonl
{"operacao_id":"abrir-2099-02-20990201T120000Z","estado":"planejado","confirmacao":"confirmada","livro_antes":"data;tipo;categoria;descricao;valor;metodo\n","livro_depois":"data;tipo;categoria;descricao;valor;metodo\n2099-02-28;despesa;Exemplo;Parcela exemplo;10,00;pix\n","recorrencias_antes":"nome;tipo;categoria;descricao;valor;dia;metodo;parcelas_restantes\nParcela exemplo;despesa;Exemplo;Teste;10,00;31;pix;2\n","recorrencias_depois":"nome;tipo;categoria;descricao;valor;dia;metodo;parcelas_restantes\nParcela exemplo;despesa;Exemplo;Teste;10,00;31;pix;1\n","itens":[{"item_id":"item-1","origem_linha":2,"origem":"Parcela exemplo;despesa;Exemplo;Teste;10,00;31;pix;2","decisao":"selecionado","livro_linha":"2099-02-28;despesa;Exemplo;Parcela exemplo;10,00;pix","recorrencia_antes":"Parcela exemplo;despesa;Exemplo;Teste;10,00;31;pix;2","recorrencia_depois":"Parcela exemplo;despesa;Exemplo;Teste;10,00;31;pix;1"}]}
{"operacao_id":"abrir-2099-02-20990201T120000Z","estado":"concluida","livro_observado":"igual_a_livro_depois","recorrencias_observado":"igual_a_recorrencias_depois"}
```
