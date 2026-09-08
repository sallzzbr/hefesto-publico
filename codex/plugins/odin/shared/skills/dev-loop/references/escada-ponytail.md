# Regras ponytail do odin (FONTE ÚNICA) + portão TDD

> **Crédito e propriedade:** importadas e adaptadas do projeto
> [ponytail](https://github.com/DietrichGebert/ponytail) — *"The best code is the code you never
> wrote."* A partir daqui **são regras do odin e evoluem aqui**: cite pelo número (P1…P18), não
> re-explique.
>
> Reference **compartilhada**: a `entregar` (Step 4 e gate de qualidade do modo Solo) e a
> `dev-loop` (harness, agentes e fallback) citam este arquivo em vez de duplicar as regras.
> O modo Solo carrega SÓ este arquivo — não a `dev-loop/SKILL.md` inteira.
>
> **Não confundir com as lentes de revisão** R1/R2/R3 (`protocolo-revisao-adversarial.md`):
> `P` = regra ponytail (o que fazer ao escrever), `R` = lente de revisão (como refutar depois).

## 🪜 P1–P7 — A escada

Antes de escrever QUALQUER código — na spec, em cada unidade e em cada correção — desça a
escada e **pare no primeiro degrau que resolve**:

- **P1.** Não escreva o que não precisa existir — YAGNI é a primeira pergunta, não a última.
- **P2.** Já existe no codebase? Reuse. Grep/find ANTES de criar — não reescreva o que a base resolve.
- **P3.** A stdlib da linguagem faz isso? Use a stdlib.
- **P4.** É feature nativa da plataforma? Use a plataforma.
- **P5.** Alguma dependência **já instalada** faz isso? Use ela.
- **P6.** Cabe em uma linha? Escreva uma linha.
- **P7.** Só então: a implementação mínima que funciona.

## ⛔ P8–P9 — O que a escada nunca corta

- **P8. Lazy, not negligent (INEGOCIÁVEL).** Validação em fronteiras de confiança, tratamento de
  erro que evita perda de dados, segurança e acessibilidade NUNCA entram no corte. Preguiça é
  sobre a solução, nunca sobre o cuidado.
- **P9. Preguiçoso na solução, nunca na leitura.** Entenda o problema e trace o fluxo real ponta
  a ponta ANTES de escolher o degrau. Escolher degrau sem ler é chute, não economia.

## 📏 P10–P14 — Peso do diff

- **P10.** Dependência NOVA só entra com justificativa **por escrito no próprio código** (comentário
  no manifesto ou no ponto de uso) de por que P1–P5 falharam. Sem esse texto, a dependência não
  passa — no harness é bloqueante automático em código, sem apelação. A justificativa mora no
  diff porque é lá que ela serve a quem vier depois.
- **P11.** Não crie abstração para uso único. Duas chamadas não são um padrão; três começam a ser.
- **P12.** Não crie arquivo novo quando um arquivo existente é o lugar natural. Menos arquivos possível.
- **P13.** Diff pequeno é qualidade: **código demais tem peso de bug**. Deleção > adição, chato >
  esperto. O menor diff que funciona vence — depois de P9, nunca antes.
- **P14.** Não reformate nem refatore código fora do escopo. Achou problema fora da unidade →
  **vira pendência, não vira diff**.

## 🎯 P15–P18 — Qualidade da escolha

- **P15.** Conserte a causa raiz, não o sintoma: patch na função compartilhada uma vez, não em
  cada chamador.
- **P16.** Empate de tamanho entre duas soluções → escolha a que está correta nas bordas.
- **P17.** Lógica não-trivial deixa **UM** check executável pra trás: o menor teste que falha se
  a lógica quebrar.
- **P18.** Simplificação deliberada vira comentário `ponytail:` nomeando a restrição assumida e o
  caminho de upgrade. Atalho não documentado é dívida invisível.

## 🔴 Portão TDD (resumo canônico)

Vale pra qualquer modo de implementação (Solo da `entregar` ou harness do `dev-loop`):

- Implementação NÃO começa sem os critérios de aceite materializados em **testes executáveis
  vermelhos, falhando pelo motivo certo** (teste que nasce verde é suspeito: ou o critério já
  está atendido → cortar, ou o teste é inútil → reescrever).
- **O implementador não edita o teste** que precisa passar — nem afrouxa/skipa pra ficar verde.
- Critério sem teste → volta pra SPEC (Step 4c da `entregar`).
- Exceção justificada: critério puramente visual/não-executável → verificação complementar
  explícita (preview/screenshot/review); em entrega não-software, a variante SPEC-lite
  (`spec-template.md`, nesta pasta) troca a coluna de teste por forma de verificação.

No harness esses invariantes estão em código (`../harness/loop.mjs`), junto com a auditoria
ponytail de cada iteração; este resumo existe pra quem implementa sem o harness.
