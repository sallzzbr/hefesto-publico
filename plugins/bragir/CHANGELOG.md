# Changelog — bragir

## 2.0.0

Perfil de voz pertence ao usuário. A skill de escrita passa a `escrever-como-autor`, sem perfil pessoal empacotado nem fallback de outra pessoa. Sem perfil preenchido, ofereça `analisar-voz` antes de escrever.

Antes de atualizar, preserve fora do cache qualquer perfil que você tenha personalizado. Atualize os consumidores para o novo nome; não há alias.

> Histórico anterior à 1.2.4 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 1.5.2

- Analisar-voz oferece agendamento local opt-in após análise. Referência portátil traz prévia/consentimento, limites do agendador, fallback manual e rotina isolada com PR, sem instalar ou configurar automaticamente nem disparar teste sem autorização.

## 1.5.1

- Unifica escolha entre perfis locais concorrentes: configuração explícita preserva prioridade; sem ela, dois perfis preenchidos exigem escolha reutilizada na sessão e workspace. Escolher não autoriza sobrescrita nem edição de defaults; scaffold continua destino possível de análise.

## 1.5.0 (2026-11-02)

- **Antes de atualizar**, se você personalizou o perfil de voz dentro do plugin (o override antigo de `analisar-voz` gravava em `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md`): com a versão antiga ainda instalada, peça ao Claude para copiar o `perfil-de-voz.md` do plugin para `~/.claude/bragir/perfil-de-voz.md`, ou para o `local_voz` do projeto. A própria atualização substitui a cópia instalada e apaga o perfil personalizado. Quem já atualizou sem copiar refaz a análise com as amostras em `analisar-voz`.
- `analisar-voz` grava no `local_voz` resolvido pela regra única: (1) `local_voz` no `## Paths do workspace` do `CLAUDE.md` do repo; (2) `local_voz` em `~/.claude/bragir/defaults.md`, se você já o configurou; (3) perfil existente no cwd (`./perfil-de-voz.md`, `./voz/perfil-de-voz.md` ou o legado `./voice-profile.md`); (4) default documentado, o perfil pessoal `~/.claude/bragir/perfil-de-voz.md`, fora do plugin.
- Sem perfil no projeto, `analisar-voz` passa a gravar no perfil pessoal em vez de criar `./perfil-de-voz.md`; para o perfil de um projeto, peça explicitamente. Antes de sobrescrever um perfil existente, a skill anuncia o destino e de qual nível ele veio e pede ok.
- `analisar-voz` não registra `local_voz` nos defaults: o registro faria o perfil pessoal prevalecer sobre o perfil de todo projeto sem `local_voz` no `CLAUDE.md`.
- `escrever-como-autor`, `revisar-naturalidade` e `analisar-metricas` leem o perfil pessoal (nível 4) antes da reserva do plugin. `analisar-metricas` só acrescenta aprendizados a um perfil que já exista na cadeia.
- O `perfil-de-voz.md` do plugin vira reserva somente leitura, usada depois do nível 4 e anunciada quando usada. Nenhuma skill grava nele.
- Em sessão de nuvem, `~/.claude` não persiste entre sessões: `analisar-voz` avisa e oferece gravar o perfil no projeto.

## 1.4.1 — 2026-10-23

- Revisão de portfólio pela ótica de contratação incorporada à curar-portfolio, adaptada de pd-portfolio-review (Leonardo Betti, MIT), com origem fixada e licença preservada.
- Rubrica de sete áreas, cobertura explícita, evidências por achado e até cinco melhorias verificáveis; avaliação parcial sem nota total e sem inferir IA pelo estilo.
- Contexto do workspace reutilizado; curadoria sem URL preservada. Dados da pesquisa exigem conferência antes de citação.

## 1.4.0 — 2026-10-05

- Nova skill `revisar-naturalidade`, com revisão de ritmo, clareza e fidelidade à voz sem inventar fatos ou prometer aprovação por detector de IA.
- Artigos e posts passam pela revisão antes da entrega; perfis pessoais continuam no workspace.
- Análise de voz aceita publicações acessíveis, registra procedência e separa canais e textos de terceiros.
- Reinicie a sessão após atualizar o plugin para carregar a nova skill.

## 1.3.1 — 2026-09-26

- Candidaturas autorizadas: escopo, responsável, dados pendentes, verificação de anexos e recibos, reconciliação antes de repetir envio.
- Busca preserva IDs, exclusões e board existente; distingue acesso indisponível, vaga encerrada e resultado do processo.
- Capa do LinkedIn com fonte aprovada, recorte e verificação visual; memória corrente separada de histórico.
- Ajustes compatíveis das skills existentes; sem novas skills ou dados pessoais de processos no pacote.

## 1.3.0 — 2026-09-20

- Seis skills de carreira e comunicação: perfil profissional, vagas, LinkedIn, portfólio, candidatura e direção visual.
- Contrato de fontes, versões e continuidade do workspace; propostas separadas de efeitos externos.
- Escrita, voz, personas e fluxo editorial existentes preservados; carreira é opcional.
- Esta versão requer nova instalação/recarga para disponibilizar as skills; validação registrada no plano interno, sem alegar efeitos em contas reais.

## 1.2.5 — 2026-09-05 (preparação para teste Claude)

- Perfil de voz selecionado passa a governar toda a composição, audiência e formato, sem regras pessoais misturadas ao perfil do projeto. Fallback privado preservado.
- `name` explícito em todas as skills, alinhado ao diretório.

## 1.2.4 — 2026-09-02 (changelog)

- CHANGELOG novo. O gate de bump do marketplace (`scripts/verificar-bump.mjs`) passa a cobrar
  entrada aqui a cada versão. Sem mudança de comportamento nas skills.
