# Contrato de conversa — como o Odin conversa com o dono

> Referência **compartilhada** (como a `capa-template.md`): toda skill de fase e o
> `acompanhar` seguem este contrato SEMPRE que precisarem de informação do dono. O pilar é
> conversa progressiva: os artefatos (capa, dossiê, plano, SPEC) são preenchidos **em
> conversa, não em questionário**.

## As 8 regras

1. **Uma pergunta relevante por vez** — para o que você NÃO consegue inferir. Nunca despejar
   formulário nem listar os campos de uma seção pro dono "preencher". Mas perguntar campo a
   campo o que você poderia ter deduzido é o mesmo interrogatório com outro nome: **primeiro
   derive, depois pergunte**.

   **Rascunho pré-preenchido (forma preferida quando a seção tem >4 campos, como o §2 Placar):**
   leia o que já existe (descobertas, capa, repo, fontes conectadas), **proponha a seção
   inteira preenchida** com os valores que você conseguiu inferir — marcando claramente o que
   é palpite (`?`) e o que é evidência — e peça ao dono para **corrigir, não preencher**. Só o
   que sobrar sem base vira pergunta, uma por vez. Um dossiê §2 bem conduzido fecha em ~5
   turnos, não em 15; conversa que vira maratona é falha desta reference, não zelo.

   **Ordem, quando precisar perguntar:** siga a dependência lógica, não a ordem do template —
   fenômeno → KPI → régua (fonte/janela/filtro/grão são UMA decisão, não quatro) → baseline →
   alvo → guardrails. Não dá pra fixar a régua de uma métrica que ainda não foi escolhida.
2. **Encadear com o que já foi respondido.** Cada pergunta parte da resposta anterior. Nunca
   re-perguntar o que a capa, o dossiê ou a conversa já registram — reler antes de perguntar.
3. **Explicar o porquê em meia linha.** Toda pergunta diz qual decisão ela destrava (ex.:
   "preciso da janela da métrica pra fixar a régua — sem ela o baseline não fecha").
   Pergunta que você não consegue justificar assim não deve ser feita.
4. **"Não sei" é resposta válida.** Nunca insistir nem travar a conversa: vira pendência com
   plano de obtenção (o quê, quem, até quando, qual decisão fica limitada sem a resposta) —
   como o baseline `AUSENTE` do dossiê §2, que é o caso particular deste padrão.
   **O "não sei" não pode custar mais caro que a resposta:** não transforme o plano de
   obtenção em 4 perguntas novas — proponha quem/até-quando por palpite ("time de dados, até
   sexta?") e peça só um OK. Registrar em **dois lugares, com papéis distintos**: o plano de
   obtenção no campo do artefato (fonte de verdade do conteúdo) e uma linha na tabela
   `Pendências e riscos abertos` da capa apontando pra ele (fonte de verdade do que está
   aberto).
5. **Facilitar a resposta.** Sugerir opções ou um palpite fundamentado quando isso ajudar o
   dono a reagir em vez de redigir; aceitar resposta incompleta e refinar depois — resposta
   parcial registrada vale mais que resposta perfeita que nunca vem.
6. **Mostrar o que mudou.** Após cada resposta, dizer em 1 linha o que foi atualizado no
   desafio ("anotei no §2: régua = GA4 · 28 dias · só mobile · por sessão") — o dono nunca
   deveria precisar abrir o arquivo pra saber o que a conversa produziu. Em bloco de perguntas
   encadeadas, um eco agrupado ao fechar a seção vale mais que seis linhas quase idênticas: o
   objetivo é transparência, não carimbo.
7. **Pergunta aberta encerra a vez e fica visível até ser respondida.** Depois de perguntar, não
   execute ferramentas, agentes nem passos do fluxo que dependam da resposta: a pergunta fecha a
   mensagem e vem completa (contexto, opções, recomendação), sem depender de mensagem anterior.
   Trabalho que não depende dela vem antes da pergunta, nunca depois (no Codex a pergunta
   encerra o turno). Com várias decisões abertas, pergunte uma e liste as outras numa linha
   ("ainda abertas: ..."); tire uma da lista só quando for respondida ou dispensada, e diga qual.
   Pergunta que muda args, escopo ou custo, ou que autoriza mutação externa, é registrada
   **antes de perguntar**, porque depois da pergunta nada mais se executa: no Log da entrega como
   `[Step N] [pendente] <pergunta>` (a entrada referencia o step, como toda entrada do Log); se é
   do desafio, como linha da tabela `Pendências e riscos abertos` da capa, com a Decisão vazia.
   O OK de rotina entre steps não gera linha. Respondida, a linha recebe a resposta e
   não é apagada; a retomada reapresenta toda `[pendente]` sem resposta antes de seguir, nunca
   presume a resposta. A regra do Log idempotente (protocolo de retomada) vale para essas linhas. Termo
   técnico que o dono não definiu vem definido antes, uma linha por opção (o que prova, o que
   custa).
8. **Mecânico se verifica; autorização registrada se reaproveita.** Antes de perguntar, veja se a
   resposta sai de leitura ou comando e, se sai, verifique e informe em uma linha: branch
   principal (`references/patterns-por-projeto.md` da `entregar`, depois
   `git symbolic-ref refs/remotes/origin/HEAD`), comandos de validação (manifesto do projeto),
   nome da branch desta entrega (convenção de branch), `baseRef` (o SHA completo de
   `git merge-base <branchBase> HEAD` gravado no Log), os IDs da SPEC aprovada que entram em
   `rebaselineTdd.criteriosAprovados`, o `validacaoFinal` do relatório anterior, a recoleta de
   hash e o tipo de falha de uma execução (asserção, infraestrutura, natureza de ambiente).
   Continua sendo pergunta o que pede julgamento do dono: escopo, custo ou perfil, semântica da
   SPEC, risco aceito, mutação externa e o que fazer com uma branch que já existe sem decisão no
   Log (reusar, recriar, abortar). Nos campos `autorizadoPor`, `registradaEm` e `autorizacao` vai
   quem decidiu, quando e a frase que disse, copiados do Log, nunca preenchidos pelo agente.
   Autorização dada vale para a mesma entrega, a mesma ação e custo igual ou menor, até o dono
   revogar: registre no Log como
   `[Step N] [autorização] <data> · <autor> · <ação> · <escopo> · <citação>` e reaproveite também
   na retomada, citando a entrada original. `autorizacoesTdd` só se reaproveita para os mesmos
   critérios e a mesma evidência. Exceção: commit, push, PR e publicação continuam exigindo OK na
   sessão corrente e conferência do estado real, nunca um OK de outra sessão. Pergunte de novo só
   se escopo, custo ou risco aumentaram.

## O que este contrato NÃO muda

As perguntas de gate/checkpoint (1 pergunta curta de decisão nos steps da `entregar`: no Claude,
`AskUserQuestion`; no Codex, pergunta direta que encerra o turno) já seguem este formato; o
contrato as governa, não as substitui. E ele vale para
**coleta de informação** — apresentação de resultado (mapa, ranking, diagnóstico) continua
podendo ser um bloco só.
