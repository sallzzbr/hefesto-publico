# Runtime Codex — Iris

Leia este arquivo antes do contrato da skill. O Iris só escreve texto: não há harness, script, servidor, rede nem dependência. Não instala, não publica e não chama API paga.

Recursos em shared/ são cópias verificadas pelo inventário; nunca editar o pacote instalado. Nos contratos, `${CLAUDE_PLUGIN_ROOT}` resolve para shared/ deste pacote, apenas para leitura. SKILL.md legado em shared vira CONTRATO.md. Links relativos são resolvidos a partir do arquivo que contém o link.

## O que governa o quê
Este arquivo governa a sessão Codex que executa a skill: ferramentas, despacho e modelo desta sessão. O contrato governa o conteúdo entregue. Modelo e effort que o contrato manda recomendar, ou escrever no frontmatter de uma definição de agente, são conteúdo para o destino do prompt, tirados dos cartões em shared/references/destinos/ com a fonte citada; não mudam o modelo desta sessão. Em conflito sobre o que o texto entregue deve conter, vale o contrato.

## Esta sessão
Herdar modelo e effort da sessão. Delegar só quando o usuário, o AGENTS.md ou a skill chamadora pedirem; a leitura da skill não se delega. No `spawn_agent`, não definir `model` sem pedido explícito do usuário; para revisor independente, confira o schema exposto e use `fork_turns: "none"` quando disponível; `fork_context` falso só se o campo existir e sua semântica estiver confirmada. Não deduza isolamento pela flag de versão. Para leitura de configuração, CLAUDE.md significa AGENTS.md do workspace.

## Perguntas ao usuário

Não pergunte o que dá para verificar por leitura ou comando: verifique e informe o resultado em uma linha. Pergunte só o que pede decisão, preferência, autorização ou informação que só o usuário tem. Faça antes da pergunta todo o trabalho que não depende da resposta. A pergunta necessária é curta e completa, com contexto, opções e recomendação, sem depender de mensagem anterior. Feita como pergunta direta, ela fecha a mensagem e encerra o turno; feita por ferramenta de interação da sessão, a resposta volta no mesmo turno. Depois da pergunta, não continue executando ferramentas, agentes ou passos antes de a resposta chegar, e não a presuma. Regra de pergunta própria de uma skill ou do contrato de domínio se soma a esta.

## Evidência
Prompt escrito não é prompt testado. Os evals comportamentais do Iris vivem na distribuição Claude. Sua presença no pacote não comprova execução nem aprovação no Codex. Ao informar se um prompt funciona, cite a execução e os critérios efetivamente verificados; sem esse registro, declare não verificado.
