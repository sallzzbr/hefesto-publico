---
name: limpar-computador
description: "Preview disk cleanup on macOS and clean rebuildable Chrome, Claude Desktop and Slack caches. Use when o usuário pedir limpar o computador, medir Downloads ou Lixeira, revisar arquivos grandes ou guardar e restaurar arquivos em quarentena, limpar caches dos apps e conferir o ganho depois de reabri-los."
---

# limpar-computador

Leia [o runtime](../../RUNTIME.md) e [o contrato](../../shared/skills/limpar-computador/CONTRATO.md). No macOS, execute o [coletor empacotado](../../shared/scripts/diagnostico.mjs) com Node.js 22+ e o argumento `computador`. Apresente a prévia por categoria em GB e percentual do volume. Separe os caches recriáveis dos itens que dependem de escolha pessoal. Informe áreas inacessíveis. Para a prévia específica de Chrome, Claude Desktop ou Slack, siga o contrato e use o [executor de caches dos apps](../../shared/scripts/caches-apps.py) com Python 3. Execute a prévia dos apps selecionados em uma chamada. Mostre cada linha de `porApp` e o total ou subtotal indicado por `rotulo`. Acesso negado fica como “não medido”. Depois do subtotal, use a seção “Acesso negado no Mac” do contrato para indicar o ajuste do app que hospeda o Codex. Para limpeza autorizada, aplique o identificador de uma prévia completa. Reporte a redução após a reabertura e a variação do volume.

Para revisão sob demanda, mostre os itens da categoria com tamanho ocupado e ação. Siga as seções de quarentena do contrato e use o [executor empacotado](../../shared/scripts/instaladores.py). Ao guardar instaladores de Downloads, use a chamada sem `--pasta`. Para restaurar, use a chamada correspondente à reserva indicada no diagnóstico. Informe a ocupação das reservas e os bytes efetivamente liberados.
