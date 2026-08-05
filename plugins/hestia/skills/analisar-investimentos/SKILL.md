---
description: Use quando o usuário quiser entender ou projetar os investimentos — "como estão meus investimentos", "meus proventos/dividendos", "quanto rendeu", evolução do patrimônio, "estou no ritmo da meta?", "simula quanto preciso aportar", projeções de juros compostos por objetivo. Análise e simulação 100% de leitura sobre a pasta de investimentos do hestia no Google Drive (configurável por workspace/defaults); para registrar movimentos, posições e metas, use a skill investimentos.
---

# Analisar Investimentos

Esta skill lê a carteira, os movimentos, os snapshots e as metas, e devolve **pensamento com
números**: onde o patrimônio está, quanto veio de aporte vs rendimento, se as metas estão no
ritmo, e o que as projeções dizem — sempre com premissas explícitas.

## Guardrail de investimentos (leia primeiro)

A IA **educa**, **calcula** e **simula**. Opinião só **sob pedido explícito** do usuário
("o que você faria?") e **somente sobre alocação entre classes** (% renda fixa × variável),
sempre com o disclaimer: **não é assessoria; a decisão é sua**. É PROIBIDO, mesmo se pedido:

- recomendar ativo, papel, fundo ou corretora específicos;
- dizer "compre" ou "venda";
- prever mercado, taxa ou preço futuro como fato (premissa de simulação é hipótese declarada,
  nunca previsão).

## Regras invioláveis

1. **100% leitura.** Única escrita possível: salvar relatório em arquivo SEPARADO (ex.:
   `Financas/hestia/investimentos/analise-2026-07.md`), com confirmação. Atualizar o
   `aporte_mensal_planejado` de uma meta é escrita da skill `investimentos` — delegue.
2. **Dados via conector do Drive**, pela subpasta `investimentos/` da pasta-base resolvida
   (regra única em `${CLAUDE_PLUGIN_ROOT}/skills/orcamento/references/defaults.md`: workspace →
   defaults do usuário → default `Financas/hestia/`; caminho, nunca ID — exemplos citam o
   default ilustrativamente). Indisponível → PARE e peça para conectar; nunca invente números.
3. **Números na frente das frases**, em BRL, com período e base explícitos.

## Os cálculos rodam em SCRIPT, não de cabeça

**Nunca calcule rendimento, meta ou projeção mentalmente.** Até 2026-07-28 estas contas eram
feitas pelo modelo lendo esta prosa, e duas execuções da mesma pergunta podiam divergir sem
nada perceber. Agora existem scripts determinísticos, com `Decimal` e golden tests:

```bash
# rendimento separado de aporte, proventos e yield
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/rendimento.py \
  --snapshots <snapshots.csv> --movimentos <movimentos.csv> [--inicio AAAA-MM-DD] [--fim AAAA-MM-DD]

# acompanhamento de meta: progresso, ritmo, projeção de chegada, aporte que corrige
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/meta.py \
  --metas <metas.csv> --acumulado "<nome da meta>=<valor>" [--movimentos <movimentos.csv>]

# simulação: projeção ou objetivo, sempre 3 cenários com as taxas que o usuário aceitou
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/juros_compostos.py projecao \
  --inicial <v> --aporte <v> --meses <n> --taxas 8,10,12
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/juros_compostos.py objetivo \
  --inicial <v> --alvo <v> --meses <n> --taxas 8,10,12
```

Como usar: o conector do Drive busca os CSVs, você os materializa em arquivo temporário local,
roda o script e **narra o JSON de saída**. Os scripts não acessam o Drive nem a rede — a regra
de que a skill não lê arquivo sozinha continua valendo, e é o que os mantém testáveis.

### Tributação: o script sabe, ou recusa

Onde entra o quê — a regra que vale para todo cálculo do hestia:

| | |
|---|---|
| **valor** (taxa esperada, CDI de hoje, IPCA projetado) | entra na chamada, e aparece declarado na saída |
| **regra** (como o IR escalona, IOF antes de IR) | vive em `scripts/ir.py` |
| **tabela que muda por lei** (as alíquotas) | vive em `tabelas/*.json`, versionada |

Alíquota **nunca** chega por parâmetro. Se você informasse "o IR aqui é 15%", a conta teria
voltado para a sua cabeça — e alíquota errada produz número plausível, que ninguém contesta.

`--tributacao` trata **IR e IOF como eixos separados**, porque são impostos diferentes:
`cdb`/`tesouro`/`renda-fixa`/`lc` pagam IR regressivo e IOF regressivo; `lci`/`lca`/`cri`/`cra`/
`debenture-incentivada` são isentos de **IR** (não de IOF); `poupanca` é isenta dos dois.

**Dentro dos primeiros 30 dias, os regimes isentos de IR são RECUSADOS**: a incidência de IOF
neles nessa janela não está modelada com confiança, e chutar daria número exato e errado. Acima
de 30 dias o IOF é zero para todos e o cálculo é seguro. Se o usuário perguntar por resgate em
menos de 30 dias numa LCI, diga que a conta não é confiável ali — não estime.

**Recusa, com exit 1**, três casos — e a recusa é o comportamento certo:
`fundo` (come-cotas depende do histórico de antecipações, que não está na entrada), `acoes`
(a isenção de R$ 20 mil depende do total vendido no mês) e `fii` (regra própria). Quando o
script recusar, **diga ao usuário o que faltaria**; não estime por fora.

**`--tributacao` só existe no modo `projecao`.** No modo `objetivo` ele é **recusado com
exit 1**, e de propósito: o aporte calculado leva ao alvo BRUTO, e chegar ao alvo LÍQUIDO
exigiria saber a data do resgate para envelhecer cada aporte. Aceitar e ignorar seria pior.
Fluxo certo: rode `objetivo` sem o flag e confira o líquido depois com `projecao --tributacao`.

**Sem `--tributacao`, o resultado vem rotulado `montante_final_bruto` e com
`montante_final_liquido: null` mais um aviso.** Narre o aviso. Para CDB, Tesouro ou debênture,
o valor que a pessoa recebe é menor que o bruto, e omitir isso é o erro mais caro possível aqui.

Três coisas que eles fazem e que você não deve desfazer na narração:

- **Recusam calcular sem base.** Ativo com menos de 2 snapshots vai para `sem_base_de_calculo`
  e meta sem 3+ meses de movimento devolve `ritmo_mensal: null` com o motivo. Diga o motivo ao
  usuário; não preencha o buraco com estimativa.
- **`meta.py` exige `--acumulado` por meta.** Metas são potes distintos; reaproveitar o valor
  de uma na outra produziria progresso falso, e por isso o script para em vez de adivinhar.
- **`juros_compostos.py` não tem taxa default.** Premissa é decisão do usuário — proponha,
  espere o ok e só então rode. Taxa embutida seria a IA prevendo mercado, o que o guardrail
  proíbe.

## Base de leitura

Contratos definidos na skill `investimentos`: `carteira.csv` (estado atual), `movimentos.csv`
(aportes/resgates/proventos), `snapshots.csv` (série histórica de saldos), `metas.csv`.

Degradação com aviso (padrão da casa):
- evolução/rendimento de um ativo pede **2+ snapshots** dele;
- ritmo de meta pede **3+ meses** de movimentos — antes disso, mostre só o progresso simples e
  diga que o ritmo ainda não é confiável;
- carteira vazia → explique e aponte `/hestia:carteira` para começar.

Rendimento de um período = (saldo final − saldo inicial, via snapshots) − aportes + resgates do
período. Diga sempre o período usado.

## Saídas

### 1. Visão da carteira (`/hestia:investimentos`)

Total atual, alocação por `classe` com % e valores, por instituição, vencimentos próximos da
renda fixa (próximos 12 meses), proventos acumulados no ano e a data da última atualização de
cada posição (aponte posições desatualizadas há 60+ dias).

### 2. Proventos & rendimento (extrato dedicado)

Acessível direto ("mostra só meus proventos do semestre"):
- proventos por ativo e por mês, acumulado do período, yield sobre o valor investido;
- rendimento separado de aporte, com a frase-modelo: "teu patrimônio subiu **R$ 12.400** no
  trimestre: **R$ 9.000** de aportes + **R$ 3.400** de rendimento (~3,1% no período)".

### 3. Evolução

Patrimônio ao longo dos snapshots, total e por classe; marcos (maior aporte, melhor período).

### 4. Metas (acompanhamento)

Para cada meta de `metas.csv`:
- **progresso**: "R$ 18.400 de R$ 30.000 — 61%";
- **ritmo real** (aportes + rendimento dos últimos 3 meses) vs `aporte_mensal_planejado`;
- **projeção honesta de chegada**: "no ritmo atual você chega em set/2027, 3 meses depois do
  alvo — para voltar ao prazo, o aporte precisa ir de R$ 800 para R$ 1.050".

Descrever + mostrar a conta; a decisão de ajustar é do usuário. Se ele decidir mudar o aporte
planejado, delegue a escrita à skill `investimentos`.

### 5. Simular (`/hestia:simular`)

Dois sentidos:
- **Projeção**: "aportando R$ X/mês a Y% a.a., em Z anos → R$ W".
- **Objetivo**: "para chegar em R$ W até <data>, o aporte precisa ser R$ X/mês".

Regras da simulação:
- **Sempre 3 cenários** — conservador / base / otimista — com as taxas MOSTRADAS e justificadas
  como hipóteses (ex.: ancoradas em CDI atual, IPCA+ histórico); nunca como previsão.
- Juros compostos com aportes mensais; considerar o patrimônio inicial quando a simulação parte
  da carteira ou de uma meta existente.
- Pode ancorar numa meta de `metas.csv` (usa alvo, prazo e progresso atuais) — e ao final
  oferecer atualizar o `aporte_mensal_planejado` (escrita delegada à skill `investimentos`).
- **Sem premissa aceita pelo usuário, não simule** — proponha as taxas e espere o ok; nunca
  calcule com número inventado silenciosamente.
- Feche sempre com: rentabilidade passada não garante rentabilidade futura; simulação é
  hipótese, não promessa.

### 6. Educar

Conceitos explicados no contexto da carteira real: IR regressivo pela idade de cada aporte,
bruto × líquido, liquidez × vencimento, marcação a mercado, o que é "102% CDI" em termos de
rendimento corrente. Educação usa os números do usuário, não genéricos.

### 7. Opinião sob pedido

Só quando o usuário perguntar explicitamente ("o que você acha?", "o que você faria?"):
comente a **alocação entre classes** com os números da carteira ("hoje você está 78% em renda
fixa e 22% em bolsa; concentração de 40% num único emissor é o ponto que mais chama atenção") e
feche com o disclaimer: **isto não é assessoria de investimento; a decisão é sua**. Dentro dos
limites do guardrail — nunca ativo específico, nunca compre/venda.

## Fecho padrão

Toda análise termina com 2–3 frases de observação (não ordem), e o lembrete curto de que nada
aqui é recomendação de ativo.
