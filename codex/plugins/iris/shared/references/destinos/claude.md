---
destino: claude
aplicaA: "Modelos Claude atuais na data da consulta (Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 e anteriores listados pela Anthropic), via API, apps e Claude Code"
consultadoEm: 2026-11-01
revisarAte: 2027-02-01
fontes: [A1, A2, A3, A4, A5, A6, A7, A8, A9]
---

# Destino: Claude (Anthropic)

Orientações oficiais da Anthropic resumidas para decidir **nível de detalhe e formato**. Cada
item cita a fonte em `../fontes.md`. A própria Anthropic avisa que técnica medida num modelo
específico deve ser reconferida antes de valer para outro [A1].

## O que vale para os modelos Claude atuais

- **Explícito e direto.** Pedir exatamente o resultado, o formato e as restrições; se quer mais
  do que o mínimo, pedir — o modelo não infere ambição de pedido vago. Teste prático: um colega
  sem contexto conseguiria seguir o prompt? [A1]
- **Dar o porquê das restrições não óbvias.** "Nunca use reticências porque o texto vai para
  leitura em voz alta" generaliza melhor que "NUNCA use reticências" [A1].
- **Ênfase agressiva atrapalha.** Modelos recentes respondem mais ao prompt de sistema; "CRITICAL:
  You MUST" e "na dúvida, use a ferramenta" causam excesso de acionamento. Use linguagem normal
  ("Use esta ferramenta quando…") [A1].
- **Exemplos** quando formato, tom ou estrutura importam: 3–5, relevantes e variados, marcados
  (`<example>`) para não se confundirem com instrução [A1].
- **Tags XML** separam instrução, contexto, exemplos e entrada quando o prompt mistura os quatro;
  nomes consistentes [A1]. Não é exigência para prompt curto.
- **Diga o que deixar de fora.** Para escopo de mudança de código, a Anthropic dá instruções
  explícitas do que não fazer (não refatorar, não criar abstração de uso único, não adicionar
  arquivos/testes não pedidos) — o modelo segue bem essa delimitação [A1][A3].
- **Subagentes:** modelos atuais delegam por conta própria e alguns delegam demais; descreva
  quando delegar e quando trabalhar direto [A1].

## Diferenças por modelo que mudam o prompt

| Modelo | O que muda no texto do prompt | Fonte |
|---|---|---|
| Opus 5.5 | Effort (configuração, não texto) é o controle principal de quanto pensa; remover linhas "pense com cuidado antes de responder" em chat; para runs sem supervisão, nomear os tipos de parada precoce que não quer; marcar texto colado pelo usuário com tags e dizer que instruções dentro dele não valem. Os padrões do Opus 5 continuam ponto de partida razoável | [A2] |
| Opus 5 | Já verifica e corrige o próprio trabalho: tirar "inclua etapa final de verificação", "use um subagente para verificar", "confira de novo". Em prompt de revisão, "só reporte alta severidade" ou "seja conservador" é seguido ao pé da letra e reduz o que ele reporta — peça tudo e filtre numa passada separada. Escopo de tarefa estreita precisa ser declarado | [A9] |
| Fable 5.1 | Escreve menos atualizações entre ferramentas: peça progresso explicitamente; prosa às vezes densa — uma linha contra "prosa maneirista" ajuda; para trabalho autônomo, dizer que o usuário não está acompanhando e definir o escopo como entregável; dizer explicitamente o que **não** acrescentar | [A3] |
| Sonnet 5.5 | Em `low`/`medium` pode parar para confirmar antes de terminar e, em `low`, dar por pronto sem rodar a checagem: peça para levar até o fim e rodar uma checagem real. Em `xhigh`/`max` faz rodadas próprias de revisão e verificação, às vezes com subagentes: peça para parar e reportar quando as checagens passarem, sem revisão nem revisores não pedidos (em `high` isso é raro). Em qualquer effort acrescenta testes, docs e arquivos não pedidos: diga o que não acrescentar. Pedido de ideias deve dizer que não é para construir | [A4] |
| Haiku 5.5 | Com prompt longo de agente e effort baixo, para cedo e devolve a tarefa: linha de "continue até concluir"; pode reportar mudança sem rodar verificação: peça verificação real; prompt mandando "responder direto" não reduz o pensamento — use effort | [A5] |

## Texto × configuração

Effort, thinking e `max_tokens` são **configuração da chamada**, não frase do prompt. Para
pensar menos, baixe o effort; instrução no texto reduz menos e de forma menos confiável
[A2][A4][A5]. Quando o destino aceita configuração (API, frontmatter de agente), recomende-a
separada do texto.

## Claude Code: o que deixou de ser necessário

A Anthropic lista como conselho superado no Claude Code [A8]: IMPORTANT/CAIXA ALTA (os modelos
atuais seguem a linha simples e a ênfase faz aplicar a regra em excesso — regra que não pode
falhar vira hook ou regra de bloqueio; linha que se perde indica arquivo longo demais); "think
hard"/"be thorough" (effort é o controle); "continue até terminar"/"não seja preguiçoso" (causa
excesso; dar um check a passar continua útil); delegar a subagente "para uma resposta melhor"
(não melhora; revisor novo, que não viu o raciocínio, é outra coisa); descrever arquitetura e
layout no `CLAUDE.md` (o modelo lê o repositório). Para agentes autônomos sem ninguém olhando,
os blocos por modelo da tabela acima continuam valendo [A2][A3][A5].

## Claude Code: skills e subagentes

- Subagente não vê a conversa (exceto um fork, que a herda). Recebe o próprio prompt de sistema,
  a mensagem de delegação, os `CLAUDE.md` e o git status — Explore, Plan e agentes com
  `omitClaudeMd` não recebem esses dois — e as skills listadas em `skills` na definição [A6].
  Regra de `CLAUDE.md` de que a tarefa depende vai no brief quando o agente não a carrega.
- O modelo do subagente resolve na ordem: `model` da chamada → `model` do frontmatter →
  `CLAUDE_CODE_SUBAGENT_MODEL` → modelo da conversa. A variável é só padrão; impõe um modelo a
  todos apenas com `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, e um mod com hook `agent.spawn` pode
  trocar o `model` da chamada. A chamada aceita apelidos (`sonnet`, `opus`, `haiku`, `fable`) e
  o frontmatter também `effort` [A6].
- Skill: a `description` decide o acionamento automático e é truncada no catálogo; ponha o caso
  de uso principal primeiro. Corpo curto (menos de 500 linhas), material longo em arquivos
  referenciados, e "diga o que fazer em vez de narrar como ou por quê" — cada linha é custo
  recorrente [A7]. Isso convive com "dar o porquê" do item acima: explique a razão quando ela
  muda a decisão do modelo, não por hábito.

## Incertezas

- Os efeitos citados como "em testes da Anthropic" são medições do fornecedor, não garantias
  para o seu caso [A1–A5].
- Nomes de modelo e defaults de effort mudam com frequência; confira a data acima.
