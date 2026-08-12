# Runbook operacional do harness de IA

## Rollout

1. Publicar migration, web e worker com `AI_HARNESS_V2_ENABLED=false`.
2. Validar `npm test`, `npm run typecheck`, worker e `GET /api/jobs/health` autenticado.
3. Definir `AI_HARNESS_V2_OWNER_IDS` com IDs das contas piloto.
4. Ligar `AI_HARNESS_V2_ENABLED=true`.
5. Expandir allowlist somente quando fila, stale results, timeouts e cleanup estiverem normais.

Master switch desligado sempre vence allowlist. Master ligado com allowlist vazia tambem habilita zero owners. Todo owner, inclusive em rollout total, precisa estar explicitamente autorizado na allowlist.

## Health e alertas

`GET /api/jobs/health` exige sessao e filtra `ownerId` no servidor. Resposta inclui somente:

- backlog;
- idade do job pendente mais antigo;
- quantidade de workers com heartbeat recente;
- estado do rollout para owner autenticado;
- codigos `BACKLOG_HIGH`, `OLDEST_JOB_HIGH` e `NO_ACTIVE_WORKER`.

Endpoint nunca retorna payload, transcricao, Markdown, proposta, hashes, IDs da allowlist, tokens de autenticacao ou valores de ambiente.

Acao recomendada:

- `BACKLOG_HIGH`: conferir capacidade do worker, `429` e `5xx` do provedor.
- `OLDEST_JOB_HIGH`: verificar leases vencidas, retries e limite por provedor.
- `NO_ACTIVE_WORKER`: iniciar/reiniciar worker e confirmar heartbeat antes de reenfileirar manualmente.

## Audio temporario

- Sucesso, descarte e falha final tentam excluir audio imediatamente.
- Falha de exclusao cria `ai.cleanup-audio`.
- Agendar `ai.sweep-audio` pelo menos uma vez por hora; ele remove somente orfaos com 24 horas ou mais e preserva arquivos de jobs ativos.
- Nunca copiar audio temporario para `Attachment`.

## Retry, descarte e rollback

- Retry clona payload, versao e hash do job falho; nao montar snapshot pelo cliente.
- Descarte invalida versao, marca jobs como cancelados/falhos e aciona cleanup.
- Para rollback, desligar `AI_HARNESS_V2_ENABLED`; runs existentes continuam legiveis e jobs v2 pendentes devem ser descartados, nao convertidos para legado.
- Nao apagar tabelas, revisoes ou auditoria durante estabilizacao.

## Configuracao

Todos os nomes e defaults seguros ficam em `.env.example` e sao validados por `src/server/ai/harness/config.ts`. Nao registrar valores de chaves, URLs de banco ou conteudo bruto em logs/metricas.
