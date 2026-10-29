'use client'

import { HarnessReviewPanel, type HarnessClient, type HarnessView } from '../../../aiHarnessFlow'
import type { InboxItem, Project } from '../../../domain'
import type { HarnessProposalV1 } from '../../../server/ai/harness/contracts'

/**
 * Preview isolado da Revisão IA (sem DB): mock client resolve um read model
 * com todas as entidades propostas, estados de seleção e pendências, para QA
 * visual dos cards em /impeccable-preview/revisao-ia.
 */

const projects: Project[] = [
  { id: 'project-vistafor', name: 'VistaFor', description: '', color: '#a98cec', progress: 0, priority: 'P1', aliases: [], modules: [], tags: [], archived: false },
  { id: 'project-intranet', name: 'Intranet', description: '', color: '#5e9cf1', progress: 0, priority: 'P2', aliases: [], modules: [], tags: [], archived: false },
  { id: 'project-observa', name: 'Observa SEUMA', description: '', color: '#79dfb2', progress: 0, priority: 'P2', aliases: [], modules: [], tags: [], archived: false },
]

const inboxItem: InboxItem = {
  id: 'inbox-preview',
  source: 'Áudio',
  status: 'Aguardando confirmação',
  date: 'hoje · 14:32',
  text: 'Boa tarde. Sobre a reunião de hoje: a planta principal do VistaFor continua carregando automaticamente e travando o mapa. O pessoal da medição pediu para colocar isso como prioridade alta e corrigir a exclusão de medidas que está apagando registro em lote. Depois, precisamos reproduzir o erro e registrar a resposta da API. Na Intranet, vamos validar a regra de permissões do painel de servidores. Marquei uma reunião de alinhamento com a equipe PAX para quinta, às nove e meia. E ficou a ideia de separar a fila de validação por setor.',
}

const proposal: HarnessProposalV1 = {
  schemaVersion: 1,
  summary: 'Reunião semanal — correções no VistaFor, validação na Intranet e alinhamento PAX.',
  unresolved: [
    { topicId: 'topic-7', reason: 'Projeto não identificado', evidence: [{ quote: 'Talvez exista outra frente para o relatório da diretoria.' }] },
    { topicId: 'topic-8', reason: 'Conteúdo ambíguo', evidence: [{ quote: 'Separar a fila de validação por setor — não ficou claro se é para a Intranet ou geral.' }] },
  ],
  items: [
    {
      id: 'task-fix', topicIds: ['topic-1'], operation: 'CREATE', entity: 'TASK', dependsOn: [], duplicateCandidates: ['Corrigir exclusão de medidas (2019)'],
      evidence: [{ topicId: 'topic-1', quote: 'Corrigir a exclusão de medidas que está apagando registro em lote.' }],
      confidence: { type: 95, project: 90 },
      data: {
        project: { existingId: 'project-vistafor' }, title: 'Corrigir exclusão de medidas', moduleName: 'Medição',
        kind: 'BUG', status: 'BLOCKED', priority: 'P0', complexity: 3, dueAt: '2026-08-14T18:00:00-03:00',
        tags: ['raster', 'quadra'], milestones: [], description: 'A exclusão em lote está apagando registros vizinhos ao da medida selecionada.',
      },
    },
    {
      id: 'task-repro', topicIds: ['topic-2'], operation: 'CREATE', entity: 'TASK', dependsOn: ['task-fix'],
      evidence: [{ topicId: 'topic-2', quote: 'Depois, precisamos reproduzir o erro e registrar a resposta da API.' }],
      confidence: { type: 62, project: 55 }, duplicateCandidates: [],
      data: {
        project: { existingId: 'project-vistafor' }, title: 'Reproduzir erro e registrar resposta da API',
        kind: 'TASK', status: 'BACKLOG', priority: 'P1', complexity: 2,
        tags: [], milestones: [], description: 'Subir ambiente local e capturar a resposta completa do endpoint de exclusão.',
      },
    },
    {
      id: 'task-perm', topicIds: ['topic-3'], operation: 'CREATE', entity: 'TASK', dependsOn: [],
      evidence: [{ topicId: 'topic-3', quote: 'Na Intranet, vamos validar a regra de permissões do painel de servidores.' }],
      confidence: { type: 88, project: 92 }, duplicateCandidates: [],
      data: {
        project: { existingId: 'project-intranet' }, title: 'Validar regra de permissões do painel de servidores',
        moduleName: 'Painel', kind: 'TASK', status: 'BACKLOG', priority: 'P1', complexity: 1,
        forecastAt: '2026-08-18T12:00:00-03:00', tags: [], milestones: [],
      },
    },
    {
      id: 'meeting-pax', topicIds: ['topic-4'], operation: 'CREATE', entity: 'MEETING', dependsOn: [],
      evidence: [{ topicId: 'topic-4', quote: 'Marquei uma reunião de alinhamento com a equipe PAX para quinta, às nove e meia.' }],
      confidence: { type: 90, dates: 70 }, duplicateCandidates: [],
      data: {
        project: { existingId: 'project-vistafor' }, title: 'Alinhamento PAX · VistaFor',
        startsAt: '2026-08-13T09:30:00-03:00', endsAt: '2026-08-13T10:30:00-03:00',
        durationMinutes: 60, timezone: 'America/Fortaleza',
        link: 'https://meet.google.com/exemplo', description: 'Alinhar entregas do raster com a equipe PAX.',
      },
    },
    {
      id: 'note-raster', topicIds: ['topic-5'], operation: 'CREATE', entity: 'NOTE', dependsOn: [],
      evidence: [{ topicId: 'topic-5', quote: 'Contexto interno sobre a decisão do raster.' }],
      confidence: { type: 92 }, duplicateCandidates: [],
      data: {
        project: { existingId: 'project-vistafor' }, title: 'Decisão sobre raster (contexto)',
        content: 'A diretoria preferiu manter o raster atual e adiar a migração para o novo formato até o fechamento do contrato PAX.',
        private: true,
      },
    },
    {
      id: 'milestone-raster', topicIds: ['topic-6'], operation: 'CREATE', entity: 'MILESTONE', dependsOn: ['task-fix'],
      evidence: [{ topicId: 'topic-6', quote: 'Entrega do raster v2 depende da correção de exclusão.' }],
      confidence: { type: 84, dates: 78 }, duplicateCandidates: [],
      data: {
        project: { existingId: 'project-vistafor' }, name: 'Entrega raster v2',
        startAt: '2026-08-11T09:00:00-03:00', targetAt: '2026-08-28T18:00:00-03:00',
        status: 'PLANNED', tasks: [{ localId: 'task-fix' }], description: 'Versão consolidada do raster para homologação.',
      },
    },
    {
      id: 'proj-pax', topicIds: ['topic-4'], operation: 'CREATE', entity: 'PROJECT', dependsOn: [],
      evidence: [{ topicId: 'topic-4', quote: 'PAX virou frente própria com entregas próprias.' }],
      confidence: { type: 95 }, duplicateCandidates: [],
      data: { name: 'PAX/VistaFor' },
    },
  ],
}

const view: HarnessView = {
  run: { id: 'run-preview', status: 'AWAITING_ENTITY_APPROVAL', version: 12, failedStep: null, errorCode: null, retryable: false },
  transcript: { id: 'transcript-preview', version: 1, text: inboxItem.text, source: 'STT' },
  markdownRevision: { id: 'markdown-preview', version: 2, content: '# Reunião semanal\n\n- Correção da exclusão de medidas\n- Reproduzir erro da API\n- Validação de permissões na Intranet', contentHash: 'preview-hash', source: 'AI' },
  proposalRevision: { id: 'proposal-preview', version: 1, contentHash: 'proposal-preview-hash', proposal },
  selectedItemIds: ['task-fix', 'task-perm', 'meeting-pax', 'note-raster', 'milestone-raster', 'proj-pax'],
}

const client: HarnessClient = {
  load: async () => view,
  saveMarkdown: async () => view,
  approveMarkdown: async () => view,
  saveProposal: async () => view,
  execute: async () => view,
  retry: async () => view,
  discard: async () => view,
}

export default function RevisaoIaPreviewPage() {
  return <HarnessReviewPanel inboxItem={inboxItem} client={client} notify={() => {}} onBack={() => {}} projects={projects} />
}
