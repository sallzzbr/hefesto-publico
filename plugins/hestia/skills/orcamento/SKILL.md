---
description: Use quando o usuário quiser registrar (lançar) uma despesa ou receita, abrir o mês (lançar recorrências em lote), gerenciar recorrências/parcelamentos, ver o status/saldo do mês, ou fechar o mês do orçamento doméstico em BRL. Os dados ficam em CSVs mensais (AAAA-MM.csv) na pasta de orçamento do hestia no Google Drive (pasta configurável por workspace/defaults), acessada pelo conector. Sempre confirma antes de escrever e nunca dá conselho de investimento. Para análise histórica e comparações, use a skill irmã analisar-gastos.
---

# Orçamento Doméstico

Esta skill ensina como organizar o orçamento doméstico mensal em arquivos CSV
guardados no Google Drive: o livro do mês (despesas E receitas) e o cadastro de
recorrências. Esta skill é só INSTRUÇÃO: ela não lê nem escreve arquivos sozinha —
quem acessa o Drive é o conector do Google Drive já configurado no Cowork/Claude Code.

## Regras invioláveis (leia primeiro)

1. **Dados ficam no Google Drive, nunca no repositório.** Use sempre o conector do Google Drive.
   Refira a pasta pelo caminho/nome resolvido (ver "Onde ficam os dados"), NUNCA por ID. Não cole
   IDs de pasta, links com ID, nem nomes de ferramentas específicas do conector — eles mudam de
   ambiente para ambiente.
2. **Confirme antes de QUALQUER escrita.** Nunca crie, edite ou acrescente uma linha sem antes
   mostrar exatamente o que será gravado e receber o "ok" do usuário.
3. **Exibir em BRL, guardar no formato cru.** Mostre valores como `R$ 1.234,56` (ponto de milhar,
   vírgula decimal). Grave no CSV como `1234,56` (vírgula decimal, sem ponto de milhar, sem `R$`).
4. **Esta skill não dá conselho de investimento.** Ela registra e resume gastos e receitas.
   Decisões financeiras são do usuário.
5. **Fechar o mês é só leitura.** Nunca apague, mova ou sobrescreva dados ao fechar.

## Onde ficam os dados

A pasta-base do hestia no Drive é resolvida pela **regra única** de
`${CLAUDE_PLUGIN_ROOT}/skills/orcamento/references/defaults.md`, nesta ordem: (1) campo
`local_dados` na seção `## Paths do workspace` do `CLAUDE.md` do repositório atual;
(2) `local_dados` dos defaults do usuário (`~/.claude/hestia/defaults.md`); (3) default
documentado `Financas/hestia/`. Esta skill usa a subpasta `orcamento/` da base resolvida.
Os paths `Financas/hestia/orcamento/...` citados nos exemplos abaixo são **ilustrativos do
default, não hardcode**. Dois tipos de arquivo:

### Livro do mês — `AAAA-MM.csv`

Um arquivo por mês (ex.: `2026-06.csv`). O "mês atual" vem da data de hoje, a menos que o
usuário indique outro mês; ao lançar com data explícita, o arquivo é o do mês daquela data.
Cabeçalho exato, nesta ordem, sempre na primeira linha:

```
data;tipo;categoria;descricao;valor;metodo
```

- `data`: AAAA-MM-DD (ex.: 2026-06-28).
- `tipo`: `despesa` ou `receita`.
- `categoria`: texto livre (veja a regra de deduplicação abaixo).
- `descricao`: texto livre.
- `valor`: número com vírgula decimal, sem separador de milhar (ex.: `1234,56`). Sempre positivo
  — o sinal vem do `tipo`. Nunca use `R$` nem ponto de milhar aqui.
- `metodo`: forma de pagamento/recebimento (pix, crédito, débito, dinheiro, transferência…).

O **saldo do mês** é receitas − despesas, calculado na leitura; nunca é persistido no livro.

Exemplo de arquivo `2026-06.csv`:

```
data;tipo;categoria;descricao;valor;metodo
2026-06-01;receita;Salário;Salário do mês;8500,00;transferência
2026-06-03;despesa;Alimentação;Compra no mercado;352,90;crédito
2026-06-05;despesa;Transporte;Gasolina;200,00;débito
2026-06-10;despesa;Moradia;Conta de luz;187,45;pix
```

### Cadastro de recorrências — `recorrencias.csv`

Um único arquivo com as contas fixas, assinaturas, parcelamentos e receitas recorrentes
(salário é uma receita fixa). Cabeçalho exato:

```
nome;tipo;categoria;descricao;valor;dia;metodo;parcelas_restantes
```

- `nome`: identificador legível e único ("Netflix", "Aluguel", "Salário", "Sofá 6x").
- `tipo`: `despesa` ou `receita`.
- `dia`: dia do mês previsto (1–31). Em mês mais curto que o `dia`, considere o último dia do mês.
- `parcelas_restantes`: **vazio** = conta fixa (repete indefinidamente); **número** = parcelamento,
  decrementado a cada abertura de mês em que a parcela é lançada. Ao chegar a 0, a linha é
  removida do cadastro (com confirmação, como toda escrita).

## Compatibilidade com o cabeçalho antigo (0.2.0)

Até a 0.2.0 o livro não tinha a coluna `tipo` (`data;categoria;descricao;valor;metodo`).
Ao abrir um CSV com o cabeçalho antigo:

- leia todas as linhas como `tipo=despesa`;
- ofereça atualizar o arquivo para o cabeçalho novo (reescrever inserindo `despesa` em cada
  linha) — **só com confirmação explícita, nunca automaticamente**.

O fallback de leitura do caminho da era `economia-domestica` também continua valendo
(seção seguinte).

## Migração do caminho antigo (fallback de leitura)

Até a versão `budget` 0.1.0 (plugin `economia-domestica`), os dados viviam no caminho legado
— campo `local_dados_legado` da mesma regra de resolução (default
`Financas/economia-domestica/budget/`; vazio desliga o fallback). Regras de compatibilidade:

- Ao **ler** (status, fechar mês, checar categorias): se o CSV do mês não existir na pasta
  resolvida mas existir no caminho legado, leia do legado e avise o usuário
  que encontrou dados no local antigo.
- Ao encontrar dados no caminho legado, **ofereça migrar**: copiar os CSVs para a pasta
  resolvida, com confirmação explícita, **sem apagar** os originais. Nunca
  migre sem perguntar.
- Ao **escrever**: sempre no caminho novo. Se o mês corrente tiver CSV apenas no caminho antigo,
  primeiro ofereça a migração daquele arquivo (para não dividir o mês em dois lugares); se o
  usuário recusar, avise que o lançamento criará um arquivo novo no caminho novo e que o resumo
  do mês passará a considerar os dois até a migração.

### Escape de campos (quando um campo de texto tiver caracteres especiais)

Campos de texto livre podem conter o próprio separador, aspas ou quebra de linha. Siga as regras
de CSV (RFC 4180), adaptadas ao separador `;`:

- Se um campo contiver `;`, `"` **ou** quebra de linha, envolva o campo INTEIRO em aspas duplas: `"…"`.
- Dentro de um campo entre aspas, cada `"` literal vira `""` (aspas dobradas).
- Não envolva em aspas campos que não precisam — mantenha o arquivo legível.
- Ao LER o CSV, respeite as mesmas regras: um `;` dentro de aspas NÃO é separador.

Exemplos:
- descrição `Mercado; feira` → grava `"Mercado; feira"`.
- descrição `Jantar "à la carte"` → grava `"Jantar ""à la carte"""`.

Dica preventiva: em `valor`, nunca acrescente separador de milhar — assim a vírgula decimal nunca
colide com o `;` e `valor` jamais precisa de aspas.

## Fluxo 1 — Lançar (despesa ou receita)

1. Entenda em linguagem natural: **tipo** (despesa ou receita — "gastei", "paguei" → despesa;
   "recebi", "caiu", "lança receita" → receita; na dúvida, assuma `despesa` e deixe o tipo visível
   na confirmação), data (padrão = hoje), categoria, descrição, valor e método. Pergunte só o que
   faltar. Aceite valores ditos como "R$ 352,90", "352,90" ou "352.90" e normalize para o formato
   cru `352,90`.
2. **Antes de escrever, cheque a categoria contra as já usadas do MESMO tipo.** Leia as categorias
   que já existem no CSV do mês atual (e, se útil, de 1–2 meses anteriores), separando categorias
   de despesa e de receita. Compare a categoria nova com as existentes do mesmo tipo ignorando
   maiúsculas/minúsculas, acentos e plural.
   - Se for parecida com uma já existente, NÃO grave ainda: sugira reaproveitar o rótulo existente
     para não fragmentar. Ex.: usuário diz "mercado", já existe "Alimentação" → "Você já usa
     **Alimentação** para esse tipo de gasto. Quer lançar como *Alimentação* em vez de *mercado*?"
   - Se for genuinamente nova, confirme o rótulo e siga com ele.
   - Nunca renomeie nem unifique categorias antigas automaticamente — só sugira.
3. **Confirme exatamente o que será gravado** antes de escrever, mostrando a linha final já
   formatada (o `tipo` incluso):
   > Vou gravar em `Financas/hestia/orcamento/2026-06.csv`:
   > `2026-06-28;despesa;Alimentação;Compra no mercado;352,90;crédito`
   > Confirma?
4. Só depois do "ok", grave (acrescente a linha no fim do arquivo) usando o conector.
5. **Se o CSV do mês não existir, crie-o primeiro com o cabeçalho**
   `data;tipo;categoria;descricao;valor;metodo` e então acrescente a linha. Avise que o arquivo do
   mês foi criado. (Antes de criar, aplique o fallback do caminho antigo: o mês pode existir lá.)
6. Confirme o sucesso e mostre o valor lançado em BRL (`R$ 352,90`).

## Fluxo 2 — Abrir o mês (recorrências em lote)

1. Leia `recorrencias.csv`. Se não existir, explique que ainda não há recorrências cadastradas e
   ofereça criar o cadastro agora (Fluxo 3).
2. Leia o livro do mês (se existir) e **cheque o que já foi lançado**: uma recorrência conta como
   lançada no mês se houver linha com o mesmo nome (na descrição) e mesmo valor. Liste
   separadamente o que já estava lançado — essas não entram no lote (abrir o mês duas vezes não
   duplica nada).
3. Monte e mostre a **lista prevista** do que falta lançar: nome, tipo, categoria, valor (BRL),
   dia previsto e, para parceladas, quantas parcelas restam ("Sofá 6x — 3 restantes").
4. Lance o lote com **uma única confirmação** ("Confirma o lançamento dessas N recorrências?").
   Cada linha entra no livro com `data` = dia previsto no mês aberto (ajustado ao último dia em
   mês curto), `descricao` = nome da recorrência e demais campos do cadastro. Se o livro do mês
   não existir, crie com o cabeçalho antes.
5. Depois do lote, **decremente `parcelas_restantes`** de cada parcelada lançada — segunda
   escrita, também confirmada, mostrando o antes/depois. Parcelada que chegar a 0: proponha
   remover a linha do cadastro na mesma confirmação.
6. Termine com um mini-status: total previsto lançado (despesas, receitas) e saldo projetado do
   mês só com as recorrências.

O usuário pode pedir para pular itens do lote ("lança tudo menos a academia") — respeite e não
decremente parcela de item pulado.

## Fluxo 3 — Gerenciar recorrências

1. Adicionar, editar, listar ou remover linhas de `recorrencias.csv`, em linguagem natural
   ("cadastra o aluguel de 2.800 todo dia 5", "a Netflix subiu pra 55,90", "acabou o
   financiamento do sofá").
2. Para escrever: mostre a linha final exata (ou o antes/depois na edição, ou a linha que sai na
   remoção) e **confirme antes**. Se `recorrencias.csv` não existir, crie com o cabeçalho na
   primeira adição (avisando).
3. Ao listar, **rode o script** e apresente em BRL o que ele devolveu — fixas e parceladas
   agrupadas, o total mensal comprometido (despesas) e o total recorrente de receitas:

   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/recorrencias.py --recorrencias <recorrencias.csv>
   ```

   Ele separa fixa de parcelada pelo contrato (`parcelas_restantes` vazio = fixa, número =
   parcelamento), soma os dois lados e traz os subtotais por grupo. Três coisas para narrar em
   vez de contornar:

   - **`parcelas_zeradas`** lista parcelamento com 0 restante ainda no cadastro. Ele **continua**
     no total, porque o total diz o que o arquivo diz hoje — some-lo calado derrubaria o
     comprometido sem o usuário pedir. Ofereça remover a linha (é escrita, então confirme).
   - **`avisos`** traz violação de contrato que não muda número nenhum: `dia` fora de 1–31, nome
     vazio, nome repetido. Os dois últimos importam além da estética — o `resumo_mes.py` e o
     `gastos.py` casam recorrência com lançamento **por nome**, e nome repetido ou vazio cega os
     dois. Aponte para o usuário corrigir.
   - **`diferenca_receitas_menos_despesas`** é o que o CADASTRO diz, não previsão do mês: o mês
     real tem gasto variável que não está ali. Para a foto do mês, é o Fluxo 4.

## As somas dos Fluxos 4 e 5 rodam em SCRIPT

**Não some o CSV de cabeça, e não converta valor para número na mão.** `resumo_mes.py` faz
receitas, despesas, saldo, taxa de poupança, quebra por categoria e top 5 — determinístico, com
`Decimal` e golden test:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/resumo_mes.py \
  --livro <AAAA-MM.csv> [--recorrencias <recorrencias.csv>]
```

O conector busca o CSV, você o materializa num arquivo temporário local, roda e **narra o JSON**.
Ele trata o cabeçalho antigo sem `tipo` (lê tudo como despesa) e **declara** que fez isso; omite
a taxa de poupança com motivo quando o mês não tem receita, em vez de devolver 0%; e **para** se
encontrar um `tipo` que não é `despesa` nem `receita`, em vez de escolher um lado.

Vale para o Fluxo 4 **e** para o Fluxo 5: os dois pedem os mesmos números do mesmo arquivo, e a
única diferença entre eles é o enquadramento da narrativa.

Até a 0.10.0 os dois fluxos traziam a receita da soma manual escrita aqui — "quebre o CSV,
troque a vírgula por ponto, some". Ela saiu porque tem dois furos que não dão sintoma: campo de
texto entre aspas com `;` dentro desloca as colunas e produz número errado com cara de certo, e
a aritmética sai em ponto flutuante, onde `0,1 + 0,2 ≠ 0,3` e a divergência de centavos não é
rastreável. O script usa o módulo `csv` e `Decimal` exatamente por causa desses dois.

## Fluxo 4 — Status do mês

1. Leia o CSV do mês atual (ou o mês que o usuário indicar), aplicando o fallback do caminho
   antigo e a compatibilidade de cabeçalho se necessário. Se não existir em lugar nenhum, diga
   que ainda não há lançamentos nesse mês e ofereça lançar a primeira despesa/receita ou abrir o
   mês.
2. **Rode o `resumo_mes.py`** (seção acima). Receitas, despesas e saldo já vêm somados em
   `Decimal`; não refaça a conta por fora para conferir — se o número estiver errado, o conserto
   é no script e no golden, nunca na narrativa.
3. Apresente em BRL o que o JSON devolveu: receitas do mês, despesas do mês, saldo, e a quebra de
   **despesas** por categoria ordenada do maior para o menor, com valor e % do total de despesas.
4. Se `recorrencias.csv` existir, mostre também o **comprometido restante**: recorrências de
   despesa ainda não lançadas no mês (mesma checagem nome+valor do Fluxo 2) e o saldo projetado
   considerando esse restante. Sem cadastro, omita a seção.
5. **Se notar categorias redundantes** acumuladas (ex.: "Mercado" e "Alimentação" coexistindo),
   sugira consolidar — mas NÃO consolide sozinho. Descreva o que mudaria e pergunte se o usuário
   quer fazer isso (e em qual rótulo).
6. Para análise histórica (evolução, médias, variações fora do padrão), indique a skill
   `analisar-gastos` — o status é a foto do mês, não a comparação entre meses.

## Fluxo 5 — Fechar o mês

1. **Operação só de leitura. Nunca apague, mova, renomeie ou sobrescreva o CSV.**
2. Leia o CSV do mês (com fallback do caminho antigo, se necessário) e **rode o `resumo_mes.py`**
   (seção acima). Ele já devolve receitas totais, despesas totais, **saldo**, **taxa de poupança**
   (saldo ÷ receitas; omitida com o motivo quando o mês não tem receita lançada — nunca divide
   por zero), total por categoria de despesa (maior → menor) e as maiores despesas individuais
   (top 5 por `valor`). O fechamento é a mesma foto do Fluxo 4, narrada como encerramento.
3. Apresente tudo em BRL. Se quiser, ofereça salvar esse fechamento num arquivo SEPARADO (ex.:
   `Financas/hestia/orcamento/2026-06-resumo.md`) — mas só com confirmação explícita, e
   jamais tocando no CSV de lançamentos.
4. Lembre que isto não é conselho de investimento: é um retrato do mês.

## Antes de confiar num arquivo existente

Ao abrir um CSV, confira o cabeçalho da primeira linha: o livro deve ser
`data;tipo;categoria;descricao;valor;metodo` (ou o cabeçalho antigo sem `tipo` — aí vale a seção
de compatibilidade) e o cadastro deve ser
`nome;tipo;categoria;descricao;valor;dia;metodo;parcelas_restantes`. Se o cabeçalho estiver
diferente disso ou o arquivo parecer inconsistente, NÃO sobrescreva às cegas: mostre o problema
ao usuário e pergunte como proceder. Leia o arquivo imediatamente antes de gravar e prefira
acrescentar (append) em vez de reescrever o arquivo inteiro, para reduzir risco de conflito com
edições feitas no Excel/Drive.

## Formatação BRL ↔ cru (referência)

| Exibir (usuário) | Gravar (CSV) |
| --- | --- |
| `R$ 1.234,56` | `1234,56` |
| `R$ 200,00` | `200,00` |
| `R$ 0,90` | `0,90` |

Nunca grave `R$` nem separador de milhar; sempre grave com vírgula decimal.
