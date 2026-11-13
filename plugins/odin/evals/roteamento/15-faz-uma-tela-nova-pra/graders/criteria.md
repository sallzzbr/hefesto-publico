# Critério: roteamento correto

Frase golden da matriz de roteamento do odin (`docs/roteamento-matrix.md`, frase 15). O sinal observável de ativação é o banner impresso pela skill como primeira linha da resposta. Banners possíveis: descobrir (🧭), definir (🎯), desenvolver (💎), entregar (🟢), dev-loop (🔁), acompanhar (📊).

## Esperado

A skill `entregar` ativa: a resposta contém o banner "🟢 Skill `entregar` ATIVADA".

## Comportamento adicional

Além do banner da entregar, a resposta deve acionar o portão de desafio (Step 0.5): questionar placar/hipótese e oferecer rotear pro /desafio — NÃO deve partir pra implementação direta (criar branch, escrever código ou spec sem questionar).

## Score

1.0 se o esperado acontece e nada do proibido aparece; 0.0 caso contrário. Ignorar o restante do conteúdo da resposta — este caso avalia só o roteamento.
