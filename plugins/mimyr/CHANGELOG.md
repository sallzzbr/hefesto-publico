# Changelog — mimyr

## 1.1.14 (2026-11-10)

Higiene do espelho público: resíduos de nome removidos do CHANGELOG e do teste de contrato. Sem mudança de comportamento das skills.

## 1.1.13

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

> Histórico anterior à 1.1.6 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 1.1.12

- Respeita templates e Python resolvidos, delimita correções por capítulo e recusa verde com falhas.

- Falha mecânica com campo extra `capitulo` não desvia o roteamento por arquivo nem oculta falha fora do escopo.

## 1.1.11 — 2026-11-01

- **Perfil fora do enum não cai mais em silêncio no econômico.** "Máximo" (acento/caixa) é normalizado; valor desconhecido é erro de args antes de qualquer agente. Antes, um typo rodava com 1 lente e escritores sequenciais e fechava verde sem registro (achado MIMYR-01 da revisão geral de 2026-11-01).

## 1.1.10 — 2026-09-11

- Revisão de acessibilidade usa melhorar_a11y.py --dry-run: mostra alterações propostas sem escrever no original. A aplicação explícita mantém o modo de correção e idempotência; opção inválida é recusada antes de escrever.

## 1.1.9 — 2026-09-09

- Geração valida objetivo, critérios, IDs e destinos disjuntos antes dos escritores. Relatos de escrita exigem path lexical completo e base explícita; workspaceRoot resolve bases relativas/absolutas. Limite físico de symlinks e efeitos omitidos permanece explícito.

## 1.1.8 — 2026-09-06 (correções dos testes Codex)

- Sincronização do índice preserva a duração de cursos curtos, sem arredondar tempo positivo para zero; reaplicação permanece idempotente.

## 1.1.7 — 2026-09-05 (preparação para teste Claude)

- Sidebar valida todos os índices e destinos antes da primeira escrita; recusa caminhos inseguros e destinos inválidos, preservando idempotência.
- `name` explícito em todas as skills, alinhado ao diretório.

## 1.1.6 — 2026-09-02 (harness com teto de concorrência e relatório honesto)

Correções da auditoria adversarial de 2026-09-01.

- **Teto de concorrência** no harness `curso.mjs`: `PARALELO_MAX = 4` escritores simultâneos
  nos perfis paralelos (antes, um curso de 12 capítulos disparava 12 escritores de uma vez).
- **Relatório de modelo efetivo por execução** (`registrarExec`), portado do hermes 1.0.1:
  fallback tardio não re-rotula step que já rodou no tier certo.
- `scripts/checar_svg_overflow.py`: a ajuda embutida mandava rodar `tools/…`; o arquivo vive
  em `scripts/`.
- README: o link do repositório de origem apontava para o perfil do GitHub (repo privado).
