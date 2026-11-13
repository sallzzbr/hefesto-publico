---
destino: delegacao
aplicaA: "Prompts de delegação para subagentes, definição de agentes fixos, roteamento e passagem para outra sessão (Claude Code, Codex)"
consultadoEm: 2026-11-03
revisarAte: 2027-02-03
fontes: [A1, A6, A7, A8, O1, O3, O4, O8]
---

# Delegação: do pedido ao brief do agente

No Claude Code, um subagente começa sem a conversa: recebe o próprio prompt de sistema, a
mensagem de delegação e, salvo Explore, Plan e agentes com `omitClaudeMd`, os `CLAUDE.md` e o
git status [A6]. No Codex, o `spawn_agent` pode copiar a conversa. Confira o schema exposto pelo host antes de
escolher isolamento; não deduza o contexto herdado pela flag `multi_agent_v2`. Tudo que o agente
precisa e não consegue descobrir barato tem de estar no brief. A diferença de defaults descrita
em [O8] é evidência histórica de código, não garantia do runtime atual.

## Delegar ou não

Esta conferência vale quando ninguém decidiu ainda; se o usuário ou o fluxo que chamou já
decidiu delegar, só escreva o brief. Subagente vale para trabalho paralelo, saída volumosa que
poluiria o contexto principal, revisão independente (quem não viu o raciocínio), restrição de
ferramentas e papel que pede outro modelo (ex.: arquitetura num modelo de julgamento). Delegar a
mesma tarefa ao mesmo modelo não melhora a resposta, e cada subagente custa tokens [A8]. O GPT-6 tende a delegar menos
e alguns Claude delegam demais: diga quando delegar e quando trabalhar direto [A1][O1].

## Descobrir o destino

| Situação | Como o destino é conhecido | Fonte |
|---|---|---|
| Claude Code, chamada de subagente | `model` da chamada (apelido) → `model` do frontmatter → `CLAUDE_CODE_SUBAGENT_MODEL` → modelo da conversa | [A6] |
| Claude Code, agente fixo de plugin | frontmatter `model`/`effort` do arquivo em `agents/` | [A6] |
| Workflow/harness que passa `model` por chamada | o valor passado na chamada (ex.: tabela de modelos por etapa do harness) | código do harness |
| Codex, subagente (`spawn_agent`) | herda o modelo da sessão; `model`/`reasoning_effort` por chamada existem, mas a instrução do próprio Codex é não definir `model` sem pedido explícito do usuário; `[agents].default_subagent_model` na configuração troca o padrão; o resultado do spawn não informa o modelo efetivo; herança da conversa depende do schema exposto pelo host; confira a observação datada abaixo | [O8] |
| Codex, agente customizado | arquivo de configuração do Codex (usuário ou projeto), não pacote de plugin | [O8] (leitura de código, não executado) |
| Outra sessão (passagem de bastão) | o que o usuário disser; senão, desconhecido | — |

Destino desconhecido → versão portátil (`destinos/desconhecido.md`).

Pedido não é prova do modelo efetivo, nem no Claude Code: um apelido da mesma família do modelo
da conversa (ex.: `opus` numa sessão Opus) roda no modelo exato da conversa;
`CLAUDE_CODE_SUBAGENT_MODEL` só vale quando nem a chamada nem o frontmatter definem `model`,
salvo com `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, que impõe um modelo a todos; e um mod com hook
`agent.spawn` pode substituir o `model` da chamada [A6]. Ajuste o brief à
família pedida e registre o modelo como "pedido", salvo quando o ambiente informar o efetivo.

Delegar exige pedido: no Codex, o próprio agente só cria subagente quando o usuário, o
`AGENTS.md` ou uma skill aplicável pedem [O8]. Escrever o brief não é esse pedido — a decisão de
delegar é do fluxo que chamou esta orientação. No Codex, quem lê esta skill e escreve o brief é o
agente principal; a leitura da skill não se delega [O8].

## O que o brief precisa ter

1. **Objetivo e porquê** — o que entregar e para que serve; o porquê muda decisões [A1].
2. **Pronto quando** — critério verificável de término.
3. **Escopo** — arquivos/áreas, o que fica de fora, o que pode e o que não pode mudar
   (somente leitura? pode commitar? pode instalar?).
4. **Contexto que ele não tem** — decisões já tomadas, o que foi descartado e por quê, onde
   estão os arquivos. Aponte caminhos em vez de colar conteúdo.
5. **Contrato de saída** — formato do retorno, o que é evidência (comando + saída, arquivo:linha),
   o que fazer quando bloquear.
6. **Condição de parada** — quando parar e devolver em vez de improvisar.

## O que tirar

- O que o destino já faz por padrão, e o que `AGENTS.md`/`CLAUDE.md` já dizem **quando o agente
  carrega esses arquivos** (repetir custa contexto e cria conflito) [O1][O3]. No Claude Code,
  Explore, Plan e agentes com `omitClaudeMd` não carregam `CLAUDE.md`: a regra de que a tarefa
  depende vai no brief [A6].
- Sua conclusão, quando o agente é revisor: para revisão independente, entregue o código e o
  critério, não a hipótese — senão ele tende a confirmá-la. No Codex isso só funciona se ele não
  herdar a conversa: use `fork_turns: "none"` quando disponível no schema; só use
  `fork_context` falso se esse campo existir e sua semântica estiver confirmada [O8].
- Ênfase agressiva e listas de "nunca" sem motivo [A1].

## Ajustes por família (detalhe nos cartões)

- **Claude:** diga o que não acrescentar; para autonomia longa, diga que ninguém está olhando e
  o que exige confirmação; para Haiku em prompt longo, peça para continuar até concluir e
  verificar de verdade; delegação excessiva se controla dizendo quando não delegar
  (`destinos/claude.md`).
- **GPT-6/Codex:** resultado primeiro, sem repetir `AGENTS.md`; precedência explícita entre
  instrução do usuário e skill; autorização já dada declarada para evitar pausas; diga quando e
  quanto delegar (`destinos/openai.md`).

## Agente fixo (arquivo de definição)

- `description` decide quando ele é escolhido: caso principal primeiro, curta, com exclusão só
  quando evita roteamento errado [A6][A7][O3].
- Corpo: papel, regras que mudam decisões, contrato de saída. Material condicional em referência.
- Modelo e effort no frontmatter quando o papel exige (ex.: revisor sempre no modelo mais
  capaz); omitir = herdar. Registre o porquê da escolha.

## Passagem para outra sessão

O prompt precisa ficar de pé sozinho: repositório, branch e commits reais; o que foi feito e o
que falta; como verificar (comandos); decisões pendentes do dono; limitações do ambiente
anterior. Não presuma que a outra sessão leu esta conversa.

## Integração nos fluxos do Hefesto

Nenhum mecanismo garante que esta skill seja consultada sozinha: skills são escolhidas pela
`description` [A7][O3]. Por isso os fluxos que criam ou despacham agentes a citam pelo nome
(forja ao criar agente; Odin ao despachar o arquiteto planner). Harness com prompts em código
(dev-loop, gerar-curso, criativo-fluxo) não consulta skill em tempo de execução — o sandbox não
tem filesystem —; esses prompts são revisados contra estes cartões na manutenção.

## Observação de runtime (2026-11-03)

No Codex CLI 0.155.1, duas sessões persistentes, com `multi_agent_v2` desligado e ligado,
expuseram `collaboration.spawn_agent` com `task_name`, `message` e `fork_turns` opcional.
Em ambas, omitindo `model` e os campos de fork, o filho recuperou um código sintético presente
somente no contexto pai. Não deduza isolamento pela flag: confira o schema da ferramenta e use
`fork_turns: "none"` para contexto limpo quando disponível. Um ensaio adicional com `fork_turns: "none"` retornou `SEM_CONTEXTO` para outro código sintético, sem recebê-lo na mensagem.
A tentativa com sessão efêmera falhou ao criar o filho, sem evidência sobre herança.

[O8] continua sendo a leitura histórica do código fixado em 2026-11-01, incluindo o campo
`fork_context` da implementação antiga. A observação acima não prova o modelo efetivo do filho
nem comportamento em outro host ou versão; nenhum override de modelo foi enviado.
