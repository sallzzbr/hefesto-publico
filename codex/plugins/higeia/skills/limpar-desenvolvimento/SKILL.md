---
name: limpar-desenvolvimento
description: "Measure development caches and older simulator runtimes on macOS. Use when o usuário pedir para medir caches de desenvolvimento, simuladores antigos, espaço liberável em GB ou percentual do disco por categoria."
---

# limpar-desenvolvimento

Leia [o runtime](../../RUNTIME.md) e [o contrato](../../shared/skills/limpar-desenvolvimento/CONTRATO.md) antes de executar.

No macOS, execute com Node.js 22+ o [coletor do pacote](../../shared/scripts/diagnostico.mjs) no modo `desenvolvimento`. Para um pedido combinado, use `espaco --desenvolvimento` e as raízes do usuário. Apresente por categoria e por volume as estimativas em GB e percentual conforme o contrato.

Quando o pedido envolver Claude-Mem, execute a [prova de consulta](../../shared/scripts/verificar-claude-mem.py) e passe o inventário uv à [prova dos ambientes](../../shared/scripts/provar-ambientes-uv.py). Para manter determinado modelo e versão do iOS, gere o [plano por identificador](../../shared/scripts/plano-ios.mjs). Aplique o protocolo do contrato ao executar uma retirada autorizada.
