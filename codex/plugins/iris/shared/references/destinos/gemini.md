---
destino: gemini
aplicaA: "Modelos Gemini (Google) — sem orientação específica de modelo verificada nesta versão"
consultadoEm: 2026-11-01
revisarAte: 2026-12-01
fontes: [G1, G2]
---

# Destino: Gemini (Google)

**Cobertura limitada.** A página oficial de estratégias de prompting
(`ai.google.dev/gemini-api/docs/prompting-strategies`) e os guias por modelo não estavam
acessíveis no ambiente da consulta. O que há aqui vem do cookbook oficial do Google no GitHub,
que lista técnicas genéricas e os modelos em destaque [G1][G2]. Por isso o prazo de revisão é
curto e a skill trata este destino como **portátil com técnicas genéricas**.

## O que o cookbook oficial mostra

- Técnicas demonstradas para a API Gemini: contexto adicional, prefixos para estruturar entrada
  e saída, exemplos (few-shot), papel, casos-base, cadeia de raciocínio e extração em formato
  definido [G1].
- Orientação geral do próprio cookbook: experimentar e iterar [G1].
- Modelos em destaque na data: Gemini 3.8 Flash (agentes e engenharia de software de longo
  prazo) e Gemini 3.5 Flash-Lite (alto volume) [G2].

## Como a skill usa este cartão

- Escreva a versão portátil (`desconhecido.md`) e, quando formato importa, acrescente exemplos
  e prefixos de estrutura.
- Não recomende configuração (raciocínio, temperatura) nem bloco de comportamento específico de
  modelo Gemini: não há fonte verificada nesta versão.
- Diga ao usuário que a orientação Gemini é genérica e sugira conferir a página oficial.

## Incertezas

- Sem leitura da orientação vigente do Google para os modelos 3.x; qualquer regra específica
  seria suposição.
