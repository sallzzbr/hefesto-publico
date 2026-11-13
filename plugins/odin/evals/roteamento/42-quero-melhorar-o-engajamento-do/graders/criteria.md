# Critério: roteamento correto

Frase golden da matriz de roteamento do odin (`docs/roteamento-matrix.md`, frase 42). O sinal observável de ativação é o banner impresso pela skill como primeira linha da resposta. Banners possíveis: descobrir (🧭), definir (🎯), desenvolver (💎), entregar (🟢), dev-loop (🔁), acompanhar (📊).

## Esperado

A skill `descobrir` ativa: a resposta contém o banner "🧭 Skill `descobrir` ATIVADA".

## Comportamento adicional

Problema vago SEM entrega definida: a resposta NÃO deve mostrar o diagrama do portão anti-tarefa ("VOCÊ ENTROU AQUI" / acusação de solução pronta) — deve seguir a abertura decisão-first normal (que decisão o desafio precisa tomar / proporcionalidade).

## Score

1.0 se o esperado acontece e nada do proibido aparece; 0.0 caso contrário. Ignorar o restante do conteúdo da resposta — este caso avalia só o roteamento.
