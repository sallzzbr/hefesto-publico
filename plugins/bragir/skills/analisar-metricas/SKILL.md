---
description: "Analyze editorial post metrics — lê o CSV de métricas do workspace (impressões, reações, comentários, engajamento), ranqueia posts, aponta padrões de tema/formato/gancho e gera relatório datado; propõe aprendizados para o perfil de voz. Use when o usuário pedir 'analisar métricas', 'como foram os posts', 'relatório de métricas', 'post performance'. Só leitura no CSV; se a estrutura não existir no cwd, PARA e avisa."
---

# Analisar Métricas

Analisa o desempenho dos posts de um workspace editorial e produz um relatório datado, com
aprendizados propostos de volta para o perfil de voz.

## Contrato de workspace (resolução única)

Os paths se resolvem nesta ordem: (1) campos `local_metricas` e `local_voz` na seção
`## Paths do workspace` do `CLAUDE.md` do repo atual; (2) campos correspondentes nos defaults
do usuário (`~/.claude/bragir/defaults.md`); (3) convenção descoberta no cwd; (4) default
documentado: `./metricas/metricas.csv`, relatórios em `./metricas/analises/`, template em
`./templates/relatorio-metricas.md` e perfil em `./voz/perfil-de-voz.md`. Exatamente um
candidato existente é usado; mais de um candidato concorrente exige perguntar; nenhum candidato
cai no default documentado. Os paths citados abaixo são ilustrativos do default, não hardcode.

**Se o CSV de métricas resolvido não existir no cwd, PARE** e informe que o diretório atual não
é um workspace editorial — nunca crie a estrutura por conta própria.

Antes de analisar, leia as regras locais do workspace se existirem (`metricas/README.md`,
`AGENTS.md`/`CLAUDE.md`). Elas podem acrescentar colunas e regras, mas não remover o cabeçalho
mínimo abaixo.

## Cabeçalho mínimo

O CSV precisa conter estas 11 colunas, em qualquer ordem:

`post_id,titulo,data_publicacao,impressoes,reacoes,comentarios,compartilhamentos,cliques,novos_seguidores,taxa_engajamento,observacoes`

Colunas extras são preservadas e podem enriquecer a análise. Se faltar qualquer coluna
obrigatória, **PARE antes de calcular** e liste os nomes ausentes; não trate célula vazia como
coluna ausente e não invente valores.

## Regras

- O cabeçalho mínimo acima é o contrato compartilhado; o cabeçalho efetivo do workspace é a
  fonte de verdade apenas para extensões. Células vazias são permitidas e tratadas com
  elegância.
- `taxa_engajamento` = `(reacoes + comentarios + compartilhamentos) ÷ impressoes × 100`, número
  (ex.: `2.5`). Datas `AAAA-MM-DD`.
- **Não edite o CSV de métricas** (entrada manual do dono) — apenas leia. As únicas escritas da
  skill são o relatório novo e, com confirmação, os aprendizados no perfil de voz.

## Passos

1. Leia o CSV e valide o cabeçalho mínimo. Se só houver o cabeçalho, avise que ainda não há
   dados e pare.
2. Por linha: valide/recalcule `taxa_engajamento` a partir das colunas cruas; aponte
   divergências.
3. Ranqueie por `taxa_engajamento` (desempate por impressões e novos seguidores). Identifique
   **melhor**/**pior** post e padrões (tema/formato/gancho) recorrentes nos melhores.
4. Período: use o argumento do usuário como rótulo; senão pergunte ou use o intervalo de datas
   dos dados.
5. Gere o relatório `AAAA-MM-DD-<rotulo>.md` no diretório de análises, a partir do template do
   workspace (sem template, use uma estrutura simples: período, ranking, padrões, destaques).
   Mostre e **peça confirmação** antes de escrever.
6. Proponha 1–3 entradas (com data) para a seção "Aprendizados das métricas" do perfil de voz
   resolvido. Só atualize o perfil após confirmação.

Tudo em **pt-BR**.
