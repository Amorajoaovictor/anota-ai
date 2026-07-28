# Arquitetura de navegação — escopo global vs. escopo de projeto

Decisão tomada antes da Fase 3. Complementa `prd.md` seção 12 (Telas do produto).

## Problema

O protótipo (`src/App.tsx`) trata todas as telas como globais: Kanban, Planilha, Marcos, Roadmap, Prazos e Notas vivem na sidebar e leem o estado inteiro. Mas o PRD pede as duas coisas ao mesmo tempo:

- 12.6.1: "Página própria por projeto **e visão consolidada**."
- 12.5 Kanban: "Filtro por projeto", "Agrupamento opcional por projeto".
- 12.4 Planilha: "Agrupamento por projeto".
- 12.7 Prazos: "Filtrar por projeto".
- 12.8: detalhe do projeto já inclui roadmap, tarefas por status e marcos.

Duplicar cada tela em duas versões cria divergência de comportamento.

## Decisão

**Uma tela, dois escopos.** Cada visão é um componente único que recebe escopo explícito:

```ts
type Scope =
  | { type: 'global' }
  | { type: 'project'; projectId: string }
```

`/kanban` e `/projetos/[id]/kanban` renderizam o mesmo componente com escopo diferente. O escopo controla filtro de dados e quais colunas/controles aparecem — não gera código paralelo.

Exemplo (Planilha): no escopo global a coluna `Projeto` aparece e o agrupamento padrão é por projeto; no escopo de projeto a coluna `Projeto` some e `Módulo` assume o agrupamento.

## Telas por escopo

| Tela | Global | Aba do projeto | Observação |
|---|---|---|---|
| Hoje | sim | não | Cross-projeto por definição (12.1) |
| Projetos | sim | — | Lista e gestão |
| Planilha | sim | sim | Visão geral principal |
| Kanban | sim | sim | |
| Marcos | sim | sim | 12.6.1 pede as duas explicitamente |
| Roadmap | sim | sim | |
| Prazos | sim | sim | |
| Notas | sim | sim | Nota sempre pertence a um projeto; a global existe para busca cross-projeto |
| Visão geral do projeto | não | sim | Conteúdo de 12.8 |
| Contexto | não | sim | Conteúdo de 12.9. A Fase 3 entregou projeto + card; o resto é Fase 4 |
| Caixa de entrada | sim | não | Ver abaixo |
| Revisão IA | sim | não | Ver abaixo |
| Integrações | sim | não | |

## Por que Caixa de entrada e Revisão IA são só globais

Não é preferência de layout. Essas telas existem porque **o projeto ainda não foi determinado** — a classificação da IA é justamente o que descobre o projeto (9.6). Um item sem projeto não cabe dentro de nenhum projeto. Depois de aprovado, o item sai da caixa e vira card do projeto.

Podem ganhar filtro por projeto para itens já classificados, mas não viram aba dentro do projeto.

## Como está implementado

`Scope` e os seletores vivem em `src/domain.ts`:

- `scopeProjects(state, scope)` — projetos que alimentam a visão.
- `scopeTasks`, `scopeMilestones`, `scopeNotes` — derivam dos projetos do escopo.

`src/App.tsx` guarda uma `Route` (`global` ou `project`) e deriva o `scope` dela. As views em `src/phase1.tsx`, `src/milestones.tsx`, `src/roadmapView.tsx` e `src/notes.tsx` recebem `scope` como prop em vez de filtrarem o `AppState` inteiro por conta própria.

No escopo de projeto, cada view esconde o que virou redundante: o filtro/coluna de projeto some, o seletor de projeto nos formulários vira campo travado, e o filtro de marcos lista só os do projeto.

**Correção de comportamento junto:** antes, a Planilha listava tarefas de projetos arquivados enquanto o Kanban não. O diálogo de arquivamento promete "sai do Kanban e dos filtros". Agora `scopeTasks` aplica a regra em todas as visões globais. Projeto arquivado continua acessível ao navegar direto para ele.

## Criação de card em qualquer tela

Cada tela tinha o direito de criar cards, mas só a Planilha exercia — o formulário morava dentro dela. Duplicar esse formulário por tela repetiria o problema que o escopo resolveu: comportamento divergindo por cópia.

**Decisão: uma instância só, dona em `App.tsx`.** `TaskCreateDialog` (`src/taskCreate.tsx`) é renderizado ao lado do toast, fora do `renderMain()`, então existe em qualquer rota. As telas não guardam formulário — recebem `onCreateTask(defaults)` pelo mesmo prop bag `shared` que já entrega `scope`, `state` e `notify`, e só descrevem o contexto delas:

- Kanban: `{ status: <coluna>, milestoneIds: [<marco filtrado>] }` (PRD 12.5).
- Roadmap: `{ due: day.key }` — `day.key` é `DD/MM`, o mesmo formato que o arraste grava.
- Planilha: `{ module: <filtro ativo> }`.
- Barra superior, Prazos e plano de "Hoje": sem defaults.

O arquivo é separado de `phase1.tsx` de propósito: `phase1.tsx` importa `roadmapView.tsx`, e o roadmap também precisa abrir a criação — hospedar o diálogo em `phase1.tsx` fecharia um ciclo de import.

**Resolução do projeto pelo escopo:** no escopo global o campo é um `<select>` de `scopeProjects` (arquivados ficam de fora); no escopo de projeto vira campo travado, mesmo padrão dos outros formulários. Como o projeto do card só existe depois de escolhido, o seletor de marcos filtra por `scopeMilestones` + projeto do rascunho, e trocar de projeto limpa a seleção — `addTask` descarta marco de outro projeto de qualquer forma, mas mostrar marco inválido selecionado seria mentira na tela.

**A IA é opcional por construção.** `suggestTaskFields` só preenche campos ainda no default e nunca troca o projeto escolhido. Se ela falhar ou não for acionada, título + projeto bastam — é o que a seção 6.5 do PRD exige.

## Persistência — projetos e cards saíram da memória

`App.tsx` deixou de nascer com `initialState`. `src/app/page.tsx` virou Server Component: exige sessão, chama `listProjects`/`listTasks` direto e entrega o estado pronto por prop. Sem sessão, redireciona para `/auth/sign-in`.

Três peças novas separam responsabilidades que antes não existiam:

- `src/lib/mapping.ts` — **único** ponto que conhece o formato do banco. Traduz enums (`IN_PROGRESS` ↔ `Em andamento`), `complexity` 1/2/3 ↔ Baixa/Média/Alta e `dueAt` ↔ `DD/MM`. Nenhuma tela importa tipo do Prisma.
- `src/lib/api.ts` — `fetch` sobre o formato de erro de `server/http.ts`.
- `src/lib/store.ts` — `useProjectData`, a única peça que sabe que existe rede. Toda mutação aplica a função pura de `domain.ts` na hora, persiste e, em falha, volta ao estado anterior com o motivo no toast. Em criação, o id otimista (`task-<timestamp>`) é trocado pelo cuid do banco.

As telas continuam sem saber de rede: recebem `actions` pelo mesmo prop bag que já entrega `scope`, `state` e `notify`. `setState` direto sobrou só para o que ainda vive em memória — a caixa de entrada, a ordem do plano do dia e o CRUD de marco (Fase 5).

### Três campos mudaram de natureza

- `Task.dependency` era texto livre (`"Depende de 1"`). Virou `dependsOnIds`, gravado em `TaskDependency`. Só vale entre cards do mesmo projeto — trocar o projeto do card invalida o vínculo, e o servidor descarta id inválido em vez de derrubar a edição.
- `Task.time`/`duration` sumiram: não existiam no banco e o PRD não tem horário de card. O lugar deles é `complexity`, que a Fase 0 define. O roadmap ordena o dia por prioridade e título.
- `Project.progress` deixou de ser número guardado e passou a sair de `withDerivedProgress` — PRD 10.1 sempre disse "Calculado".

### Duas armadilhas do Prisma que custaram caro

Ambas passavam no teste unitário (o repositório é `vi.fn()`) e só apareceram rodando contra o Postgres:

1. `deleteMany` **aninhado** aceita apenas filtro escalar. Decidir "apaga o módulo que não tem card" exige uma consulta separada em `projectModule.findMany`, onde o filtro de relação vale.
2. Misturar `projectId` escalar com `module: { connectOrCreate }` no mesmo `create` joga o Prisma no modo *unchecked*, que proíbe escrita aninhada. O card é criado com `project: { connect }`.

## Fase 3 — etiquetas, previsão, notas e contextos

Migração `20260728143000_phase3_tags_notes_contexts`.

**Etiqueta pertence ao projeto.** `ProjectTag` (nome único por projeto, cor) e `TaskTag` N:N. Não existe etiqueta global: o vocabulário de um projeto não vale no outro, que é a mitigação do PRD 24 para "contexto de projetos diferentes se misturar". A tela edita a lista de etiquetas do projeto como conjunto — o que não vier sai —, **com a mesma exceção dos módulos**: etiqueta em uso por algum card permanece, porque apagá-la desligaria o card. Quem decide o que pode sair é uma consulta prévia em `projectTag.findMany({ tasks: { none: {} } })`, pelo motivo já registrado: `deleteMany` aninhado só aceita filtro escalar.

Etiqueta criada na tela nasce com id temporário. `replaceProject`, no reconcílio da resposta, casa por nome e troca os ids temporários nos cards — sem isso o vínculo ficaria preso a um id que o banco não conhece.

**Previsão de entrega** (`Task.forecastAt`) é campo distinto do prazo confirmado, como manda a Fase 0. `suggestForecast` deriva a previsão da complexidade (Baixa +2d, Média +5d, Alta +10d) e só é oferecida como sugestão. Previsão vencida é alerta, não atraso — o tratamento visual disso é Fase 5.

**Nota** ganhou `projectId` obrigatório, `taskId` opcional e `position`. A migração adiciona a coluna nullable, faz backfill para o projeto mais antigo do mesmo dono, apaga nota cujo dono não tem projeto algum e só então aplica `NOT NULL` (na base de desenvolvimento o `DELETE` atingiu 0 linhas — nenhuma tela jamais gravou nota). `position` é `Float` porque o arraste grava o ponto médio entre os vizinhos da mesma seção: um arraste é uma gravação só, e `toAppState` ordena por `position` assumindo que a ordem do array acompanha.

`Note.taskId` **não** se confunde com `convertedTask`: o primeiro é o vínculo voluntário com um card, o segundo é o card nascido da nota. `sourceNoteId` passou a ser gravado na criação, então converter nota em card sobrevive ao refresh em vez de oferecer "Converter" outra vez e duplicar o card. Nota já convertida é ignorada como origem, porque `sourceNoteId` é único e insistir derrubaria a criação por conflito.

**Contexto** (`ProjectContext`) é o oposto da nota: exige projeto e título, pode apontar um card do mesmo projeto e fica disponível para IA e MCP. A auditoria de nota registra só o vínculo e quais chaves mudaram, nunca o texto — nota é privada.

**Marcos entraram só em leitura.** `listMilestones` alimenta o estado e o vínculo card↔marco é gravado por `createTask`/`updateTask`. Criar, editar e remover marco continua em memória: é Fase 5. Marco usa data completa (`YYYY-MM-DD`), não o `DD/MM` de prazo e previsão.

Marco, etiqueta e dependência compartilham a mesma regra: id fora do projeto do card é descartado sem derrubar a operação. No servidor isso é um helper único (`ownedLinkIds`); no domínio, `validTagIds`/`setTaskMilestones`. Trocar o projeto de um card zera etiquetas e marcos, porque os dois pertenciam ao projeto antigo.

## Ainda não feito

- **Caixa de entrada e Revisão IA persistidas.** `InboxItem` já existe no schema; falta ligar. É o que reata `sourceInboxId`, hoje sempre nulo. Fase 4.
- **CRUD de marco** (criar, editar, status, remover) segue em memória. Fase 5.
- Aba **Contexto** completa (PRD 12.9): pessoas, setores, tecnologias, repositórios, expiração de memória e regras aprendidas não têm campo no schema. Fase 4.
- Rotas de verdade. A navegação é estado em memória no `App.tsx`, não URLs `/projetos/[id]/kanban`.
- Prazo e previsão guardam `DD/MM` e resolvem o ano pelo ano corrente na escrita. A agenda da Fase 5 vai exigir data completa.
- Os checkboxes de etiqueta, marco e dependência não têm nome acessível (leem como "on"). Vale um `aria-label` quando a acessibilidade entrar em pauta.
