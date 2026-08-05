---
description: Use quando o usuário quiser registrar um aporte/resgate/provento, atualizar a carteira de investimentos com um print da corretora, cadastrar/encerrar ativos, ou criar/editar metas de investimento ("quero juntar 30 mil até 2027"). Os dados ficam na pasta de investimentos do hestia no Google Drive (configurável por workspace/defaults). Para análise, proventos, evolução e simulações, use a skill analisar-investimentos.
---

# Investimentos — Carteira, Movimentos e Metas

Esta skill ensina como registrar a vida de investidor em CSVs no Google Drive: a carteira (estado
atual), os movimentos (aportes, resgates, proventos), a série histórica de saldos (snapshots) e
as metas declaradas pelo usuário. Esta skill é só INSTRUÇÃO: quem acessa o Drive é o conector.

## Guardrail de investimentos (leia primeiro)

Nas skills de investimento do hestia, a IA **educa** (CDI, IR, liquidez, marcação a mercado),
**registra**, **calcula** e **simula**. Opinião só existe **sob pedido explícito** do usuário
("o que você faria?") e **somente sobre alocação entre classes** (% renda fixa × variável), sempre
acompanhada do disclaimer: **não é assessoria; a decisão é sua**. É PROIBIDO, mesmo se pedido:

- recomendar ativo, papel, fundo ou corretora específicos;
- dizer "compre" ou "venda";
- prever mercado, taxa ou preço futuro como fato.

## Regras invioláveis

1. **Dados no Google Drive**, na pasta resolvida (ver "Onde ficam os dados"; caminho, nunca ID).
   Conector indisponível → PARE e peça para conectar; nunca invente dados.
2. **Confirme antes de QUALQUER escrita**, mostrando exatamente o que será gravado.
3. **Exibir em BRL, gravar no formato cru** (`R$ 8.500,00` na tela; `8500,00` no CSV).
4. **Extração de print nunca inventa.** Campo ilegível → pergunte.

## Onde ficam os dados

Subpasta `investimentos/` da pasta-base do hestia, resolvida pela regra única de
`${CLAUDE_PLUGIN_ROOT}/skills/orcamento/references/defaults.md` (workspace → defaults do
usuário → default `Financas/hestia/`); os paths citados nos exemplos são ilustrativos do
default, não hardcode. CSVs com separador `;`, vírgula decimal e escape RFC 4180
adaptado (padrão do plugin).

### Carteira (estado atual) — `carteira.csv`

```
ativo;classe;instituicao;indexador;vencimento;quantidade;saldo;atualizado_em
```

- `ativo`: nome legível único ("CDB Banco X 102% CDI", "IVVB11", "Fundo Y Prev").
- `classe`: `renda-fixa` | `bolsa` | `fundo`.
- `indexador`: renda fixa ("102% CDI", "IPCA+6,1", "pré 11,5"); vazio nas demais.
- `vencimento`: AAAA-MM-DD quando houver prazo; vazio nas demais.
- `quantidade`: cotas/ações (bolsa); vazio nas demais.
- `saldo`: valor atual da posição (cru). `atualizado_em`: data da última atualização.

Uma linha por ativo; atualizar = reescrever a linha (confirmado).

### Movimentos — `movimentos.csv` (append-only)

```
data;ativo;operacao;valor;quantidade;observacao
```

`operacao`: `aporte` | `resgate` | `provento` (dividendos, JCP, cupons, rendimento de FII).
`quantidade` preenchida em compra/venda de bolsa.

### Snapshots — `snapshots.csv` (append-only)

```
data;ativo;saldo
```

Toda atualização de posição grava um snapshot junto — é a série histórica que permite ver
evolução e separar aporte de rendimento na análise.

### Metas — `metas.csv`

```
meta;valor_alvo;data_alvo;aporte_mensal_planejado;criada_em;observacao
```

Meta é do usuário, sobre patrimônio/valor nomeado ("Reserva de emergência", "Entrada do apê") —
**nunca vinculada a ativo específico** (guardrail).

Exemplo:

```
meta;valor_alvo;data_alvo;aporte_mensal_planejado;criada_em;observacao
Reserva de emergência;30000,00;2027-06-30;800,00;2026-07-23;6 meses de despesas
```

## Fluxo 1 — Registrar movimento (aporte, resgate, provento)

1. Entenda por ditado ("aportei 2.000 no CDB do Banco X", "caiu 87,50 de dividendo do IVVB11")
   ou por print da corretora. Campos: data (padrão hoje), ativo (case com a carteira; ativo
   desconhecido → proponha cadastrar antes), operação, valor, quantidade (bolsa).
2. Mostre a linha final e **confirme** antes de gravar em `movimentos.csv` (crie com cabeçalho se
   não existir, avisando).
3. **Aporte → oferta de lançamento no orçamento** (opcional): ofereça lançar no livro
   (`Financas/hestia/orcamento/AAAA-MM.csv`, contrato da skill `orcamento`) como despesa na
   categoria `Investimentos`, descrição "Aporte — <ativo>". Explique que é transferência para o
   próprio patrimônio (sai do caixa do mês, não é gasto perdido). Cheque duplicação pela
   descrição no mês. O usuário pode recusar sem afetar o registro do movimento.
4. Resgate: ofereça o espelho (receita na categoria `Investimentos` no livro), mesma lógica.

## Fluxo 2 — Atualizar posições (print da corretora)

1. Receba print/PDF do app da corretora (ou ditado dos saldos). Extraia ativo → saldo atual
   (e quantidade, para bolsa). Ilegível → pergunte.
2. **O casamento e as variações saem de SCRIPT.** Materialize o que você leu do print num CSV
   `ativo;saldo[;quantidade]` e rode:

   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/posicoes.py \
     --carteira <carteira.csv> --print <lidas.csv> --data <AAAA-MM-DD do print>
   ```

   **Não calcule a variação de cabeça.** Isto é uma tela de confirmação de **escrita**: um
   percentual errado aqui é um update ruim aprovado com número bonito, e o `snapshots.csv` que
   sai daqui é a série que `analisar-investimentos` usa para separar aporte de rendimento. O
   script devolve os três casos que este passo pede, já resolvidos:

   - **`atualizadas`** — antes/depois com a variação em BRL e %, o percentual sempre sobre o
     saldo **anterior**. Saldo anterior R$ 0,00 devolve `variacao_pct: null` com motivo: 0%
     afirmaria "não mudou" sobre uma posição que saiu do zero.
   - **`novos_no_print`** → proponha cadastrar (`falta_cadastrar` nomeia os campos que o print
     não tem: classe, instituição, indexador/vencimento). Ele **não** entra na
     `carteira_proposta`, porque montar a linha com `classe` chutada gravaria dado inventado.
   - **`ausentes_do_print`** → pergunte o que houve (resgatou? venceu? só não aparece nesse
     print?). **NUNCA remova sozinho**: o script mantém a linha na `carteira_proposta` com o
     saldo E a data antigos, e **sem snapshot** — avançar a data afirmaria que a posição foi
     conferida neste print, e um snapshot com saldo velho na data de hoje faria a análise de
     rendimento reportar "estável" onde a verdade é "não sei".
   - **`quantidade_mudou: true`** → diga isso ao narrar. Com a quantidade mudando, a variação de
     saldo mistura aporte com rendimento, e separar os dois é `analisar-investimentos`.
   - **`patrimonio_depois`** inclui as posições ausentes pelo saldo antigo, ou seja, mistura
     conferido com não conferido. Para o número limpo do que de fato mexeu, use
     `variacao_das_posicoes_confirmadas`.

   Os valores saem com **ponto** decimal (padrão do JSON no hestia). Ao gravar no CSV, converta
   para vírgula — planilha em pt-BR lê `3000.00` como três mil unidades de milhar.
3. Com **uma confirmação**: reescreva as linhas de `carteira.csv` (com `atualizado_em` = data do
   print) e apenda uma linha por ativo em `snapshots.csv` (mesma data). Arquivos ausentes →
   crie com cabeçalho, avisando.

## Fluxo 3 — Gerenciar carteira (ativos)

1. Adicionar ativo (cadastro completo), editar campos (instituição, indexador, vencimento),
   encerrar ativo (resgatou tudo / venceu).
2. **Encerrar mantém o histórico**: remove a linha de `carteira.csv` (confirmado), mas
   `movimentos.csv` e `snapshots.csv` ficam intactos — a análise ainda enxerga o passado.
3. Toda escrita mostra antes/depois e confirma.

## Fluxo 4 — Gerenciar metas

1. Criar: nome, valor alvo, data alvo, observação. Ao criar, **ofereça planejar o aporte**: a
   simulação da skill `analisar-investimentos` calcula o aporte mensal necessário em 3 cenários;
   o valor que o usuário escolher entra como `aporte_mensal_planejado`.
2. Editar (alvo, prazo, aporte planejado) e concluir/abandonar meta (remover linha, confirmado —
   ofereça registrar a conclusão na `observacao` de um relatório antes, se o usuário quiser).
3. Toda escrita mostra a linha final (ou antes/depois) e confirma.
4. O acompanhamento (progresso, ritmo, projeção de chegada) é da skill `analisar-investimentos` —
   aponte `/hestia:investimentos`.

## Formatação BRL ↔ cru (referência)

| Exibir (usuário) | Gravar (CSV) |
| --- | --- |
| `R$ 8.500,00` | `8500,00` |
| `R$ 87,50` | `87,50` |
