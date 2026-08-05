---
description: Simula investimentos com juros compostos em 3 cenários — projeção ("aportando X chego onde?") ou objetivo ("para chegar em W, aporto quanto?"), inclusive ancorado numa meta.
argument-hint: "[simulação] ex.: \"aportando 1000/mês por 10 anos\", \"quanto preciso aportar pra 100 mil em 5 anos?\", \"simula a meta da reserva\""
---

Simular investimentos usando a skill `analisar-investimentos`.

Simulação: $ARGUMENTS

1. Use a skill `analisar-investimentos`, saída "Simular".
2. Identifique o sentido: projeção (aporte → resultado) ou objetivo (resultado → aporte). Se
   ancorada numa meta de `metas.csv`, use alvo, prazo e progresso atuais.
3. **Proponha as premissas de taxa (conservador/base/otimista) e espere o ok do usuário** —
   nunca simule com número inventado silenciosamente. Considere o patrimônio inicial quando
   houver.
4. Apresente os 3 cenários com as taxas mostradas, em BRL, e feche com: rentabilidade passada
   não garante rentabilidade futura; simulação é hipótese, não promessa.
5. Se a simulação mudar o plano de uma meta, ofereça atualizar o `aporte_mensal_planejado` via
   skill `investimentos` (escrita confirmada).
