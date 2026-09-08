---
name: orcamento
description: Use quando o usuário quiser lançar despesa ou receita, abrir o mês, gerenciar recorrências, ver status ou fechar o orçamento doméstico em BRL.
---

# Orçamento Doméstico

Na primeira utilização, leia `../../RUNTIME.md`, `../../shared/skills/orcamento/CONTRATO.md` e
`../../shared/skills/orcamento/references/defaults.md`. Para abrir o mês, leia integralmente
`../../shared/skills/orcamento/references/abertura-mes-segura.md`. Este entrypoint e o runtime
prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva a subpasta `orcamento/`, aplique fallback legado somente para leitura e valide os
   cabeçalhos. Dados ficam no Drive; nunca use IDs ou invente operações do conector.
2. Para lançar ou gerenciar recorrências, produza linha/antes/depois em CSV válido e BRL cru.
   Releia o alvo antes de escrever. Execute se já autorizado; caso contrário, peça aprovação
   sobre o efeito exato. Depois, releia e verifique.
3. Para abrir o mês, siga o protocolo seguro: plano completo, uma autorização para o efeito total,
   journal `planejado` persistido e relido antes do primeiro efeito, lote único no livro, lote
   único nas recorrências, releitura e estados verificados. Nunca infira decremento pela mera
   presença de linha. Falha ou retorno incerto exige reconciliação pelo antes/depois e
   `operacao_id`, sem repetir escrita às cegas. Não prometa atomicidade.
4. Para listar recorrências e resumir o mês, execute `../../shared/scripts/recorrencias.py` e
   `../../shared/scripts/resumo_mes.py`. Narre o JSON; não some CSV de cabeça.
5. Status e fechamento são leitura. Fechar nunca apaga, move ou sobrescreve o livro.

Sem escrita disponível, entregue plano e preview completos e bloqueie somente a mutação. Não dê
conselho de investimento e nunca grave dados no cache.
