---
destino: openai
aplicaA: "Família GPT-6 (Astra, Sol, Luna) e o agente Codex na data da consulta; GPT-5.x só por herança declarada"
consultadoEm: 2026-11-03
revisarAte: 2027-02-03
fontes: [O1, O2, O3, O4, O5, O6, O7, O8]
---

# Destino: OpenAI (GPT-6 e Codex)

As páginas da OpenAI (developers.openai.com) não estavam acessíveis no ambiente da consulta. As
fontes abaixo são as cópias que a própria OpenAI mantém no repositório oficial `openai/codex`,
declaradas lá como cópia da seção "Prompting best practices" da página viva [O1]. Ao atualizar,
prefira a página viva.

## O que vale para a família GPT-6

- **Não reescreva um prompt que funciona.** Mude prompt por falha medida, exigência documentada
  de migração ou pedido explícito; edite cirurgicamente o trecho ligado à falha [O2].
- **Instruções em skills e `AGENTS.md` pesam mais.** O GPT-6 Astra segue instruções longas
  melhor, mas é mais sensível ao que está no contexto: orientação confusa ou conflitante num
  arquivo de skill pode fazê-lo pausar e bloquear o trabalho cedo. A OpenAI recomenda auditar
  skills e arquivos acessíveis e deixar explícita a precedência (instrução do usuário vence a
  skill) [O1].
- **Pergunta demais por padrão.** O Astra tende a perguntar quando a resposta pode mudar o
  resultado e a fazer perguntas não bloqueantes durante o trabalho. Para autonomia: tratar
  "pode…", "quero…" como pedido de ação; concluir o trabalho já autorizado e só então pedir
  aprovação de um resultado concreto e revisável; ação reversível ou somente leitura não precisa
  de permissão [O1].
- **Estilo:** tende a respostas detalhadas, com listas e tabelas. Se quer prosa, diga; a OpenAI
  dá um bloco curto contra jargão e frases feitas [O1].
- **Subagentes:** pode delegar menos do que o desejado; diga quando e quanto delegar [O1].
- **Testes:** em código, tende a testar mais que o necessário em mudanças pequenas; calibre o
  quanto verificar [O1].
- **Configuração não é texto.** `reasoning.effort` (low/medium/high/xhigh/max; Astra e 6.1 Sol
  sem `none`) é parâmetro da chamada; preserve o effort efetivo ao migrar [O2].

## GPT-5.5/5.6

Orientação dos modelos anteriores, que continuam em uso. A OpenAI não a declara herdada pelo
GPT-6 — para um alvo nomeado vale o guia dele [O5] —, mas o núcleo ("simplifique", "absoluto só
para invariante") coincide com o que ela diz para skills do Codex [O3].

- **Simplifique antes de acrescentar.** Ao migrar, corte regra repetida, "seja minucioso", "seja
  conciso", "pense passo a passo", exemplo que não muda o comportamento, instrução de processo
  que o modelo já cumpre e ferramenta alheia à tarefa. Mantenha resultado visível, critério de
  sucesso e de parada, restrições de segurança/negócio/evidência/permissão, regra de roteamento
  de ferramenta quando não é óbvia e formato de saída [O6].
- **Comece pelo menor prompt que passa nas suas avaliações** e acrescente só o que corrige uma
  falha medida [O6].
- **Absolutos só para invariantes.** ALWAYS/NEVER/must/only para segurança, campo obrigatório e
  ação proibida; para decisões de julgamento (buscar, perguntar, usar ferramenta, continuar),
  regra de decisão [O6][O7].
- **Condição de parada explícita** — o que conta como pronto e o que fazer quando falta
  evidência — evita laços de exploração e validação repetida [O6].
- **Controle de tamanho concreto** ("comece pela conclusão e traga a evidência que a sustenta")
  em vez de "seja breve", que no 5.6 já comprimido pode omitir evidência [O6].

## Codex: skills, AGENTS.md e plugins

- **Assuma que o Codex já é capaz.** Inclua só o que muda decisões; remova conselho genérico,
  instrução repetida e caso hipotético. Linguagem absoluta e passos fixos só onde correção,
  segurança, permissão ou fluxo frágil exigem [O3].
- **Divulgação progressiva:** nome e descrição são lidos na seleção; o corpo da skill quando ela
  se aplica; referências só quando a tarefa precisa. A descrição diz o que faz e quando, com
  exclusão só para evitar roteamento errado [O3].
- **Escolha a superfície menor:** restrição pontual vai no prompt; convenção durável do
  repositório vai no `AGENTS.md`; fluxo reutilizável vai em skill; pacote instalável em plugin;
  imposição mecânica em hook [O4].
- **Acionamento:** seleção automática de skill é o padrão; `allow_implicit_invocation: false` em
  `agents/openai.yaml` deixa a skill só explícita (`$nome`) [O3].
- **Delegação entre agentes:** mensagens entre agentes podem sair com erro de espaçamento; a
  OpenAI dá uma linha pedindo legibilidade [O1]. O subagente herda o modelo da sessão e o próprio
  Codex instrui a não definir `model` sem pedido explícito do usuário [O8]. O schema exposto pelo host governa a
  herança: não deduza isolamento pela flag `multi_agent_v2`. Quando disponível, use
  `fork_turns: "none"` para revisor independente; `fork_context` falso só é alternativa se o
  schema o expuser e sua semântica estiver confirmada.

Observação em 2026-11-03, Codex CLI 0.155.1: sessões persistentes com a flag desligada e ligada
expuseram `collaboration.spawn_agent` com `fork_turns` opcional e herdaram contexto quando os
campos de fork foram omitidos. Nenhum `model` foi enviado. Isso limita a generalização de [O8],
leitura histórica de código que descreve também a implementação antiga com `fork_context`;
não comprova modelo efetivo. Em ensaio adicional com `fork_turns: "none"`, o filho respondeu
`SEM_CONTEXTO` para outro código presente somente no pai.

## Consequência prática para prompts longos no Codex

Instrução que repete o que `AGENTS.md`, a skill ou o próprio modelo já fazem custa contexto e,
no GPT-6, pode virar motivo de pausa. Antes de acrescentar uma linha, pergunte: o que daria
errado sem ela? Se a resposta é "nada observado", corte. Precedência explícita e autorização
reutilizável reduzem pausas mais que ênfase.

## Incertezas

- [O8] é leitura de código; a observação de execução acima cobre somente o runtime e os
  cenários declarados. O schema do `spawn_agent` pode variar por host e versão.
- Para GPT-5.x, a orientação de cada modelo é a dele; não aplique GPT-6 a um alvo GPT-5.x
  nomeado [O5].
