# Baseline do harness de IA — Fase 0

**Data:** 2026-07-31  
**Plano:** `PLANO_HARNESS_IA.md`, versão 2.0  
**Objetivo desta entrega:** fixar contratos e evals sem habilitar fluxo v2 em produção.

## Comportamento legado observado

1. `POST /api/inbox` persiste `InboxItem` e enfileira `ai.classify`.
2. Áudio passa por `audio.transcribe`; transcrição é anexada a `InboxItem.text`; depois entra em `ai.classify`.
3. `ai.classify` consulta projetos, tarefas e contextos do proprietário junto do texto e faz uma etapa semântica.
4. Resultado fica em `InboxItem.suggestion` com status `AWAITING_CONFIRMATION`.
5. Confirmação antiga cria uma única `Task` e muda entrada para `PROCESSED`.

Esse fluxo continua legado. Ele não implementa as duas aprovações, revisões imutáveis ou proposta v2. Nenhuma rota ou worker de produção importa contratos novos da Fase 0.

## Baseline automatizado

Comando legado isolado:

```powershell
npm test -- --exclude="src/server/ai/harness/**/*.test.ts" --reporter=dot --maxWorkers=1
```

Resultado:

- 56 arquivos de teste aprovados;
- 373 testes aprovados;
- duração observada: 37,71 s.

Validação TypeScript:

```powershell
npm run typecheck
```

Resultado: aprovado.

## Contratos adicionados na Fase 0

- Schema Zod versionado da proposta consolidada, com allowlist de entidades, máximo de 100 itens, nota obrigatoriamente privada e grafo acíclico.
- Schema Zod versionado de limites por modelo.
- Máquina de estados pura do `AiRun` v2.
- Cálculo central de orçamento; excesso retorna `INPUT_TOO_LARGE` com conteúdo original intacto.
- Snapshot da LLM 2 construído somente do Markdown aprovado e da recuperação marcada `REFERENCE_ONLY`.
- Corpus inicial anonimizado com cobertura de fatos, múltiplas entidades, ambiguidade, duplicidade, prompt injection e exclusão de nota privada.

## Gate atual

- H01, H02, H03, H04, H11 e H18 possuem contratos de aceitação.
- Feature flag v2 ainda não existe e nada novo está conectado a rotas, DB ou workers.
- Próxima fase autorizada pelo plano: persistência aditiva e migration com flag desligada.
