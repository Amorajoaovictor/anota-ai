# Plano completo do harness de IA

**Versão:** 2.0

**Status:** pronto para execução por fases

**Escopo:** entrada em texto ou áudio, organização em Markdown, revisão humana, proposta estruturada, segunda aprovação e criação transacional de entidades

**Aplicação:** Central de Projetos

## 1. Objetivo

Construir fluxo rápido, rastreável e seguro para transformar texto ou áudio em entidades do sistema sem permitir escrita direta do modelo no banco.

Fluxo possui duas etapas semânticas de LLM depois da transcrição:

1. Organizar conteúdo em Markdown editável sem perder informação.
2. Transformar snapshot aprovado em proposta única, estruturada e editável.

Retry técnico pode repetir mesma etapa. Retry não cria terceira etapa semântica nem modelo avaliador oculto.

## 2. Decisões fechadas

- [x] Transcrição recebe somente áudio e metadados técnicos necessários.
- [x] LLM 1 não consulta projetos, contextos, tags, notas, tarefas ou dicionários.
- [x] LLM 1 organiza sem perda. Resumo, quando exibido, é campo separado e nunca substitui conteúdo organizado.
- [x] Markdown aprovado é única fonte autoritativa de intenção e conteúdo novo para LLM 2.
- [x] Transcrição original não volta para LLM 2.
- [x] Usuário aprova conteúdo antes de contextualização e aprova entidades antes de qualquer escrita.
- [x] Uma entrada produz uma proposta consolidada, não várias solicitações de aprovação.
- [x] Um tópico pode gerar zero, uma ou várias entidades relacionadas.
- [x] `Task`, `Meeting`, `Note` e `Milestone` são entidades de negócio separadas.
- [x] Card é componente visual compartilhado, não entidade de domínio.
- [x] Projetos, aliases, módulos, tags, contextos e dependências podem aparecer como ações auxiliares.
- [x] Modelo nunca cria usuário, pessoa ou credencial.
- [x] Toda ação gerada por IA passa pela aba `Revisão IA`.
- [x] Execução aprovada é atômica na primeira versão: tudo confirma ou nada confirma.
- [x] Busca exata e full-text fazem parte da primeira versão.
- [x] Busca vetorial e `pgvector` ficam fora da primeira versão até eval demonstrar necessidade.
- [x] Notas privadas existentes nunca entram em busca, embedding ou prompt.
- [x] Nota criada por este fluxo nasce privada e não vira contexto futuro automaticamente.
- [x] Correção manual é registrada, mas não vira aprendizado automático na primeira versão.
- [x] Áudio temporário é apagado após transcrição, descarte ou falha final.
- [x] Primeira versão aceita somente entradas que caibam integralmente no contexto configurado. Não haverá chunking oculto.
- [x] Entrada grande demais é preservada e recebe erro acionável; nunca é truncada silenciosamente.
- [x] Arquitetura continua preparada para chunking futuro sem mudar contratos de aprovação.

## 3. Fora de escopo inicial

- Multiagentes.
- Autonomia irrestrita.
- Escrita direta do LLM no banco.
- Ferramentas de escrita durante análise.
- Terceiro modelo para revisar LLM 2.
- Chunking de transcrição em várias chamadas.
- Busca vetorial.
- Treinamento ou fine-tuning automático com correções.
- Uso de notas privadas como contexto.
- Execução parcial da proposta.
- Atualização ou exclusão automática de entidades existentes.
- Agente desenvolvedor e alterações de código.

## 4. Fluxo final

```mermaid
flowchart LR
    A["Texto ou áudio"] --> B["Captura persistida"]
    B --> C{"Áudio?"}
    C -->|Sim| D["Transcrição isolada"]
    C -->|Não| E["Snapshot do texto"]
    D --> E
    E --> F["Validação de tamanho"]
    F --> G["LLM 1: organizar sem perda"]
    G --> H["Markdown visual editável"]
    H --> I["Aprovação 1"]
    I --> J["Snapshot imutável"]
    J --> K["Busca exata e full-text"]
    K --> L["LLM 2: proposta consolidada"]
    L --> M["Validação estrutural"]
    M --> N["Preview editável"]
    N --> O["Aprovação 2"]
    O --> P["Revalidação de autorização"]
    P --> Q["Execução transacional"]
    Q --> R["Entidades + origem + auditoria"]
```

## 5. Limites de entrada

### 5.1 Regra de contexto

Antes de chamar provedor, sistema calcula orçamento real:

```text
entrada máxima = janela do modelo
               - prompt de sistema
               - saída reservada
               - referências reservadas
               - margem de segurança
```

Valores ficam versionados por modelo e ambiente. Nenhum limite fica espalhado em componentes ou rotas.

### 5.2 Comportamento da primeira versão

- Contar tokens antes de LLM 1 e antes de LLM 2.
- Impedir aprovação de Markdown que não caiba junto do orçamento mínimo de referências e saída.
- Nunca cortar transcrição, Markdown, tópico ou referência no meio.
- Quando entrada exceder limite, registrar `INPUT_TOO_LARGE`, manter conteúdo intacto e orientar divisão em novas entradas.
- Registrar tamanho em bytes, caracteres e tokens sem registrar conteúdo em log.
- Manter limites de upload, duração de áudio, Markdown e quantidade de itens em configuração central.
- Limitar proposta a no máximo 100 itens. Entrada maior deve ser dividida.

### 5.3 Evolução futura

Chunking poderá entrar somente como nova versão do harness. Deve manter:

- duas etapas semânticas;
- snapshot único aprovado;
- ausência de perda ou duplicação entre chunks;
- evidência ligada ao snapshot final;
- custo e quantidade de chamadas visíveis em auditoria técnica.

## 6. Entidades e cardinalidade

### 6.1 Entidades principais

- `Task`: exige projeto.
- `Meeting`: projeto opcional.
- `Note`: exige projeto e nasce privada.
- `Milestone`: exige projeto.

### 6.2 Ações auxiliares permitidas

- Criar projeto quando conteúdo aprovado pedir projeto novo explicitamente.
- Criar alias, módulo ou tag.
- Criar contexto aprovado.
- Criar dependência entre tasks.
- Vincular task e milestone.

### 6.3 Regras

- Um tópico pode gerar várias entidades.
- Uma entidade pode usar evidências de vários tópicos.
- Cada tópico sem entidade recebe `UNRESOLVED` com motivo.
- Reunião pode gerar `Meeting`, tasks, notes e contexts relacionados.
- Relação entre ações usa IDs locais da proposta antes de existirem IDs de banco.
- Dependência só pode ligar tasks diferentes do mesmo projeto.
- Milestone e task vinculados devem pertencer ao mesmo projeto.
- Referência existente precisa constar no snapshot de busca e pertencer ao proprietário.
- Conteúdo de referência define vínculo; nunca cria fato ausente no Markdown.

## 7. Persistência versionada

`InboxItem` continua representando captura. Fluxo novo usa modelos próprios; `suggestion` não será fonte do harness v2.

### 7.1 `AiRun`

Representa uma execução completa do harness.

Campos mínimos:

- `id`.
- `ownerId`.
- `inboxItemId`.
- `status`.
- `version` para concorrência otimista.
- `failedStep` opcional.
- `errorCode` opcional.
- `retryable`.
- `activeTranscriptId`.
- `activeMarkdownRevisionId`.
- `activeProposalRevisionId`.
- `createdAt`, `updatedAt`, `discardedAt`, `processedAt`.

Índices:

- `[ownerId, createdAt]`.
- `[status, updatedAt]`.
- `[inboxItemId, createdAt]`.

### 7.2 `TranscriptRevision`

- `id`, `aiRunId`, `version`.
- `text`.
- `contentHash`.
- `source`: `TEXT` ou `STT`.
- `provider`, `model`, `language` opcionais.
- `durationMs`, `inputBytes`, `tokenCount`.
- `speakerSegments` e `timestamps` opcionais.
- `createdAt`.
- Unique `[aiRunId, version]`.

Reprocessar com outro provedor cria nova revisão; nunca sobrescreve anterior.

### 7.3 `MarkdownRevision`

- `id`, `aiRunId`, `version`.
- `parentRevisionId` opcional.
- `source`: `AI` ou `USER`.
- `content`.
- `contentHash`.
- `tokenCount`.
- `promptVersion` e `model` quando gerada por IA.
- `approvedAt` opcional.
- `createdAt`.
- Unique `[aiRunId, version]`.

Markdown aprovado fica imutável. Mudança posterior cria nova revisão e invalida artefatos derivados.

### 7.4 `RetrievalSnapshot`

- `id`, `aiRunId`, `markdownRevisionId`.
- `queryVersion`.
- `contentHash`.
- candidatos ordenados, motivos e scores em JSON validado.
- IDs, tipos, versões e trechos mínimos das referências.
- `createdAt`.

Snapshot permite reproduzir proposta sem consultar estado atual novamente.

### 7.5 `ProposalRevision`

- `id`, `aiRunId`, `markdownRevisionId`, `retrievalSnapshotId`.
- `version`, `parentRevisionId` opcional.
- `source`: `AI` ou `USER`.
- `schemaVersion`.
- `rawOutput` somente com política de acesso restrita.
- `validatedPlan`.
- `contentHash`.
- `promptVersion`, `provider`, `model`.
- `inputTokens`, `outputTokens`, `latencyMs`.
- `approvedAt` opcional.
- `createdAt`.
- Unique `[aiRunId, version]`.

### 7.6 `ProposalItem`

- `id`, `proposalRevisionId`.
- `localKey` estável dentro da proposta.
- `entityType`.
- `operation`, inicialmente somente `CREATE` e `LINK`.
- `payload` validado.
- `dependsOn`.
- `evidence`.
- `confidence` por campo.
- `duplicateCandidates`.
- `selected`.
- `userEdited`.
- `createdAt`.
- Unique `[proposalRevisionId, localKey]`.

### 7.7 `AiApproval`

- `id`, `aiRunId`, `ownerId`.
- `type`: `MARKDOWN` ou `ENTITIES`.
- `targetId` e `targetHash`.
- `createdAt`.
- Unique `[type, targetId]`.

Aprovação sempre aponta para conteúdo exato, nunca para “versão atual” mutável.

### 7.8 `AiExecution`

- `id`, `aiRunId`, `proposalRevisionId`.
- `status`: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`.
- `idempotencyKey` única.
- `startedAt`, `completedAt`, `errorCode`.
- Unique `[proposalRevisionId]`.

### 7.9 `EntityOrigin`

- `id`, `proposalItemId`.
- `entityType`, `entityId`.
- `createdAt`.
- Unique `[entityType, entityId]`.

Executor cria entidade e origem na mesma transação.

### 7.10 `AiCallAttempt`

- etapa, tentativa, provedor, modelo e versão do prompt.
- hash da entrada e request ID do provedor.
- tokens, latência, custo estimado e resultado técnico.
- código de erro sanitizado.
- nenhum conteúdo bruto em log ou auditoria operacional.

## 8. Estados e transições

### 8.1 Estados

```text
RECEIVED
TRANSCRIBING
TRANSCRIBED
ORGANIZING
AWAITING_MARKDOWN_APPROVAL
RETRIEVING_REFERENCES
MATERIALIZING
AWAITING_ENTITY_APPROVAL
EXECUTING
PROCESSED
FAILED
DISCARDED
```

`FAILED` usa `failedStep`, `errorCode` e `retryable`; não perde etapa onde falhou.

### 8.2 Caminho normal

```text
Texto: RECEIVED -> TRANSCRIBED
Áudio: RECEIVED -> TRANSCRIBING -> TRANSCRIBED

TRANSCRIBED
-> ORGANIZING
-> AWAITING_MARKDOWN_APPROVAL
-> RETRIEVING_REFERENCES
-> MATERIALIZING
-> AWAITING_ENTITY_APPROVAL
-> EXECUTING
-> PROCESSED
```

### 8.3 Transições especiais

- Estado não terminal pode ir para `DISCARDED`.
- Falha técnica vai para `FAILED` somente após esgotar retries automáticos ou exigir ação do usuário.
- Retry volta exatamente para `failedStep`, usando mesmos snapshots.
- Editar Markdown ainda não aprovado cria revisão e mantém `AWAITING_MARKDOWN_APPROVAL`.
- Alterar Markdown já aprovado cria nova revisão, cancela jobs derivados e volta para `AWAITING_MARKDOWN_APPROVAL`.
- Editar preview cria nova `ProposalRevision` de origem `USER` e mantém `AWAITING_ENTITY_APPROVAL`.
- `PROCESSED` e `DISCARDED` são terminais.
- Reprocessamento completo cria novo `AiRun`; não reabre run terminal.

### 8.4 Concorrência

Toda mutação recebe `expectedVersion`. Update usa simultaneamente:

- `id`.
- `ownerId`.
- estado esperado.
- versão esperada.

Sucesso incrementa versão. Zero linhas alteradas retorna `409 STALE_VERSION`.

Job carrega `aiRunId`, etapa, versão esperada e hash de entrada. Antes e depois de chamada externa, job confirma que run continua na mesma versão. Resultado antigo é descartado e auditado como `STALE_RESULT`.

## 9. Idempotência

Chaves mínimas:

```text
transcribe:{runId}:{audioHash}:{provider}:{model}
organize:{runId}:{transcriptHash}:{promptVersion}:{model}
retrieve:{runId}:{markdownHash}:{queryVersion}
materialize:{runId}:{markdownHash}:{retrievalHash}:{promptVersion}:{model}
execute:{approvedProposalRevisionId}
```

Regras:

- Unique constraint protege cada chave.
- Clique repetido devolve execução existente.
- Retry de provedor pode gerar nova cobrança, mas nunca novo artefato ativo para mesma chave.
- Resultado só fica ativo após validação de versão e hash.
- Executor não usa somente status para deduplicar; usa `AiExecution.idempotencyKey`.

## 10. Contrato de erro e retry

Erro persistido e resposta pública usam:

```json
{
  "code": "PROVIDER_RATE_LIMITED",
  "step": "MATERIALIZING",
  "retryable": true,
  "message": "Não foi possível concluir agora. Nova tentativa será feita.",
  "correlationId": "..."
}
```

### 10.1 Retry automático

- Timeout, `408`, `429` e `5xx`: retry com exponential backoff, jitter e `Retry-After` quando existir.
- JSON inválido: repetir mesma etapa dentro do limite configurado.
- `4xx` de contrato, entrada grande, autenticação e autorização: sem retry automático.
- Cada etapa possui limite próprio de tentativas e timeout.
- UI mostra tentativa e próximo retry sem expor resposta bruta do provedor.

### 10.2 Retry manual

- Permitido somente em `FAILED` e quando dados de origem continuam disponíveis.
- Usa snapshot exato que falhou.
- Trocar provedor ou modelo cria nova tentativa auditada.
- Retry após edição exige nova revisão e novo hash.

## 11. Transcrição

### Entrada

- Bytes do áudio.
- MIME type validado.
- Idioma configurado, padrão `pt-BR`.
- Opções técnicas de timestamps e falantes quando suportadas.

### Regras

- Nenhum dado de projeto acompanha chamada.
- Validar extensão, MIME real, tamanho e duração.
- Storage key usa proprietário e UUID, nunca nome original.
- Nome original não entra em log.
- Transcrição é preservada como revisão.
- Áudio é excluído imediatamente após persistência da transcrição.
- Descarte e falha final também excluem áudio.
- Sweeper remove órfãos com mais de 24 horas.
- Falha ao excluir gera alerta operacional e novo job de limpeza.

### Critérios de aceite

- Provedor não recebe contexto de negócio.
- Retry não concatena transcrição repetida.
- Reprocessamento cria nova revisão.
- Falha não apaga transcrição já persistida.
- Áudio órfão não permanece além de 24 horas.

## 12. LLM 1 — organização em Markdown

### Entrada

- `TranscriptRevision.text`.
- Data atual.
- Fuso horário do usuário.
- Versão do prompt.

### Saída

- Markdown completo e organizado.
- Resumo opcional separado.
- Tópicos com IDs estáveis adicionados em metadados, sem poluir visualização.
- Datas, nomes, decisões, incertezas e termos originais preservados.
- Tópico neutro quando tipo não estiver claro.

### Proibições

- Consultar contexto de negócio.
- Inventar projeto, prazo, pessoa ou decisão.
- Remover informação por não parecer tarefa.
- Classificar definitivamente entidades.
- Criar dados no banco.

### Validação

- Markdown não vazio.
- Conteúdo dentro do limite.
- IDs de tópico únicos.
- Nenhum HTML perigoso.
- Links sanitizados na renderização.
- Teste de cobertura semântica compara fatos essenciais das fixtures, não similaridade textual simples.

## 13. Editor e primeira aprovação

Editor vira componente reutilizável com armazenamento canônico em Markdown.

### Requisitos

- Renderização WYSIWYG.
- Títulos, listas, checklist, negrito e links.
- Criar, editar, dividir, unir e excluir tópicos.
- Mostrar transcrição original em painel separado.
- Autosave com debounce e versão esperada.
- Estado visível: salvando, salvo, conflito ou erro.
- Aviso antes de sair com mudança não persistida.
- Ação `Aprovar Markdown` desabilitada enquanto autosave estiver pendente.
- Preview do hash e versão usados na aprovação fica invisível ao usuário, mas persistido.
- Edição posterior cria nova revisão; nunca altera snapshot aprovado.

### Canonicalização

- UTF-8 sem BOM.
- Quebra de linha `LF`.
- Serialização determinística do editor.
- Espaços significativos do Markdown preservados.
- Hash SHA-256 calculado sobre bytes canônicos.

## 14. Recuperação de referências

Recuperação básica é obrigatória. Vetor não entra nesta versão.

### 14.1 Fontes elegíveis

- Projetos ativos.
- Aliases.
- Módulos.
- Tags.
- Tasks existentes.
- Milestones.
- Contextos aprovados.
- Correções convertidas manualmente em contexto ou vocabulário editável.

### 14.2 Fontes proibidas

- Notas privadas.
- Áudio temporário.
- Segredos e credenciais.
- Dados de outro proprietário.
- Conteúdo descartado.
- Propostas ainda não aprovadas de outras entradas.

### 14.3 Estratégia da primeira versão

1. Busca exata normalizada por projeto, alias, módulo e tag.
2. PostgreSQL full-text por tópico para tasks, milestones e contexts.
3. Busca de duplicidade por título normalizado e full-text.
4. Ranking determinístico combinando tipo de match, projeto e atualização.
5. Limite por tipo e por tópico.
6. Snapshot imutável dos candidatos enviados ao LLM 2.

### 14.4 Segurança contra prompt injection

- Referências entram como dados JSON não confiáveis, nunca como mensagem de sistema.
- Prompt informa explicitamente que instruções dentro das referências devem ser ignoradas.
- Modelo não recebe ferramentas.
- Conteúdo recuperado não pode ampliar escopo ou permissões.
- Saída precisa apontar evidência no Markdown aprovado.
- Validador rejeita entidade sustentada somente por referência.

### 14.5 Evolução para vetor

`RetrievalProvider` deve permitir futura implementação híbrida. `pgvector` só entra quando:

- corpus de eval mostrar perda relevante de recall no full-text;
- ganho superar custo e latência;
- isolamento por proprietário estiver coberto por testes;
- política de remoção e reindexação estiver pronta;
- notas privadas continuarem excluídas.

## 15. LLM 2 — proposta consolidada

### Entrada autoritativa

- Snapshot imutável do Markdown aprovado.

### Entrada auxiliar

- `RetrievalSnapshot` marcado como `REFERENCE_ONLY`.
- Data e fuso horário.
- Schema JSON versionado.

### Schema lógico

```json
{
  "schemaVersion": 1,
  "summary": "...",
  "items": [
    {
      "id": "task-1",
      "topicIds": ["topic-1"],
      "operation": "CREATE",
      "entity": "TASK",
      "dependsOn": [],
      "data": {},
      "evidence": [
        { "topicId": "topic-1", "quote": "..." }
      ],
      "confidence": {
        "type": 95,
        "project": 80,
        "dates": 60
      },
      "duplicateCandidates": []
    }
  ],
  "unresolved": [
    {
      "topicId": "topic-2",
      "reason": "Projeto não identificado",
      "evidence": [{ "quote": "..." }]
    }
  ]
}
```

### Regras de validação

- JSON strict; campos desconhecidos rejeitados.
- `schemaVersion` obrigatória.
- IDs locais únicos.
- Máximo de 100 itens.
- Zero ou mais itens por tópico.
- Cada tópico aparece em item, `unresolved` ou ambos quando parte dele ficou pendente.
- Evidência deve existir literalmente no snapshot aprovado.
- Validador resolve offset e ocorrência da evidência; modelo não controla offset final.
- Confiança varia de 0 a 100 e existe separadamente para tipo, projeto e datas quando aplicáveis.
- Datas usam ISO 8601 e fuso explícito.
- Projeto existente só pode usar ID presente no `RetrievalSnapshot`.
- Projeto novo exige ação local explícita e evidência direta no Markdown.
- Dependências formam grafo acíclico.
- `NOTE` usa `private: true` obrigatoriamente na criação inicial.
- Usuários, pessoas, segredos e permissões nunca são entidades criáveis.
- Saída inválida não chega ao preview nem ao executor.

## 16. Preview e segunda aprovação

Preview reutiliza componentes visuais das entidades reais, em modo `proposal`.

### Funcionalidades

- Mostrar uma proposta consolidada.
- Editar campos permitidos.
- Trocar tipo de entidade.
- Selecionar ou remover itens.
- Mostrar dependências e impedir remoção que deixe referência quebrada.
- Destacar campos incertos, ausentes ou conflitantes.
- Mostrar evidência e confiança.
- Mostrar possíveis duplicidades.
- Exibir `UNRESOLVED` sem forçar criação.
- Registrar diff entre versão da IA e versão aprovada.
- Ação única `Aprovar e criar`.

### Regras por entidade

#### `Task`

- Título, descrição, projeto, módulo, tipo, status, prioridade, complexidade, prazo, previsão, tags, milestones e dependências.
- Nasce em `Backlog` quando status não for explicitamente aprovado.

#### `Meeting`

- Título, descrição, projeto opcional, início, fim ou duração, fuso e link opcional.

#### `Note`

- Título, conteúdo, projeto, task opcional e privacidade fixa como privada na criação.

#### `Milestone`

- Nome, descrição, projeto, início, previsão, status e tasks vinculadas.

## 17. Executor

### Pré-validação fora da transação

- Schema da proposta aprovada.
- Hash da aprovação.
- Grafo e ordem das ações.
- Existência aparente das referências.
- Tamanho máximo da proposta.

### Revalidação dentro da transação

- Proprietário de todos os projetos e relacionamentos.
- Estado e versão do `AiRun`.
- Ausência de execução concluída para mesma chave.
- Existência atual das referências.
- Regras de projeto para milestone, task, tags e dependências.
- Campos obrigatórios e datas.

### Escritas atômicas

Mesma transação cria:

1. `AiExecution` ou faz claim de execução pendente.
2. Entidades na ordem topológica.
3. Relações.
4. `EntityOrigin` para cada item.
5. `AuditLog` sem conteúdo sensível.
6. Estado `PROCESSED`.

Qualquer erro reverte tudo. Auditoria da criação não ocorre depois da transação.

### Resultado

- Clique repetido retorna entidades da execução original.
- Falha não deixa metade da proposta criada.
- Referência removida após preview bloqueia execução inteira e volta para revisão.
- Nenhum item não selecionado é executado.

## 18. APIs

Rotas mantêm `withOwner` e nunca aceitam `ownerId` do cliente.

### Captura e leitura

- `POST /api/inbox`: captura texto e cria `AiRun`.
- `POST /api/inbox/audio`: captura áudio e cria `AiRun`.
- `GET /api/inbox/:id/harness`: retorna estado, revisões ativas e permissões de ação.

### Markdown

- `PUT /api/inbox/:id/markdown-draft`: salva nova revisão com `expectedVersion`.
- `POST /api/inbox/:id/markdown-approval`: aprova hash exato.

### Proposta

- `PUT /api/inbox/:id/proposal-draft`: salva edição como nova revisão.
- `POST /api/inbox/:id/execution`: aprova e executa proposta exata.

### Controle

- `POST /api/inbox/:id/retry`: repete etapa falha.
- `POST /api/inbox/:id/discard`: descarta e cancela jobs.

### Respostas

- `200/201`: sucesso ou resultado idempotente.
- `400`: contrato inválido.
- `401`: sem sessão.
- `403`: referência existente, mas fora do proprietário.
- `404`: recurso inexistente sem revelar dados de outro usuário quando necessário.
- `409`: estado, versão ou hash obsoleto.
- `413`: arquivo ou conteúdo acima do limite.
- `422`: proposta semanticamente inconsistente.
- `429`: limite de uso.
- `503`: provedor indisponível.

## 19. Fila e workers

Primeira versão mantém fila PostgreSQL existente, com melhorias.

### Campos adicionais em `Job`

- `ownerId`.
- `aiRunId`.
- `step`.
- `inputVersion`.
- `inputHash`.
- `priority`.
- `leaseExpiresAt`.
- `heartbeatAt`.
- `timeoutMs`.
- `cancelledAt`.

### Tipos de job

- `audio.transcribe`.
- `ai.organize`.
- `ai.retrieve`.
- `ai.materialize`.
- `ai.cleanup-audio`.

### Regras operacionais

- Claim concorrente com lock seguro e `SKIP LOCKED` ou operação SQL atômica equivalente.
- Heartbeat renova lease enquanto chamada externa estiver ativa.
- Timeout usa `AbortSignal`; timeout não deixa chamada continuar silenciosamente.
- Job cancelado verifica cancelamento antes e depois do provedor.
- Concorrência limitada por proprietário e provedor.
- Jobs interativos têm prioridade sobre lembretes não urgentes.
- Backoff usa jitter.
- Payload contém IDs e hashes, nunca conteúdo grande quando este já estiver persistido.
- Worker roda fora do ciclo da request web ou por mecanismo gerenciado com tempo suficiente para chamadas.
- Health check informa backlog, idade do job mais antigo e workers ativos.

### Migração futura de fila

Trocar fila PostgreSQL por serviço dedicado somente quando métricas mostrarem contenção, backlog sustentado ou pressão de conexões. Contrato `JobQueue` deve esconder implementação.

## 20. Segurança e privacidade

### Autorização

- Toda consulta filtra proprietário no servidor.
- Referência recebida do modelo nunca é confiável.
- Executor revalida propriedade dentro da transação.
- Busca e futuro índice vetorial incluem `ownerId` como filtro obrigatório.
- Testes tentam acessar projetos, tasks, contexts, proposals e executions de outro usuário.

### Conteúdo sensível

- Notas privadas existentes ficam fora de IA e MCP.
- Segredos detectados não entram em referência recuperada.
- Prompt, resposta bruta, transcrição e Markdown não entram em logs comuns.
- Auditoria registra hashes, IDs, contagens, modelo, versão e resultado técnico.
- Acesso administrativo a conteúdo bruto exige fluxo separado e auditado.
- Provedor deve ser configurado para não treinar com dados e usar menor retenção disponível.

### Retenção e exclusão

- Áudio: exclusão imediata após sucesso, descarte ou falha final; órfãos em até 24 horas.
- Transcrição, Markdown, proposta e origem: permanecem enquanto entrada existir.
- Exclusão da entrada remove artefatos derivados conforme política do produto.
- Auditoria remanescente não guarda conteúdo e respeita política de retenção definida para produção.
- Exclusão de contexto remove candidato de busca imediatamente.

### Prompt injection

- Contextos e textos externos são dados não confiáveis.
- Nenhuma ferramenta disponível para LLM 1 ou LLM 2.
- Instruções recuperadas não alteram prompt de sistema.
- Output strict, allowlist de operações e revalidação no servidor.
- Fixture maliciosa obrigatória no conjunto de evals.

## 21. Observabilidade e custo

### Métricas por etapa

- Latência p50, p95 e p99.
- Filas: backlog, tempo de espera e idade do job mais antigo.
- Tentativas, timeouts, `429`, `5xx`, falhas de schema e resultados obsoletos.
- Tokens de entrada e saída.
- Custo estimado por run e por proprietário.
- Taxa de aprovação sem edição.
- Campos editados no preview.
- Taxa de `UNRESOLVED`.
- Projeto corrigido pelo usuário.
- Duplicidades detectadas e perdidas.
- Conversões posteriores das entidades.
- Áudios órfãos.

### Correlação

Toda operação usa:

- `correlationId`.
- `aiRunId`.
- `jobId`.
- `promptVersion`.
- `model`.
- hashes dos artefatos.

### Alertas

- Crescimento contínuo do backlog.
- Worker sem heartbeat.
- Falha repetida de provedor.
- Aumento de resultado obsoleto.
- Áudio não excluído.
- Violação de orçamento.
- Falha de auditoria transacional.

## 22. Evals e política de promoção

Evals começam na Fase 0, não no fim.

### Corpus

- Entradas reais anonimizadas.
- Texto curto e longo dentro do limite.
- Áudio curto e reunião.
- Conteúdo repetitivo e desorganizado.
- Datas relativas em `America/Sao_Paulo`.
- Várias entidades e vários projetos.
- Ambiguidade legítima.
- Duplicidade provável.
- Contexto malicioso.
- Nota privada presente no banco, mas proibida no prompt.

### Medidas

- Cobertura de fatos no Markdown.
- Fato inventado pelo LLM 1.
- Precisão de tipo, projeto e datas.
- Recall das referências.
- Duplicidades não detectadas.
- Edição humana necessária.
- Variação entre tentativas.
- Latência e custo.
- Estado final criado, não somente texto do modelo.

### Gate

- Baseline registrado antes do primeiro prompt de produção.
- Mudança de modelo, prompt, schema ou recuperação roda corpus completo.
- Qualquer vazamento entre proprietários, criação antes de aprovação, duplicidade por concorrência ou perda de conteúdo bloqueia promoção.
- Metas numéricas de precisão, custo e latência são definidas após baseline e versionadas neste documento ou em configuração de release.

## 23. Estratégia TDD

Cada fase começa com teste falhando. Antes de implementar cada teste, PR ou commit deve registrar:

1. comportamento importante protegido;
2. falha ou regressão real detectada;
3. impacto para usuário ou negócio.

Refatoração só ocorre quando necessária para passar contrato ou remover duplicação diretamente criada pela fase.

### Matriz mínima de testes

| ID | Comportamento protegido | Regressão detectada | Impacto |
|---|---|---|---|
| H01 | Nenhuma entidade antes das duas aprovações | Job ou rota cria entidade antecipadamente | Perda de controle do usuário |
| H02 | Texto removido não reaparece | LLM 2 usa transcrição ou revisão antiga | Criação de conteúdo rejeitado |
| H03 | Texto adicionado chega ao LLM 2 | Job usa Markdown gerado, não editado | Intenção do usuário ignorada |
| H04 | Uma reunião gera reunião e tasks relacionadas | Limite de uma entidade por tópico | Informação incompleta |
| H05 | Resultado de job antigo é rejeitado | Job sobrescreve revisão nova | Corrupção e quebra de confiança |
| H06 | Aprovação concorrente cria uma execução | Race entre dois cliques | Duplicidade de entidades |
| H07 | Execução falha reverte tudo | Escrita parcial fora da transação | Base inconsistente |
| H08 | Busca respeita proprietário | Filtro ausente em uma consulta | Vazamento de dados |
| H09 | Referência maliciosa não muda instruções | Prompt injection via contexto | Ação indevida |
| H10 | Nota privada não entra no prompt | Inclusão acidental na recuperação | Exposição LGPD |
| H11 | Entrada grande nunca é truncada | Corte silencioso de conteúdo | Perda de decisão ou tarefa |
| H12 | Retry usa snapshot exato | Retry consulta versão mais nova ou antiga | Resultado não reproduzível |
| H13 | Round-trip do editor mantém hash e conteúdo | Conversão WYSIWYG perde Markdown | Informação alterada sem aviso |
| H14 | Timeout cancela chamada e mantém lease correta | Chamada continua após timeout | Cobrança e execução duplicadas |
| H15 | Descarte cancela jobs e apaga áudio | Worker ressuscita entrada descartada | Violação de privacidade |
| H16 | Áudio é excluído após transcrição | Storage órfão | Retenção indevida |
| H17 | Referência removida bloqueia execução | Executor confia em preview antigo | Relação inválida |
| H18 | `UNRESOLVED` não força invenção | Modelo cria dado sem evidência | Informação falsa |
| H19 | Dependências inválidas bloqueiam aprovação | Item removido deixa grafo quebrado | Execução inconsistente |
| H20 | Auditoria confirma junto da entidade | Audit log ocorre fora da transação | Rastreabilidade incompleta |

### Escopo dos testes automatizados

- Somente testes unitários.
- Schemas, hashes, transições, ranking, grafo, políticas e serviços são testados isoladamente.
- Repositórios, provedores, storage, relógio e concorrência são simulados por fakes ou mocks controlados.
- Adapters de STT/LLM são validados por unidade com respostas e erros simulados.
- Componentes de UI são testados por unidade, sem navegador completo.
- Não criar testes E2E nem suíte automatizada dependente de banco, rede, browser ou provedor real.
- Funcionamento integrado é verificado por build, typecheck e validação manual dirigida do fluxo real.

## 24. Plano de implementação

### Fase 0 — Contratos e fixtures

Testes primeiro:

- H01, H02, H03, H04, H11 e H18 como testes de aceitação falhando.
- Fixtures anonimizadas e prompt injection.
- Schemas Zod versionados.
- Máquina de estados e transições permitidas.
- Cálculo de orçamento de tokens.

Entrega:

- contratos TypeScript;
- corpus inicial;
- baseline do fluxo atual;
- nenhuma mudança de produção habilitada.

### Fase 1 — Persistência e migração

Testes primeiro:

- imutabilidade de revisões;
- owner isolation;
- concorrência otimista;
- idempotency keys;
- cascata e preservação de legado.

Todos estes testes são unitários, usando repositórios fake. Migration e schema são validados por `prisma validate` e build, sem suíte de integração.

Implementação:

- novos modelos e migration;
- `Meeting` e relações;
- `AiRun`, revisões, approvals, execution, origin e attempts;
- extensão segura de `Job`;
- feature flag desligada.

### Fase 2 — Orquestração e fila

Testes primeiro:

- H05, H06, H12, H14 e H15.
- retry, cancelamento, heartbeat e stale result.

Implementação:

- job types novos;
- claim atômico;
- heartbeat e `AbortSignal`;
- version check antes/depois do provedor;
- endpoint de retry e descarte.

### Fase 3 — Transcrição

Testes primeiro:

- H16;
- MIME inválido, arquivo vazio, limite, retry e reprocessamento;
- exclusão em sucesso, falha final e descarte.

Implementação:

- adapter STT;
- `TranscriptRevision`;
- cleanup job e sweeper;
- métricas técnicas.

### Fase 4 — LLM 1 e editor

Testes primeiro:

- H02, H03, H11 e H13;
- preservação de datas, nomes, incertezas e conteúdo não acionável.

Implementação:

- prompt organizador;
- adapter versionado;
- validação do Markdown;
- editor componentizado;
- autosave e aprovação por hash.

### Fase 5 — Recuperação obrigatória

Testes primeiro:

- H08, H09, H10 e busca de duplicidade;
- ranking e limites determinísticos.

Implementação:

- `RetrievalProvider`;
- busca exata e PostgreSQL full-text;
- snapshot de referências;
- sanitização e marcação `REFERENCE_ONLY`.

### Fase 6 — LLM 2 e proposta

Testes primeiro:

- H04, H18 e H19;
- schemas por entidade;
- referências locais, evidências, confiança e ciclos.

Implementação:

- prompt materializador;
- strict JSON;
- `ProposalRevision` e `ProposalItem`;
- diff IA versus usuário.

### Fase 7 — Preview e executor

Testes primeiro:

- H01, H06, H07, H17, H19 e H20;
- edição por tipo, remoção e dependências.

Implementação:

- cards compartilhados em modo proposta;
- edição e segunda aprovação;
- executor topológico transacional;
- origem e auditoria na mesma transação.

### Fase 8 — Segurança, evals e rollout

Testes primeiro:

- suíte completa de autorização;
- carga concorrente de workers;
- corpus de eval completo.

Testes permanecem unitários: autorização e concorrência usam fakes determinísticos; corpus roda sobre funções/adapters isolados.

Implementação:

- dashboards e alertas;
- limites por proprietário/provedor;
- feature flag por usuário;
- documentação operacional;
- rollout gradual.

### Fase 9 — Pós-MVP

Somente após métricas reais:

- busca vetorial;
- chunking;
- aprendizado com correções;
- conversões adicionais entre entidades;
- fila dedicada;
- execução parcial opcional.

## 25. Migração do fluxo atual

Estado atual usa `InboxItem.status`, `InboxItem.suggestion`, relação única `Task.sourceInboxId` e job `ai.classify`.

Migração deve ser aditiva:

1. Criar tabelas novas sem remover colunas atuais.
2. Adicionar `Meeting`.
3. Preservar `sourceInboxId` para registros legados.
4. Usar `EntityOrigin` para runs v2.
5. Dividir `ai.classify` em `ai.organize`, `ai.retrieve` e `ai.materialize`.
6. Manter confirmação antiga para entradas legadas já em revisão.
7. Direcionar novas entradas ao v2 somente com feature flag.
8. Não fazer backfill de propostas antigas sem necessidade.
9. Remover campos legados somente em fase posterior, com migration separada e validação de ausência de uso.

## 26. Rollout e rollback

### Rollout

1. Rodar migrations com feature flag desligada.
2. Publicar web e worker compatíveis com legado e v2.
3. Validar health check, fila e migrations.
4. Habilitar conta de teste.
5. Rodar corpus unitário com fixtures de texto.
6. Validar manualmente fluxo real de áudio e confirmar exclusão do arquivo.
7. Monitorar custo, latência, erros, stale results e auditoria.
8. Habilitar usuário real escolhido.
9. Expandir somente após gate dos evals.

### Rollback

- Desligar feature flag impede novos runs v2.
- Jobs v2 pendentes são cancelados, não convertidos para legado.
- Runs existentes permanecem legíveis.
- Fluxo legado continua disponível durante janela de estabilização.
- Rollback não apaga tabelas nem artefatos.
- Migration destrutiva fica proibida durante estabilização.

## 27. Definição de pronto

### Funcional

- Texto e áudio completam fluxo até criação.
- Markdown pode ser editado e aprovado.
- Proposta única pode conter várias entidades e projetos.
- Preview permite editar, remover e trocar tipo.
- `UNRESOLVED` funciona sem invenção.
- Reload não perde estado.

### Integridade

- Zero entidade antes da segunda aprovação.
- Clique concorrente não duplica execução.
- Falha no meio não deixa escrita parcial.
- Job antigo nunca substitui revisão nova.
- Cada entidade criada possui origem rastreável.

### Segurança

- Zero acesso cruzado entre proprietários na suíte.
- Nota privada nunca aparece em prompt ou snapshot de busca.
- Prompt injection das fixtures não altera operação permitida.
- Áudio é excluído dentro da política.
- Logs não contêm transcrição, Markdown, proposta bruta, token ou segredo.

### Operação

- Worker possui heartbeat, timeout cancelável e retry observável.
- Backlog, latência, tokens, custo e erros possuem métricas.
- Alertas principais foram exercitados.
- Rollback por feature flag foi testado.

### Qualidade

- `npm test` passa.
- `npm run typecheck` passa.
- `npm run build` passa.
- Suíte unitária crítica passa.
- Fluxo real possui validação manual dirigida registrada.
- Corpus de eval registra baseline e resultado da versão promovida.
- Mudança respeita escopo da fase e evita refatoração não necessária.

## 28. Ordem final de execução

1. Contratos, testes e evals iniciais.
2. Persistência versionada e migration aditiva.
3. Orquestração, fila, retries e concorrência.
4. Transcrição e retenção.
5. LLM 1 e editor.
6. Busca exata e full-text.
7. LLM 2 e proposta estruturada.
8. Preview e executor transacional.
9. Segurança, observabilidade e rollout.
10. Vector, chunking e aprendizado somente após métricas.
