# Convenções de formatação (legibilidade)

> Carregue antes de escrever/editar código pela primeira vez na sessão.

Regra do autor, aplicar **SEMPRE** ao escrever/editar código: **separe statements e blocos lógicos com linhas em branco** — o código não pode ficar "grudado". Dentro de um método, deixe respiro entre passos distintos (uma atribuição e a chamada que a consome, grupos de `dispatch`/`log`, setup de listeners, antes de um `return` que encerra uma lógica).

❌ Grudado:

```ts
const teste = this.getArray();
this.processa(teste);
```

✅ Arejado:

```ts
const teste = this.getArray();

this.processa(teste);
```

## Regras práticas

- Linha em branco entre **passos lógicos distintos** dentro de um método. Não precisa entre toda linha de uma sequência homogênea (ex.: várias declarações `const` relacionadas, ou vários resets `= undefined` no teardown) — esses podem ficar agrupados.
- Linha em branco **antes** de um comentário de bloco que descreve o próximo trecho.
- Linha em branco **antes de um `return`** quando ele encerra uma lógica.
- **Apenas blank lines simples** — nunca várias seguidas (o prettier colapsa). É puramente legibilidade: **não muda comportamento** e passa em `prettier --check` e `oxlint`.
- Depois de espaçar, **rodar `prettier`/lint** confirma que o formatter do projeto mantém os blank lines (ele preserva linhas em branco simples entre statements).
