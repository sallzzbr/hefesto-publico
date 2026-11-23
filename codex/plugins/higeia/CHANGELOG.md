# Changelog

## 0.5.0 — 2026-11-23

- Confere a busca semântica do Claude-Mem, testa o erro de cada ambiente Chroma do uv e gera o plano de simuladores por modelo, versão e identificador.

## 0.4.0 — 2026-11-22

- Investiga ambientes arquivados pelo uv em leitura com evidência de vínculos, arquivos abertos e composição. A skill avalia o fluxo real de teste ao propor quais simuladores manter.

## 0.3.1 — 2026-11-22

- Refina a triagem de simuladores pelo histórico de inicialização, apps e contêineres observados. Distingue ferramentas instaladas com uv de ambientes encontrados no cache.

## 0.3.0 — 2026-11-22

- Nova skill `limpar-desenvolvimento` para medir caches e versões anteriores de simuladores no macOS. Mostra por categoria os GB e o percentual do volume, com revisão separada dos dados dos dispositivos.

## 0.2.0 — 2026-11-22

- Mede o potencial condicional em bytes e em percentual da capacidade de cada volume. O modo `espaco` consolida diagnósticos e raízes sobrepostas.

## 0.1.0

- Diagnóstico em leitura de skills e plugins, branches, worktrees e diretórios de execução. Contexto do Munin opcional por projeto e branch.
