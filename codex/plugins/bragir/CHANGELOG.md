# Changelog

## 1.0.0

Perfil de voz pertence ao usuário. A skill de escrita passa a `escrever-como-autor`, sem perfil pessoal empacotado nem fallback de outra pessoa. Sem perfil preenchido, ofereça `analisar-voz` antes de escrever.

Antes de atualizar, preserve fora do cache qualquer perfil que você tenha personalizado. Atualize os consumidores para o novo nome; não há alias.

## 0.4.4

- Perfil pessoal e `defaults.md` do Bragir seguem `<CODEX_HOME>` quando ele está definido e não vazio, como o runtime já fazia com os defaults; sem `CODEX_HOME`, vale `~/.codex/hefesto/bragir/`. Com `CODEX_HOME` explícito, arquivo ausente não cai na configuração real. Quem usa `CODEX_HOME` próprio deve colocar o perfil pessoal em `<CODEX_HOME>/hefesto/bragir/perfil-de-voz.md`.

## 0.4.3

- Analisar-voz oferece agendamento local opt-in após análise. Referência portátil traz prévia/consentimento, limites do agendador, fallback manual e rotina isolada com PR, sem instalar ou configurar automaticamente nem disparar teste sem autorização.

## 0.4.2

- Unifica escolha entre perfis locais concorrentes: configuração explícita preserva prioridade; sem ela, dois perfis preenchidos exigem escolha reutilizada na sessão e workspace. Escolher não autoriza sobrescrita nem edição de defaults; scaffold continua destino possível de análise.

## 0.4.1

- Runtime resolve defaults pelo CODEX_HOME explícito, sem fallback à configuração real em sessões isoladas.

## 0.4.0 (2026-11-02)

- `planejar-agenda` mostra a tabela que vai gravar e pede ok antes de escrever no calendário. O pedido de planejar não conta mais como autorização para gravar.
- A prévia só é dispensada quando o usuário diz explicitamente, na sessão, que pode gravar sem mostrar. A mudança de status nos rascunhos segue a mesma confirmação.
- `analisar-voz` grava no `local_voz` resolvido pela regra única: `local_voz` do `AGENTS.md`, `local_voz` dos defaults Codex se você já o configurou, perfil existente no workspace e, como default documentado, o perfil pessoal `~/.codex/hefesto/bragir/perfil-de-voz.md`, fora do pacote. Antes de sobrescrever um perfil existente, anuncia o destino e de qual nível ele veio e pede ok.
- `analisar-voz` não registra mais `local_voz` nos defaults: o registro fazia o perfil pessoal prevalecer sobre o perfil de todo projeto sem `local_voz` no `AGENTS.md`. Se você registrou e quer que o perfil do projeto volte a valer, remova a linha `local_voz` de `~/.codex/hefesto/bragir/defaults.md`; o perfil pessoal continua lido no nível 4.
- `escrever-como-autor`, `revisar-naturalidade` e `analisar-metricas` leem o perfil pessoal antes da reserva empacotada `shared/perfil-de-voz.md`, que é somente leitura e anunciada quando usada.
- Antes de atualizar, se você editou à mão o `shared/perfil-de-voz.md` do pacote instalado, copie-o para `~/.codex/hefesto/bragir/perfil-de-voz.md` ou para o `local_voz` do projeto: a atualização substitui o pacote. Quem já atualizou sem copiar refaz a análise com as amostras.
- Decisão 19A do dono (2026-11-03): o `RUNTIME.md` ganha a seção "Perguntas ao usuário". Não se pergunta o que dá para verificar por leitura ou comando, o trabalho que não depende da resposta vem antes, a pergunta necessária é curta e completa, fecha a mensagem e encerra o turno, e nada continua executando depois dela; regra de pergunta da skill ou do contrato de domínio se soma. Teste que trava a instrução escrita (não o comportamento): `codex/tests/runtime-pergunta.test.mjs`, que lê o RUNTIME de cada pacote do marketplace Codex.
- Revisão da decisão 19A (2026-11-03): a regra restringe o fim do turno à pergunta direta; pela ferramenta de interação da sessão a resposta volta no mesmo turno, e nada continua executando antes de ela chegar. Sem a ressalva, a seção contradizia a linha do mesmo `RUNTIME.md` que oferece perguntar pela ferramenta de interação ou por pergunta direta, e proibia seguir depois da resposta. Caso novo por pacote em `codex/tests/runtime-pergunta.test.mjs`.

## 0.3.1 — 2026-10-23

- Revisão de portfólio pela ótica de contratação incorporada à curar-portfolio, adaptada de pd-portfolio-review (Leonardo Betti, MIT), com origem fixada e licença preservada.
- Rubrica de sete áreas, cobertura explícita, evidências por achado e até cinco melhorias verificáveis; avaliação parcial sem nota total e sem inferir IA pelo estilo.
- Contexto do workspace reutilizado; curadoria sem URL preservada. Dados da pesquisa exigem conferência antes de citação.

## 0.3.0 — 2026-10-05

- Nova skill nativa `revisar-naturalidade` e integração com a escrita de artigos e posts.
- Revisão preserva fatos, opiniões e incertezas; falta de perfil autoral é anunciada.
- Análise de voz registra fontes de publicações e distingue canais e legendas autorais de textos de terceiros.
- Reinicie a sessão após atualizar o plugin para carregar a nova skill.

## 0.2.1 — 2026-09-26

- Candidaturas autorizadas: escopo, responsável, dados pendentes, verificação de anexos e recibos, reconciliação antes de repetir envio.
- Busca preserva IDs, exclusões e board existente; distingue acesso indisponível, vaga encerrada e resultado do processo.
- Capa do LinkedIn com fonte aprovada, recorte e verificação visual; memória corrente separada de histórico.
- Ajustes compatíveis das skills existentes; sem novas skills ou dados pessoais de processos no pacote.

## 0.2.0 — 2026-09-20

- Seis skills de carreira e comunicação: perfil profissional, vagas, LinkedIn, portfólio, candidatura e direção visual.
- Contrato de fontes, versões e continuidade do workspace; propostas separadas de efeitos externos.
- Escrita, voz, personas e fluxo editorial existentes preservados; carreira é opcional.
- Esta versão requer nova instalação/recarga para disponibilizar as skills; validação registrada no plano interno, sem alegar efeitos em contas reais.

## 0.1.2

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público; pacote autocontido e política nativa de modelos preservados.

O fallback de voz pessoal continua incluído e anunciado; a descrição deixa de chamá-lo de privado.

## 0.1.1 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.
