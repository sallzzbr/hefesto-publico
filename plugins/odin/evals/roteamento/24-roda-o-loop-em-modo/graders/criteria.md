# Critério: roteamento correto

Frase golden da matriz de roteamento do odin (`docs/roteamento-matrix.md`, frase 24). O sinal observável de ativação é o banner impresso pela skill como primeira linha da resposta. Banners possíveis: descobrir (🧭), definir (🎯), desenvolver (💎), entregar (🟢), dev-loop (🔁), acompanhar (📊).

## Esperado

A skill `dev-loop` ativa: a resposta contém o banner "🔁 Skill `dev-loop` ATIVADA".

## Comportamento adicional

Sem spec aprovada no contexto, a resposta deve bloquear/pedir a spec (perfil não substitui spec) — não executar loop nem implementar.

## Score

1.0 se o esperado acontece e nada do proibido aparece; 0.0 caso contrário. Ignorar o restante do conteúdo da resposta — este caso avalia só o roteamento.
