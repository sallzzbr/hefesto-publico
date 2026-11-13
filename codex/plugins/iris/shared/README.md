# Iris — prompts no tamanho certo para o modelo de destino

Íris, a mensageira: ajusta a mensagem a quem vai recebê-la. O plugin ajuda a escrever prompts e
briefs de delegação proporcionais à tarefa e adequados ao modelo que vai executá-los — sem
perder o contexto necessário e sem carregar o que o modelo já faz sozinho.

## Skills

| Skill | Use quando |
|---|---|
| `escrever-prompt` | criar, melhorar ou encurtar um prompt para um modelo (Claude, GPT/Codex, Gemini ou desconhecido) |
| `delegar-agente` | despachar subagente, criar/ajustar agente, rotear tarefa, preparar prompt de continuidade para outra sessão |

## Commands

| Command | Atalho para |
|---|---|
| `/prompt` | `escrever-prompt` |
| `/delegar` | `delegar-agente` |

## Como funciona

1. **Destino primeiro.** Se você disse o modelo, a skill não pergunta de novo. Se não disse e
   isso muda o resultado, pergunta uma vez e diz por quê; senão escreve a versão portátil e
   avisa.
2. **Orientação com fonte.** `references/principios.md` traz só o que Anthropic e OpenAI dizem
   em comum; `references/destinos/` traz o que muda por família e por modelo. Cada item cita a
   fonte em `references/fontes.md`, com data da consulta e prazo de revisão.
3. **Texto separado da configuração.** Effort/raciocínio e ferramentas saem como recomendação à
   parte — não como frase no prompt.
4. **Transparência curta.** Até cinco porquês e as incertezas (destino presumido, orientação
   vencida, falta de orientação específica).

## Integração com os outros plugins

- **Forja (`hefesto`):** ao criar agente, `criar-plugin` usa `iris:delegar-agente`; ao calibrar
  o corpo de skill, `criar-skill` usa `iris:escrever-prompt`. No Claude Code, a forja declara a
  `iris` em `dependencies`: instalar a forja instala a `iris`, e desativar a `iris` desativa a
  forja. A distribuição Codex da forja ainda não declara essa dependência.
- **Odin:** `entregar` e `dev-loop` usam `iris:delegar-agente` ao despachar o arquiteto planner,
  quando instalado. Passagem para outra sessão não está integrada: chame `/delegar`.
- Os harnesses (dev-loop, gerar-curso, criativo-fluxo) têm prompts em código e não consultam
  skill em execução; eles são revisados contra os cartões na manutenção.

Nenhum ambiente garante que uma skill será acionada sozinha: a escolha automática depende da
`description`. Para garantir, chame pelo nome (`/prompt`, `/delegar`, `iris:escrever-prompt`;
no Codex, `$escrever-prompt`).

## Limites

- Orientações de fornecedor descrevem medições do fornecedor; confira no seu caso.
- Cartão com `revisarAte` vencido é avisado como possivelmente desatualizado.
- Sem dados de projetos reais: exemplos são fictícios.

Atualização das referências: procedimento em `references/fontes.md`.
