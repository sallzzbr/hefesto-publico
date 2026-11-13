---
name: regua-decisao
description: "Decide whether to pause, keep, scale or step back an ad set or ad with one deterministic decision tree (pausar / manter / escalar / reverter-degrau). Use when o usuário pergunta 'pauso ou mantenho', 'posso escalar', 'reverto o degrau', 'esse conjunto já tem veredito', régua de decisão, piso de gasto, janela mínima, ou quando fadiga-criativa, otimizar-verba, analise-diaria ou sintese-semanal precisam de veredito. Somente leitura."
allowed-tools: Read, Grep, Glob, Bash(node:*)
---

# Régua de Decisão

> Paths do workspace (`marketing/`, `financeiro/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.

Fonte **única** da árvore de decisão de tráfego do hermes. `fadiga-criativa`, `otimizar-verba`,
`analise-diaria` e `sintese-semanal` pedem o veredito aqui em vez de copiar a regra: regra
copiada desatualiza. A decisão é calculada por script, nunca de cabeça:

    node "${CLAUDE_PLUGIN_ROOT}/skills/regua-decisao/scripts/regua-decisao.mjs" --entrada <entrada.json>

Saída fechada: `pausar`, `manter`, `escalar` ou `reverter-degrau`, sempre com `gatilho`, `motivo`
(com os números da regra), `rotulo` e `regras_aplicadas` (a origem de cada regra aplicada:
`oficial` com `fonte`, `heurística` com o `parametro` de `config` que a governa, ou `metodologia` (decisão fixa do plugin, como a janela mínima); a `pausa` traz também o `piso_efetivo`; a lista
completa está em `${CLAUDE_PLUGIN_ROOT}/references/regras-origem.md`). **Somente leitura:** a skill
recomenda; pausar, escalar ou reverter é decisão humana, executada fora daqui.

## Entrada (uma entidade por chamada: conjunto ou anúncio)

| Campo | Obrigatório | O que é |
|---|---|---|
| `moeda` | sim | código de 3 letras da moeda do perfil do negócio (ex.: `BRL`, `EUR`); pisos e motivos usam essa moeda, sem moeda padrão |
| `janela_dias` | sim | dias da janela avaliada em que a entidade veiculou, todos depois da última edição significativa |
| `gasto` | sim | gasto acumulado na janela, na `moeda` |
| `conversoes` | sim | conversões na janela |
| `receita` ou `roas` | não | `roas` explícito vence a receita; sem os dois, ROAS desconhecido |
| `numeros` | não | origem de gasto, conversões e receita: `plataforma` (padrão, atribuição da plataforma de anúncios) ou `ledger`; muda o rótulo do lucro |
| `dias_desde_ultima_edicao` | sim | dias desde a última edição significativa; a criação conta como edição |
| `dias_desde_ultimo_degrau` | não | dias desde o último aumento de verba ainda não revertido; ausente = sem degrau |
| `eventos_otimizacao` | não | eventos de otimização na janela |
| `reguas` | sim | `fonte`, `cac_breakeven`, `cac_alvo`, `roas_breakeven` e, se houver, `roas_alvo` |
| `config` | sim | os parâmetros de heurística da tabela abaixo, vindos do perfil do negócio; heurística ausente é recusada (exit 1, chave citada), o script não guarda valor |

**De onde vêm os dias.** Edição significativa e aumento de verba saem do log de atividade da
conta (ou do registry do workspace, quando ele registra as mudanças). Entidade nova: a criação
conta como edição, então um conjunto criado há 3 dias entra com `dias_desde_ultima_edicao` 3 e
fica em aprendizado. Depois de reverter um degrau, o aumento foi desfeito: a próxima chamada vai
sem `dias_desde_ultimo_degrau` (ou com o aumento anterior, se ainda houver um em avaliação), e
a reversão conta como edição significativa: `dias_desde_ultima_edicao` passa a contar dela, para
a janela seguinte não julgar a verba que acabou de ser revertida.

**Réguas por lookup.** CAC e ROAS vêm do relatório `unit-economics` mais recente do workspace
(`financeiro/relatorios/unit-economics-*.md`, path ilustrativo), com o arquivo citado em
`reguas.fonte`. Sem relatório, rode `hermes:unit-economics` antes: régua decorada não entra, e o
script recusa entrada sem fonte. Campo desconhecido (na entrada, em `reguas` ou em `config`) ou
valor fora do tipo também é recusado (exit 1, campo citado), para erro de digitação não virar
decisão; réguas incoerentes também: CAC alvo acima do CAC breakeven, ROAS alvo abaixo do ROAS
breakeven, ou ROAS breakeven abaixo de 1 (margem acima da receita), saem com exit 1.

**Comparação em centavos.** Dinheiro (gasto, CPA, réguas e pisos) é comparado em centavos e ROAS
em centésimos: a régua decide com exatamente o número que o motivo mostra. CPA igual ao CAC
breakeven não está acima dele, nem o ROAS igual ao breakeven abaixo, por mais que a divisão em
ponto flutuante dê 30,490000000000002.

## Campos de régua de decisão (parâmetros do perfil)

Heurística é parâmetro do perfil do negócio, não constante do script. A skill resolve cada campo
(seção `## Réguas de decisão` do CLAUDE.md do workspace; `~/.claude/hermes/defaults.md`; o arquivo de perfil validado pelo `verificar_workspace.py` guarda só a identidade do negócio, não as heurísticas),
injeta em `config` e a saída devolve a config efetiva. Sem valor resolvido para uma heurística,
a skill pergunta ao usuário: não há padrão silencioso. Os valores da coluna Referência
reproduzem as constantes das versões anteriores e são só ponto de partida, na moeda do perfil.
Janela mínima e aprendizado têm default no script (não são heurística de mercado).

| Campo | Referência | Papel | Origem da regra |
|---|---|---|---|
| `piso_diagnostico` | 50 | piso de diagnóstico: abaixo, "dados insuficientes" | heurística |
| `piso_opiniao_fadiga` | 100 | piso de opinião de fadiga: abaixo, a fadiga não opina | heurística |
| `piso_veredito_pausa` | 200 (faixa 200 a 250) | piso de veredito de pausa: gasto mínimo para `pausar`; o efetivo nunca fica abaixo de um CAC breakeven | heurística |
| `janela_minima_veredito_dias` | 7 (não aceita menos) | janela mínima de veredito | metodologia |
| `dias_minimos_desde_edicao` | 7 | edição significativa recente = em aprendizado | oficial (aprendizado) |
| `eventos_minimos_aprendizado` | desligado | se configurado, eventos abaixo = em aprendizado | oficial (o uso como guarda é opcional) |
| `conversoes_minimas_escala` | 10 | conversões mínimas para `escalar` | heurística |
| `intervalo_minimo_degrau_dias` | 7 (aceita 3 a 7) | dias desde o último degrau para novo `escalar` | heurística |
| `lucro_por_real_referencia_min` | 0,70 | início da faixa de referência de lucro operacional por real investido | heurística |
| `lucro_por_real_referencia_max` | 1,50 | fim da mesma faixa (informa, não decide) | heurística |

**Aprendizado em conta pequena.** A plataforma de referência documenta cerca de 50 eventos de
otimização em 7 dias, depois da última edição significativa, para um conjunto sair do
aprendizado. Conta com poucas compras por semana nunca chega lá, e usar esse número como guarda
fazia as skills nunca opinarem. Por isso o limiar de eventos é opcional
(`eventos_minimos_aprendizado`, desligado por padrão) e o fallback é
**7 dias desde a última edição significativa + piso de gasto**: o status de aprendizado
limitado da plataforma não impede veredito.

## Árvore (a primeira condição que casa decide)

1. Edição significativa há menos de `dias_minimos_desde_edicao` → `manter` (`aprendizado-edicao`).
2. `eventos_minimos_aprendizado` configurado e eventos abaixo dele, ou não informados → `manter` (`aprendizado-eventos`).
3. Janela abaixo da janela mínima de veredito (7 dias) → `manter` (`janela-minima`).
4. Janela que começa antes da última edição significativa, ou antes do último degrau (em
   avaliação ou consolidado) mais do que a janela mínima obriga → `manter` (`janela-mista`):
   qualquer veredito (pausar, escalar, reverter ou manter) julgaria a configuração antiga. Refaça
   só com os dias depois da edição ou do degrau; com degrau mais recente que a janela mínima, com a
   janela mínima mais recente.
5. Gasto abaixo do piso de diagnóstico → `manter` (`piso-diagnostico`): dados insuficientes.
6. Desempenho ruim (0 conversões com gasto, ou CPA acima do CAC breakeven) com ROAS abaixo do breakeven ou desconhecido:
   - degrau em avaliação (há menos de `janela_minima_veredito_dias + 7` dias; 14 no padrão):
     - sem uma janela mínima inteira depois dele (7 dias no padrão) → `manter` (`degrau-recente`);
     - 0 conversões com gasto abaixo de um CAC breakeven → `manter` (`piso-reversao`);
     - senão → `reverter-degrau`;
   - sem degrau, ou degrau consolidado (`janela_minima_veredito_dias + 7` dias ou mais), e gasto no piso de veredito de pausa ou acima → `pausar` (`pausa`);
   - sem degrau, ou degrau consolidado, e gasto abaixo do piso → `manter` (`piso-pausa`).
7. Sinais divergentes, nos dois sentidos → `manter` (`sinais-divergentes`): CPA acima do CAC
   breakeven com ROAS no breakeven ou acima, ou CPA no breakeven ou abaixo com ROAS abaixo do breakeven.
8. CPA no CAC alvo ou abaixo, com ROAS na régua (`roas_alvo`, senão o breakeven) ou desconhecido:
   - menos conversões que `conversoes_minimas_escala` → `manter` (`escala-sem-sinal`);
   - último degrau mais recente que `intervalo_minimo_degrau_dias` → `manter` (`intervalo-degrau`);
   - senão → `escalar` (`escala`): um degrau; o tamanho do degrau é da `hermes:otimizar-verba`.
9. Senão → `manter` (`dentro-da-regua`), com o motivo dizendo a relação verdadeira (CPA entre o
   alvo e o breakeven, ou CPA no alvo com ROAS abaixo do ROAS alvo).

**Reverter degrau** só com pelo menos 7 dias após o degrau (ou a janela mínima configurada, se
maior), a janela inteira depois dele e CPA acima do breakeven; sem conversão, só com gasto de
pelo menos um CAC breakeven (abaixo disso nem uma venda é esperada ainda). A reversão vale para o
degrau em avaliação: com `janela_minima_veredito_dias + 7` dias ou mais (14 dias no padrão) o
degrau está consolidado, e desempenho ruim segue a regra de pausa, com o piso. Sem esse teto,
conjunto que já subiu de verba nunca recebia pausar, só reverter, de novo a cada rodada. O
intervalo de escala configurado não antecipa a reversão; com degrau mais recente que a janela
mínima, a escala ainda olha a janela que o inclui (o intervalo é heurística de mercado).

## Lucro do período (informa, não decide)

Além de CPA e ROAS, a saída traz `lucro`: o **lucro do período** (lucro operacional = margem de
contribuição da receita menos o gasto, sem custo fixo, que é do mês e não da campanha) e o
**lucro por real investido**. A margem vem da régua do unit-economics: ROAS da janela × gasto ÷
ROAS breakeven, com o mesmo ROAS em centésimos que decidiu (pela receita ou o `roas`
explícito); com receita e sem gasto, receita ÷ ROAS breakeven; sem receita nem ROAS, conversões
× CAC breakeven, a margem de contribuição por pedido (`lucro.base` diz qual das três).

Retorno menor por real pode dar lucro total maior: a skill chamadora mostra os dois antes de
recomendar, e o lucro não muda a árvore. Com números da plataforma de anúncios (o padrão,
`numeros: plataforma`), o lucro sai como lucro de plataforma: não é lucro de ledger, e o
relatório cita o fator ledger ÷ plataforma do `pnl-mensal`, como manda a regra de CPA de
plataforma; com `numeros: ledger`, sai como lucro operacional. A faixa de referência de lucro
operacional por real investido é heurística, parâmetro do perfil (referência 0,70 a 1,50)
(`lucro_por_real_referencia_min` e `lucro_por_real_referencia_max`); `lucro.leitura` diz se o
período ficou abaixo, dentro ou acima dela, e prejuízo sai com essa palavra.

## Heurística avaliada e rejeitada

"Pausar com gasto abaixo de um CAC breakeven em 3 dias" foi avaliada e **rejeitada** por dois
motivos: mata o anúncio antes da primeira venda esperada (com gasto abaixo de um CAC breakeven,
nem uma venda é esperada ainda) e, no histórico de conta, vereditos tomados em janela curta
precisaram ser revertidos depois. Por isso a janela mínima não aceita menos de 7 dias e o piso de pausa
efetivo nunca fica abaixo de um CAC breakeven, mesmo que o workspace configure valor menor.

## Saída e uso pelas outras skills

- `decisao`, `gatilho`, `motivo`, `rotulo`: entram inteiros no relatório da skill chamadora.
- `lucro` (`texto`, com o lucro do período e o lucro por real investido): entra ao lado do
  veredito, antes de qualquer recomendação.
- `metricas` (gasto, conversões, CPA, ROAS), `reguas` (eco, com a fonte) e `config` efetiva.
- `pisos_atingidos` (`diagnostico`, `opiniao_fadiga`, `veredito_pausa`) e
  `piso_veredito_pausa_efetivo`: as skills consumidoras usam esses valores em vez de recomparar o
  gasto com número próprio.
- Uma chamada por entidade; a skill chamadora monta a entrada com a janela que ela avalia.

## Regras

- Somente leitura na plataforma; a decisão é do humano.
- Sempre a régua ao lado do número; réguas por lookup, nunca de memória.
- Quase todo conselho de tráfego é heurística de mercado, não regra de plataforma: o rótulo de
  cada gatilho vem na saída e aparece no relatório.
- Português BR; valores na moeda do perfil.
