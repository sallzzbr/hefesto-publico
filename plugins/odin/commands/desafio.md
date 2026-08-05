---
description: Rotear para a fase certa do double diamond do desafio (missão)
argument-hint: <desafio novo, problema, ou slug de desafio existente>
---

# /desafio

Pedido inicial: $ARGUMENTS

Antes de listar, resolva `dirDesafios` pela regra única de
`skills/descobrir/references/capa-template.md`: `CLAUDE.md` do workspace → defaults do usuário
com `local_desafios` → convenção descoberta no cwd → default documentado. Os paths literais
abaixo são ilustrativos do default, não hardcode.

1. Liste `<dirDesafios>/*/desafio.md` no projeto atual. Se a convenção legada
   `docs/missoes/` existir, detecte e ofereça migrar para `<dirDesafios>/`
   (mv do diretório + renomear `missao.md` → `desafio.md` em cada um, com OK do dono).
2. **Escolher o desafio:** o pedido cita um, ou só há um ativo → use-o. **Dois ou mais ativos
   sem citação → pergunte qual** (1 questão curta com a lista) — nunca assuma nem crie um novo
   nesse caso.
3. **Pedido que não é desafio:** entrega avulsa, bug pontual ou tarefa sem relação com os
   desafios listados → roteie direto pra skill `entregar` (o Step 0.5 dela decide se desafia);
   não crie capa pra tarefa avulsa.
4. Com o desafio escolhido: leia a capa e apresente a **jornada de 5 etapas** (1 Descobrir ·
   2 Definir · 3 Explorar e especificar · 4 Entregar · 5 Acompanhar e aprender — mapa no
   `capa-template.md` da skill `descobrir`) com posição, confiança e pendências abertas.
   Roteie **pela Fase registrada na capa**, usando os artefatos como desempate:
   - pedido de **status/placar** → skill `acompanhar` (responda o status primeiro; artefato
     `⚠️ desatualizado` entra como achado do checkpoint, não como bloqueio do status)
   - intenção de **avançar** com artefato `⚠️ desatualizado` no caminho → reabrir a etapa
     dele (skill correspondente) antes; o dono pode aceitar como está, com decisão registrada
   - Fase DISCOVER (ou sem `descobertas.md`) → skill `descobrir`
   - Fase DEFINE (ou descobertas sem `dossie.md`/placar) → skill `definir`
   - Fase DEVELOP (ou dossiê sem `plano.md`) → skill `desenvolver`
   - Fase DELIVER com entregas abertas no plano → skill `entregar`
   - Fase DELIVER com **todas as entregas entregues** (e não ENCERRADO) → skill `acompanhar`
     — é a etapa 5, hora de medir o resultado e decidir perseverar/pivotar/encerrar
   - Fase ENCERRADO → skill `acompanhar` (consulta/post-mortem)
   - **Tier expresso** (campo `Tier` da capa; sem campo = completo): gates 1-3 são um só
     (GATE E). GATE E aberto → skill `descobrir` (que conduz problema + placar + hipóteses na
     mesma conversa); GATE E fechado → rotear como DELIVER acima.
5. Sem desafio correspondente e o pedido É um problema/objetivo → skill `descobrir` (desafio
   novo; a capa nasce lá, começando pela régua de proporcionalidade: 1 pergunta que classifica
   risco/reversibilidade/urgência/pessoas afetadas/evidência disponível e oferece o tier
   `expresso` × `completo` — a IA recomenda, o dono escolhe). Se o dono já chega com materiais
   prontos (pesquisas, tickets, dados, métricas, gravações, relatórios, análises anteriores),
   a `descobrir` começa **catalogando** esse acervo em `descobertas.md` em vez de levantar do
   zero.
6. Em dúvida entre duas fases (ou entre desafio × tarefa), pergunte em 1 questão curta antes
   de assumir.
