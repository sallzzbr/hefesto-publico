---
name: delegar-agente
description: "Write the delegation brief or agent definition for the model that will run it. Use when despachar um subagente, criar ou ajustar um agente (agents/*.md), rotear tarefa entre agentes ou modelos, escrever prompt de delegação, ou preparar prompt de continuidade para outra sessão (Claude ou Codex)."
argument-hint: "[tarefa] [agente/modelo de destino]"
---

# Delegar a um agente

Monta o que um agente precisa para trabalhar sem a conversa: brief de delegação, definição de
agente fixo ou prompt de passagem para outra sessão, ajustado ao modelo que vai executá-lo.
Prompt avulso para um modelo, sem delegação → `iris:escrever-prompt`.

## Input

- **Tarefa** e para que ela serve.
- **Destino** — agente/subagente e modelo, quando conhecidos.
- **Tipo**: delegação pontual · agente fixo · roteamento (qual agente/modelo recebe) ·
  passagem para outra sessão.
- **O que já se sabe**: decisões, descartes, arquivos, limites de permissão.

## Antes de escrever

1. **Destino.** Resolva como em `${CLAUDE_PLUGIN_ROOT}/references/delegacao.md` (seção
   "Descobrir o destino"). Modelo herdado da sessão conta como conhecido quando a sessão o
   informa; preferência configurada não prova o modelo efetivo. Desconhecido em agente fixo,
   autônomo ou de longa duração → uma pergunta curta com o porquê, que encerra o turno; nos
   demais casos, versão portátil declarada. Família sem versão segue
   `${CLAUDE_PLUGIN_ROOT}/references/destinos/desconhecido.md`.
2. **Leia** `${CLAUDE_PLUGIN_ROOT}/references/delegacao.md`,
   `${CLAUDE_PLUGIN_ROOT}/references/principios.md` e o cartão do destino em
   `${CLAUDE_PLUGIN_ROOT}/references/destinos/`. Cartão com `revisarAte` vencido → avise.
3. **Roteamento.** Se a pergunta é qual agente ou modelo deve receber a tarefa, decida pelo papel
   (quem julga não executa o que julga; mecânico para coleta/execução prescrita; modelo mais
   capaz para julgamento e arquitetura) e pelo que o ambiente oferece; diga o critério.

## Escrever o brief

Inclua: objetivo e porquê · pronto quando · escopo e o que fica de fora · permissões (leitura,
escrita, commit, instalação) · contexto que o agente não tem, apontando caminhos · contrato de
saída com evidência · condição de parada.

Tire: o que `AGENTS.md`/`CLAUDE.md` já dizem, se o agente os carrega (Explore, Plan e
`omitClaudeMd` não carregam `CLAUDE.md`) · conselho genérico · ênfase agressiva · sua conclusão,
quando o agente revisa (entregue o material, não a hipótese; no Codex, sem herdar a conversa) ·
o que o checklist "Frases que costumam sobrar" de `principios.md` aponta para este destino. Se
ninguém decidiu ainda se vale delegar, confira a seção "Delegar ou não" de `delegacao.md`; com a
decisão tomada pelo usuário ou pelo fluxo que chamou, só escreva o brief.

Ajuste ao destino só o que o cartão sustenta (ex.: dizer o que não acrescentar, quando parar,
quando delegar, precedência entre usuário e skill).

## Agente fixo

Frontmatter com `name`, `description` (caso principal primeiro, curta) e, quando o papel exige,
`model`/`effort` com o porquê. Corpo: papel, regras que mudam decisões, contrato de saída.
Material condicional em referência. Valide no repositório com as ferramentas da forja quando o
agente for de um plugin (`hefesto:validar-plugin`).

## Passagem para outra sessão

O prompt fica de pé sozinho: repositório, branch e commits reais; o que foi feito, verificado e
pendente (separando implementado, verificado automaticamente, executado de fato e não
verificado); comandos de verificação; decisões do dono; limitações do ambiente anterior.

## Output

1. O brief (ou a definição do agente) num bloco de código.
2. **Destino e configuração** — modelo/effort usados ou recomendados e de onde veio o dado.
3. **Por que assim** — até 5 itens, citando o cartão.
4. **Incertezas** — destino presumido, cartão vencido, mecanismo do ambiente não verificado.

## Important

- Esta skill escreve o brief; não autoriza delegar. Delegação vem do pedido do usuário ou do
  fluxo que a chamou.
- Não presuma acionamento automático de agente ou skill: diga como invocar no ambiente.
- Não prometa modelo efetivo que o ambiente não confirma.
- Exemplos devem ser fictícios; nada de dados de projetos reais neste plugin.

## Exemplo sintético

Tarefa: revisar a corretude de uma mudança em `src/fatura.ts` contra os critérios C1–C3, com
subagente revisor em modelo `opus`. Brief: critérios colados, comando para ler o diff, "somente
leitura; não corrija", saída como lista de achados com arquivo:linha e cenário, "achado sem
cenário não entra". Fora do brief: a suspeita do autor sobre onde está o bug.
