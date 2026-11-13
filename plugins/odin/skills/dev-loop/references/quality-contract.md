# Contrato mínimo de qualidade

Fonte única para planejar, implementar, corrigir e revisar software no Odin, inclusive Solo.
O piso vale em todos os perfis de custo. Rigor adicional muda as lentes, não desliga regras.
Leia as instruções aplicáveis (AGENTS.md e CLAUDE.md), configuração e contratos do projeto antes
de escolher a solução. Registre fonte e decisão; legado sozinho não prova boa arquitetura.
Conflito relevante exige decisão explícita, respeitando autorizações já dadas.

## Regras base

| ID | Planejar e implementar | Conferir com evidência |
|---|---|---|
| Q-NAMES | Identificadores novos em inglês, com nomes de domínio e intenção; preserve contratos existentes. | Nome permite entender responsabilidade sem abrir a implementação; não renomeie legado fora do escopo. |
| Q-COMMENTS | Comentários e JSDoc em português quando explicam contrato, unidade, efeito, restrição ou motivo não evidente. | Remova comentário que apenas traduz a linha; não exija quota de JSDoc nem comentários de processo. |
| Q-BOUNDARIES | Valide dado externo na fronteira de confiança; exponha interface mínima que o consumidor precisa. | Entrada inválida tem tratamento explícito; núcleo recebe dados validados sem duplicar validação por hábito. |
| Q-TESTABILITY | Separe decisão de I/O quando houver ganho verificável; injete fronteiras necessárias, inclusive interface de uso único. | Oráculo independente da implementação, casos negativos e controle válido; teste falha quando o comportamento quebra, sem reproduzir o algoritmo. |
| Q-COHESION | Uma responsabilidade coerente por módulo; decomponha por motivo de mudança, não por contagem de linhas. | Fronteiras, dependências e nomes explicam o recorte; aplique a decisão de decomposição abaixo. |
| Q-ERRORS | Erros preservam causa e contexto útil sem expor segredos; defina propagação, recuperação e limpeza. | Falha não vira sucesso, lista vazia ou fallback silencioso; caminhos de erro são exercitados. |
| Q-PROJECT | Reuse convenções e ferramentas existentes; documente divergências necessárias no contrato. | Compatibilidade, arquitetura, segurança e escopo preservados; não instalar bibliotecas para satisfazer o checklist. |

Exemplo sintético: uma interface `ReceiptStore` usada por um único serviço pode separar a
persistência do cálculo e permitir testes de falha. Um wrapper que só repassa argumentos sem
proteger contrato ou fronteira não ganha valor só porque tem vários chamadores.

## Perfis por área

Sempre inclua `base`. Se a área tocada usa TypeScript, UI ou servidor, acrescente respectivamente
`typescript`, `frontend`, `backend` e leia `quality-typescript.md`, `quality-frontend.md`,
`quality-backend.md`. Perfis podem se combinar. O catálogo de IDs/perfis em
`../scripts/quality-rules.json` é canônico para o parser; estes documentos explicam como agir.
O auditor confronta seleção com arquivos reais: declarar só base não dispensa a stack existente.

## Planejamento e contrato da SPEC

Antes do TDD, preencha uma única seção `## Contrato de qualidade`, com um único bloco JSON:
`{version: 1, profiles, conventions, checks, decomposition}`. Formato completo em
`spec-template.md`. Nada de campos extras ou strings vazias nos campos obrigatórios.

- `profiles`: nomes conhecidos, únicos, incluindo `base`.
- `conventions`: objetos `{source, decision}`. Fonte é instrução/configuração existente ou
  registro da busca sem resultado com o default adotado. Não invente convenção do projeto.
- `checks`: exatamente um `{id, applicability, reason, paths, verification, command}` para cada
  ID dos perfis. `applicability`: `required` ou `not-applicable`; motivo concreto nos dois.
  Q-NAMES, Q-COMMENTS, Q-TESTABILITY, Q-COHESION e Q-PROJECT não são dispensáveis.
  As demais só admitem dispensa justificada no contrato aprovado.
- `paths`: arquivos relativos concretos, não vazios; novos são válidos no planejamento.
  Diretório existente não é alvo de arquivo: rejeite no preflight, antes do TDD.
  Colchetes em nomes concretos, como `app/users/[id]/page.tsx`, são literais, inclusive em
  arquivos rastreados não selecionados. Não expandir glob nem acrescentar opções de padrões.
  Sem absoluto, traversal, `.git`, controle ou normalização ambígua; não seguir symlink que
  escape do workspace. Especifique os alvos realmente inspecionáveis.
- `verification`: `review` ou `command`. Use `command: ""` para review; para command, uma linha
  exata autorizada no plano. O parser não executa comandos nem autoriza efeitos externos.
- `decomposition`: objetos `{path, trigger, decision, verification}` com decisão local e forma
  de conferir o resultado. Pode começar vazio quando nenhum arquivo exigir decisão.

Extraia com `spec-ids.mjs <spec> --quality`; ausência/ambiguidade/invalidez bloqueia antes do
TDD. A CLI histórica sem a flag não valida este piso e não substitui o preflight novo.
O operário recebe o contrato aprovado e recorta sua unidade; não reabre escolha por gosto.

## Decomposição antes e durante a implementação

400 linhas é alerta padrão para arquivo textual novo/ampliado, não reprovação por tamanho.
Todo arquivo tocado acima de 400 linhas, inclusive legado, exige decisão em `decomposition`:
extrair responsabilidade neste escopo; manter coesão com motivo concreto; ou registrar débito
fora do escopo. Outro limiar do projeto precisa de fonte; nesta versão a medição usa 400 e a
auditoria explica a convenção ao avaliar a decisão.

Planeje o recorte antes de acumular responsabilidades num arquivo gigante. Se ele crescer
além do previsto, atualize a decisão e verifique interfaces e testes sem ampliar a tarefa.
Não dividir cegamente, não espalhar fragmentos para baixar número, não refatorar o legado
inteiro. Generated/vendored/binary exigem classificação e motivo, nunca divisão automática.

Exemplo sintético: um módulo de 430 linhas mistura parsing e envio. Extrair o parser puro
com seu contrato pode permitir teste independente; manter um catálogo gerado de 430 linhas
pode ser correto. A contagem inicia a análise, não escolhe a arquitetura.

## Execução e auditoria

A validação independente usa `inspecionar-git.mjs quality <paths-json> [base [pendenciasPath]]` e devolve a saída
literal em `qualityInventory`: `{files: [{path, lines, bytes, status}], uninspected, errors}`.
Status `text`, `binary`, `deleted` ou `symlink`; excluídos têm linhas/bytes zero.
Symlink interno para arquivo regular tem `lines: 0` e `bytes` positivos dos bytes reais
de `readlink`, sem ler conteúdo do alvo. Diretório, dangling, loop, tipo especial, fuga
e metadados Git continuam recusados; pendência-link nunca recebe dispensa. Reconcilie todos os
arquivos relatados e novos autorizados; erro ou arquivo não inspecionado impede verde.
O comando inclui alvos, arquivos relatados, testes protegidos, apoio TDD e a SPEC autorizada
quando ela está dentro do workspace. A cobertura do inventário deve incluir todos os caminhos
solicitados, sem omitir testes ou apoio. SPEC externa continua disponível ao preflight, mas
não entra no inventário do workspace nem pode servir de evidência inventariada ou de dispensa.
Quando uma decisão precisar citar a SPEC como evidência, use uma SPEC autorizada dentro do
workspace, medida no inventário; não substitua essa fonte por uma citação externa.
Novos extras exigem reconciliação explícita de escopo; não incluir notas privadas automaticamente.
`pendenciasPath` é um único arquivo local resolvido pela skill, nunca uma lista de exclusões.
Para passá-lo sem base explícita, use `HEAD`. Omita o argumento se houver colisão com alvos,
arquivos tocados/declarados, testes, apoio, SPEC ou área de implementação; esses caminhos
continuam sujeitos à inspeção e reconciliação. A dispensa vale somente para arquivo regular
não rastreado ou caminho ainda ausente. Pendência exata regular em HEAD ou índice segue
o inventário normal, sem exclusão, inclusive mudanças e remoções; entrada somente na base
continua recusada, assim como diretório, symlink e fuga da raiz. Flags `skip-worktree` ou
`assume-unchanged` em alvos explícitos ou no `pendenciasPath` recusam a inspeção com diagnóstico.
Arquivos alheios marcados presentes são comparados literalmente ao blob do índice, incluindo
tipo e modo executável; diferenças, falhas de leitura e índice unmerged recusam a inspeção.
Ausência com `skip-worktree` em sparse checkout (inclusive sparse-index) só é admitida
quando `git sparse-checkout check-rules -z` confirma que está fora das regras e o caminho
não mudou entre base e índice; se mudou, há recusa diagnosticada, nunca
registro falso de deleção. Candidatos elegíveis únicos entram em um único lote NUL;
sem candidatos, não há chamada. A resposta vazia ou terminada em NUL contém apenas
incluídos únicos da entrada, em qualquer ordem; só o complemento pode ser dispensado.
Erro, sinal, stderr, duplicata, registro desconhecido ou terminador ausente recusam o lote.
Sem `check-rules`, somente diagnóstico explícito de subcomando
indisponível habilita fallback cone: `sparse-checkout list` sem warnings e reconstrução
byte a byte das regras canônicas comprovam membership de raiz, ancestrais e descendentes.
Configuração, lista e regras do fallback são preparadas uma vez por inventário, sem cache
entre invocações; o número de subprocessos de membership não cresce com os candidatos.
O fallback distingue root-only de full cone e aplica `core.ignoreCase` somente ao ASCII.
Não-cone exige `check-rules`; nomes C-quoted, regras não canônicas, config inválida,
warnings e erros operacionais são recusados com diagnóstico, sem parser aproximado.
A inspeção não altera índice, bits ou bytes nem executa conversores. Sem argumento, mantém todas as omissões.
Copie o JSON literal; não remova entradas manualmente. A contenção física dos ancestrais
ocorre antes do diff, sem impor a sintaxe de alvos aos nomes rastreados alheios nem seguir
seus symlinks terminais. Candidatos alterados/declarados mantêm validação estrita.
Não executar filtros/conversores nem seguir symlink externo. Inventário mede leitura e
volume, não certifica qualidade semântica.

`qualityExecutions` contém exatamente um `{id, command, paths, exitCode, output}` por check
required/command: comando e alvos iguais aos aprovados, exitCode inteiro, saída não vazia.
Execute de verdade nesta validação, sem reaproveitar cache nesta versão. Exit 0 sem conferir
alvo e relatório não demonstra regra satisfeita. Encaminhe `qualityExecutions` literal,
inclusive `output`, à auditoria: ela confronta resultado concreto, alvo e relatório. Saída
não vazia também pode revelar zero testes executados; não confunda presença com efeito.
Relato completo com exit não zero é resultado válido de verificação: falha funcional volta
à correção/revalidação do loop, sem fechar verde. Falha ambiental preserva parada operacional;
não mude código/testes nem dispense check para contorná-la. Reserve erro estrutural para
relato ausente, inválido ou incoerente; não crie parser universal de relatórios.

A auditoria existente retorna `qualityReview`, exatamente um
`{id, status, evidence: [{path, line, observation}], finding}` por check. Status:
`satisfied`, `issue`, `not-applicable`. Evidência não vazia vinculada aos alvos aprovados do
check, com arquivo efetivamente inspecionado, linha textual existente e observação concreta.
Citar outro arquivo só porque consta no inventário não comprova inspeção dos alvos.
`issue` exige `finding: {summary, scenario}`; os demais usam `finding: {}`. Dispensa só se
aprovada e justificada. A exceção de citar a SPEC exige fonte local autorizada, medida como
`text` no inventário e linha dentro da contagem real. Para binary/deleted/symlink, registre classificação, limitação
e forma de inspeção na SPEC medida e cite essa fonte; nunca invente linha textual no arquivo.
Para symlink, registre também destino literal observado (ou bytes escapados/hex
identificados), resolução interna para arquivo regular e inspeção realizada; cite a linha
real da SPEC, nunca uma linha inventada no link. O modo `diff` representa novo link
declarado como `{path,type:"symlink",targetBase64}` com bytes exatos de `readlink`;
rastreados permanecem no diff Git e novos não declarados continuam omissões.
Arquivo textual intencionalmente vazio, medido como `status: text`, `lines: 0` e `bytes: 0`,
também usa essa SPEC local medida: a observação da evidência declara explicitamente que o
alvo está vazio, por que isso é intencional e como foi inspecionado. Não invente linha no
alvo nem acrescente conteúdo para satisfazer a guarda. Texto com conteúdo não recebe essa
exceção; sua evidência continua vinculada às linhas reais dos alvos aprovados.

Confronte perfis, inventário e decisões de decomposição, lendo conteúdo. Texto >400 sem
decisão impede verde. Ausência/duplicata/evidência inválida é erro estrutural com diagnóstico;
issue semântico segue confirmação e pode ser refutado. Bloqueante confirmado volta ao
operário. Não transforme contagem de chamadores em aprovação ou refutação de fronteira.

P10 aceita justificativa durável em SPEC, plano, ADR, PR acessível ou comentário útil:
localização verificável (arquivo:linha ou URL com âncora) e contexto observado do porquê
P1–P5 falharam. Booleano ou nome de manifesto sozinho não é evidência. Não force comentário
no código para registrar processo. Ao fechar, preserve contrato, inventário, execuções,
cobertura por ID e limitações no relatório; Solo declara que sua revisão não é independente.
