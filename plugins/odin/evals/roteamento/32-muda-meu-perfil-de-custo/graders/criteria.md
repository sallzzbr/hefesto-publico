# Critério: roteamento correto

Frase golden da matriz de roteamento do odin (`docs/roteamento-matrix.md`, frase 32). O sinal observável de ativação é o banner impresso pela skill como primeira linha da resposta. Banners possíveis: descobrir (🧭), definir (🎯), desenvolver (💎), entregar (🟢), dev-loop (🔁), acompanhar (📊).

## Esperado

NENHUMA skill do odin deve ativar: a resposta não contém banner de ativação (nenhuma linha "Skill `<nome>` ATIVADA"). O pedido segue em fluxo direto.

## Não deve acontecer

- Banner da skill `entregar` ("🟢 Skill `entregar` ATIVADA") presente na resposta.

## Comportamento adicional

O caminho certo é o fluxo de defaults (/defaults, ~/.claude/odin/defaults.md) — a resposta deve tratar de defaults sem iniciar fluxo de entrega.

## Score

1.0 se o esperado acontece e nada do proibido aparece; 0.0 caso contrário. Ignorar o restante do conteúdo da resposta — este caso avalia só o roteamento.
