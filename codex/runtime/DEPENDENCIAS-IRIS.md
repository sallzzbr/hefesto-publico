# Dependência de autoria: Iris no Codex

Este pacote exige a Iris nas etapas que escrevem prompts ou briefs de agentes. Este arquivo é um contrato do pacote, não um campo reconhecido pelo manifesto ou um instalador automático.

## Verificar na sessão

1. Consulte as skills efetivamente disponibilizadas pela sessão. Para escrever ou calibrar uma skill, exija `iris:escrever-prompt`; para montar um brief de agente, exija `iris:delegar-agente`. O host pode apresentar o namespace como `iris/…`: confirme o pacote de origem e o caminho da skill, não apenas o nome semelhante.
2. Leia a skill Iris descoberta, seu RUNTIME e o contrato indicado por ela antes de executar essa etapa. Um manifesto presente no disco, uma entrada de marketplace ou uma cópia em cache não prova que a skill está habilitada e utilizável nesta sessão.
3. Se a skill necessária estiver ausente, desabilitada ou ilegível, pare antes de gerar o conteúdo dependente e informe: `dependência ausente: iris:<skill>; etapa de autoria bloqueada`. Mostre a etapa afetada. Não substitua silenciosamente pela memória, por um contrato legado ou por outro agente.
4. Oriente o dono a habilitar ou instalar Iris pelo gerenciador de plugins que ele usa, e iniciar uma sessão que a disponibilize. Não instale, habilite, modifique configuração nem peça credenciais automaticamente. Depois da disponibilização, confira de novo e reaproveite o pedido e as autorizações já existentes.

## Limite da exigência

A forja exige `escrever-prompt` para redigir o conteúdo de skills e `delegar-agente` quando o pedido inclui agentes. Odin exige `delegar-agente` quando prepara o brief do planner/arquiteto em entregar ou dev-loop. Consultar status, rotear desafios, ler defaults e validar um pacote existente não depende da Iris. Um run já iniciado pode reproduzir respostas salvas sem gerar novamente o brief; não execute outra vez uma etapa concluída.

A verificação de manutenção confere que os recursos necessários são distribuídos. A verificação de disponibilidade é feita na sessão real. Nenhuma delas implica instalação transitiva automática pelo Codex.
