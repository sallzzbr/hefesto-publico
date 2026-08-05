---
description: Rodar o dev-loop somente com spec/plano aprovado, perfil de custo e opt-in
argument-hint: <spec ou plano aprovado>
---

# /dev-loop

Use a skill `dev-loop`.

Pedido inicial: $ARGUMENTS

Antes de executar, confirme que existe spec/plano aprovado, apresente o perfil de custo/rigor
sugerido (Econômico / Balanceado / Máximo) **e o tiering de modelo/effort por step** (defaults
`dev_loop_*` de `~/.claude/odin/defaults.md` + embutidos do harness), deixe o usuário ajustar
modelo/effort por step para a rodada (dentro da whitelist do harness — promoção só dentro do
papel, haiku só nos steps mecânicos), e só então peça opt-in explícito de custo multi-agente.
Sem spec/plano → bloqueie e roteie para `/spec` ou para a skill `entregar` (planejamento).
