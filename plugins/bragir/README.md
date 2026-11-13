# Bragir

> Paths de workspace citados neste README resolvem pela regra única do plugin
> (`skills/analisar-metricas/SKILL.md` e `skills/gerenciar-personas/SKILL.md`: CLAUDE.md do
> workspace → defaults `local_*` do usuário → convenção descoberta no cwd → default
> documentado); os literais abaixo são ilustrativos do default, não hardcode.

> Plugin de voz, escrita, editorial e carreira. As capacidades de carreira são opcionais e não alteram a escrita em outros projetos. O nome vem de Bragi, o deus nórdico da poesia e da eloquência — aqui moram as skills que escrevem na voz do autor, calibram para cada audiência e operam o ciclo editorial de um workspace de conteúdo.

Até a v2.x do marketplace, as skills de voz viviam no plugin `hefesto`. Migraram para cá quando o hefesto virou a forja de plugins. As skills editoriais (`planejar-agenda`, `analisar-metricas`) nasceram como comandos do workspace bragir e foram promovidas ao plugin.

## Skills

| Skill | O que faz |
|---|---|
| `escrever-como-autor` | Escreve na voz do autor. Resolve o perfil na ordem `local_voz` (CLAUDE.md do workspace) → `local_voz` (`~/.claude/bragir/defaults.md`, se configurado) → `./perfil-de-voz.md` (projeto) → `./voz/perfil-de-voz.md` (workspace de conteúdo) → `./voice-profile.md` (nome legado, só leitura) → `~/.claude/bragir/perfil-de-voz.md` (perfil pessoal, default documentado). Perfil só-scaffold (placeholders) conta como ausente. Descobre personas em `./personas/`. |
| `analisar-voz` | Analisa documentos e publicações acessíveis, registra procedência e diferenças entre canais e grava o perfil no `local_voz` resolvido pela mesma cadeia, até o perfil pessoal `~/.claude/bragir/perfil-de-voz.md`, nunca no plugin. Antes de sobrescrever um perfil existente, anuncia destino e nível e pede ok. Para DOCX, requer leitor compatível com o runtime. |
| `revisar-naturalidade` | Revisa um rascunho quanto a ritmo, clareza e fidelidade à voz, preservando fatos e incertezas. Pode ser chamada isoladamente e integra a escrita de artigos e posts. Sem perfil do autor, anuncia o limite da calibração. |
| `gerenciar-personas` | Cria, lista e edita personas de audiência em `./personas/` do projeto atual. |
| `planejar-agenda` | Planeja o ciclo do calendário editorial (12 slots, 3 posts/semana, 4 semanas) a partir de ideias e rascunhos. Opera sobre `./agenda/calendario.md` do workspace; sem a estrutura, PARA. |
| `analisar-metricas` | Analisa o CSV de métricas do workspace, ranqueia posts, aponta padrões e gera relatório datado; propõe aprendizados para o perfil de voz. Só leitura no CSV; sem a estrutura, PARA. |
| `mapear-perfil-profissional` | Mapear Perfil Profissional. |
| `avaliar-vagas` | Avaliar Vagas. |
| `revisar-linkedin` | Revisar LinkedIn. |
| `curar-portfolio` | Curadoria de cases e revisão por URL pela ótica de contratação, com evidências, rubrica e melhorias prioritárias. |
| `preparar-candidatura` | Preparar Candidatura. |
| `direcionar-comunicacao-visual` | Direcionar Comunicação Visual. |

## Instalação

    /plugin marketplace add sallzzbr/hefesto-publico
    /plugin install bragir@hefesto

## Contratos

- **Personas são do projeto**, nunca do plugin: `./personas/<nome>.md` (preferido) ou `./personas.md` (fallback).
- **Perfil de voz é do projeto** quando existe (`./perfil-de-voz.md`, ou `./voz/perfil-de-voz.md` em workspaces de conteúdo); sem ele, vale o perfil pessoal `~/.claude/bragir/perfil-de-voz.md`. Sem perfil preenchido, a escrita para e oferece `analisar-voz`.
- **O pacote não contém perfil de voz.** A cópia instalada é substituída a cada atualização, então nenhuma skill grava nela. `analisar-voz` grava no `local_voz` resolvido e, sem nenhum nível anterior, no perfil pessoal `~/.claude/bragir/perfil-de-voz.md`, que as skills de escrita leem sem registro nos defaults; a skill não registra `local_voz` nos defaults, porque ele prevaleceria sobre o perfil de todo projeto. Em sessão de nuvem, `~/.claude` não persiste entre sessões: só o perfil gravado no projeto sobrevive.
- Projetos com `./voice-profile.md` legado continuam funcionando; as skills oferecem renomear, nunca renomeiam sozinhas.

## Consumidores conhecidos

- **mimyr** (pipeline de cursos) — usa as skills de voz e personas para os cursos.
- **bragir** (workspace de carreira e conteúdo, repo homônimo) — usa as skills de voz para posts e as editoriais (`planejar-agenda`, `analisar-metricas`) para o ciclo.

## Carreira e comunicação

Comece pela entrega necessária: retomar LinkedIn não exige vaga nem perfil completo. `mapear-perfil-profissional` organiza contexto quando útil; as demais skills funcionam independentemente. O workspace guarda fontes, propostas e continuidade; o plugin não distribui experiências ou candidaturas pessoais. Portfólios externos permanecem em seus repositórios canônicos.

Exemplos: “retome a revisão do meu LinkedIn”, “avalie esta vaga contra meu perfil”, “selecione cases para esta oportunidade”, “prepare minha candidatura sem enviar”, “defina a direção visual desta apresentação”. Busca depende de acesso à web; alterações em plataformas e produção visual dependem das ferramentas do executor. Ausência dessas ferramentas não impede entregar conteúdo revisável.

## Revisão de portfólio

Peça “avalie meu portfólio pela ótica de contratação” ou forneça uma URL à `curar-portfolio`. O fluxo reutiliza objetivo e fontes do workspace, distingue evidência visual de texto extraído e entrega até cinco melhorias com critérios de conclusão. A nota de 0 a 100 só aparece com cobertura suficiente e usa pesos heurísticos.

Método adaptado de [pd-portfolio-review](https://github.com/leonardobetti/pd-portfolio-review), de Leonardo Betti (MIT). [Origem, alterações e licença](skills/curar-portfolio/references/origem-e-licenca.md). A pesquisa UXfolio 2026 informa os critérios; as estatísticas herdadas exigem conferência da fonte antes de citação.
