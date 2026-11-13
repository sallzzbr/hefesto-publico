# Critério: roteamento correto

Frase golden da matriz de roteamento do odin (`docs/roteamento-matrix.md`, frase 43). O sinal observável de ativação é o banner impresso pela skill como primeira linha da resposta. Banners possíveis: descobrir (🧭), definir (🎯), desenvolver (💎), entregar (🟢), dev-loop (🔁), acompanhar (📊).

## Esperado

A skill `entregar` ativa: a resposta contém o banner "🟢 Skill `entregar` ATIVADA".

## Comportamento adicional

Entrega definida antes do problema: o portão 0.5 deve disparar — questionar placar/hipótese e oferecer o /desafio, não implementar direto.

## Score

1.0 se o esperado acontece e nada do proibido aparece; 0.0 caso contrário. Ignorar o restante do conteúdo da resposta — este caso avalia só o roteamento.
