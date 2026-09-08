---
name: analisar-gastos
description: Use quando o usuário quiser entender gastos ao longo do tempo, comparar meses e categorias, detectar variações fora do padrão ou confrontar recorrências com o realizado.
---

# Analisar Gastos

Na primeira utilização, leia `../../RUNTIME.md`,
`../../shared/skills/analisar-gastos/CONTRATO.md` e, para a pasta de dados,
`../../shared/skills/orcamento/references/defaults.md`. Este entrypoint e o runtime prevalecem
para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva a base do Hestia e leia os livros do período e `recorrencias.csv` quando existir. Sem
   leitura do Drive, informe o bloqueio e peça conexão; não invente números.
2. Materialize cópias temporárias fora do pacote e execute:
   `python3 ../../shared/scripts/gastos.py --livros <arquivos...> [--mes AAAA-MM] [--recorrencias <arquivo>]`.
3. Narre o JSON, inclusive `criterios`, `simplificacoes`, `secoes_puladas`, categorias novas e
   base esparsa. Não refaça somas, médias ou desvios mentalmente.
4. Apresente visão do mês, evolução, variações, mudanças mês a mês e recorrências versus realidade
   na ordem e com os limiares do contrato. Descreva; não prescreva cortes.

Esta skill é leitura. Relatório separado só é escrito quando já autorizado ou após preview e
aprovação. Dados ficam no Drive/workspace, nunca no cache.
