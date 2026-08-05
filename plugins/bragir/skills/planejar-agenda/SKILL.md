---
description: "Plan the editorial calendar cycle — preenche os 12 slots (3 posts/semana em seg/qua/sex, ciclo de 4 semanas) do calendário editorial a partir das ideias e rascunhos do workspace. Use when o usuário pedir 'planejar a agenda', 'montar o ciclo', 'preencher o calendário editorial', 'plan my posting schedule'. Opera sobre um workspace editorial (calendário, rascunhos, ideias); se a estrutura não existir no cwd, PARA e avisa."
---

# Planejar Agenda

Planeja ou atualiza o ciclo do calendário editorial de um workspace de conteúdo (ex.: posts
de LinkedIn), casando slots com rascunhos prontos e ideias do funil.

## Contrato de workspace (resolução única)

Os paths se resolvem nesta ordem: (1) campos `local_agenda`, `local_rascunhos`, `local_ideias`
na seção `## Paths do workspace` do `CLAUDE.md` do repo atual; (2) campos correspondentes nos
defaults do usuário (`~/.claude/bragir/defaults.md`); (3) convenção descoberta no cwd; (4)
default documentado: `./agenda/calendario.md`, `./rascunhos/`, `./ideias/` (com `inbox.md` e
`projetos/`). Exatamente um candidato existente é usado; mais de um candidato concorrente exige
perguntar; nenhum candidato cai no default documentado. Os paths citados abaixo são
ilustrativos do default, não hardcode.

**Se o calendário resolvido não existir no cwd, PARE** e informe que o diretório atual não é um
workspace editorial — nunca crie a estrutura por conta própria (o scaffold é decisão do dono do
workspace).

Antes de mexer, leia as regras locais do workspace se existirem (`agenda/README.md`,
`AGENTS.md`/`CLAUDE.md`) — elas prevalecem sobre os defaults abaixo em caso de conflito.

## Regras do ciclo (defaults da skill)

- Cadência: **3 posts/semana (seg/qua/sex)**, ciclos de **4 semanas = 12 slots**.
- A tabela do calendário tem SEMPRE **12 linhas** de slot — não acrescente nem remova.
- **Status do slot:** `vago | agendado | publicado` (≠ status do post no frontmatter do rascunho).
- `ref (post_id)` cruza com um `post_id` real (`YYYY-MM-DD-slug`) dos rascunhos/posts do
  workspace. **Nunca invente `post_id`.**

## Passos

1. Leia o calendário, os rascunhos (post_id/tema/status) e as ideias (inbox e projetos).
2. Data de início: use o argumento do usuário (formato `AAAA-MM-DD`, deve ser uma segunda-feira).
   Se ausente, **pergunte**. Calcule as 12 datas (seg/qua/sex × 4 semanas).
3. Para cada slot proponha **tema**; havendo rascunho pronto, preencha `ref (post_id)` e marque o
   slot como `agendado`. Sem conteúdo → `vago` (tema pode ser sugerido das ideias).
4. Evite repetir o mesmo assunto em dias seguidos; equilibre formatos quando souber.
5. Mostre a tabela proposta e **peça confirmação** antes de escrever. Ao confirmar, atualize o
   calendário preservando cabeçalho, as 12 linhas e a seção de ciclos anteriores.
6. Para cada rascunho agendado, sugira mudar o `status` dele para `agendado` no frontmatter
   (escrita no rascunho só com confirmação).

Tudo em **pt-BR**.
