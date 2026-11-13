# Priorização AI-era — aprendizado × reversibilidade

> Paths do workspace resolvem pela regra única em
> `../../descobrir/references/capa-template.md`; os literais nesta referência são ilustrativos
> do default, não hardcode.

Use esta referência no DEVELOP, quando houver alavancas concorrentes para o mesmo desafio.

## Princípio

Quando construir ficou barato com IA, **esforço deixa de ser o principal sinal do que construir**. A regra é priorizar por valor de aprendizado e reversibilidade:

1. **Valor de aprendizado** — quanto esta alavanca reduz incerteza sobre problema, hipótese, público, canal, regra, arquitetura ou métrica?
2. **Reversibilidade** — se estiver errado, quão barato é desfazer, desligar, esconder, reverter dados, remover código ou mudar a decisão?

Esforço/custo ainda importa, mas como restrição operacional: tamanho da aposta, perfil de custo/rigor, rollout, prazo e capacidade. Ele não deve vencer sozinho contra uma aposta que aprende muito e é reversível.

## Matriz 2x2

| Quadrante | Sinal | Decisão |
|---|---|---|
| **Alto aprendizado + fácil reversão** | Ensina muito e dá para desfazer com pouco dano | **Construa agora** como aposta pequena, com métrica e data de revisão |
| **Alto aprendizado + difícil reversão** | Ensina muito, mas cria porta quase sem volta | **Prototipe primeiro**: Wizard-of-Oz, fake backend, feature flag, piloto pequeno, manual ops, teste com poucos usuários |
| **Baixo aprendizado + fácil reversão** | Não ensina tanto, mas é barato desfazer | **Faça uma aposta reversível** só se houver hipótese clara e limite de escopo; evite reunião longa |
| **Baixo aprendizado + difícil reversão** | Aprende pouco e é caro desfazer | **Deixe na prateleira**; espere, colete mais evidência ou encontre caminho reversível para o mesmo objetivo |

## Perguntas de arquiteto

1. O que exatamente vamos aprender se esta alavanca rodar por uma semana?
2. Qual incerteza do desafio ela reduz?
3. Se der errado, como desligamos ou revertemos?
4. O que fica persistido e difícil de desfazer: dados, contrato, hábito do usuário, dependência de time, arquitetura, comunicação?
5. Existe um protótipo, fake, piloto ou flag que aprende quase o mesmo com reversibilidade maior?
6. Qual data e métrica encerram a aposta?

## Como registrar no dossiê (`docs/desafios/<slug>/alavancas.md`, consolidado no §5 do `dossie.md`)

Cada alavanca precisa declarar:

- **Valor de aprendizado:** alto | médio | baixo.
- **Reversibilidade:** fácil | média | difícil.
- **Decisão 2x2:** Construa agora | Prototipe primeiro | Aposta reversível | Prateleira.
- **Esforço/custo:** pequeno | médio | grande, usado para dimensionar a aposta e o perfil de execução, não para substituir aprendizado/reversibilidade.

## Anti-padrões

- Escolher a maior entrega porque "agora a IA faz rápido".
- Escolher a menor entrega que não ensina nada.
- Chamar algo de MVP quando é difícil de reverter.
- Usar esforço como desempate antes de perguntar "o que isso nos ensina?".
- Construir arquitetura difícil de desfazer sem protótipo, flag, piloto ou contrato de saída.
