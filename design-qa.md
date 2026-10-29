# Design QA — Hoje mobile

## Referências

- Mock selecionado: opção 3, `C:\Users\joao.neri\.codex\generated_images\01a109a2-7216-7cf2-9a06-59d9609229a7\exec-b47306bf-5271-4694-a73a-f4a0a2670cdd.png`.
- Implementação: `src/App.tsx`, `src/todayCapture.tsx` e `src/prototype.css`.
- Captura revisada no navegador local em 390 × 844 CSS px, rota Hoje, com dados da conta de auditoria.

## Revisão visual

- Fundo grafite, superfícies escuras, texto claro e acento menta seguem os tokens existentes.
- Hierarquia mobile começa pela captura, segue para próxima ação e integra a fila real da Caixa de entrada IA.
- Navegação inferior reduz a faixa horizontal extensa; “Mais” mantém acesso às outras seções.
- A opção selecionada foi refinada conforme instrução do usuário: alternância Nota/Tarefa e itens reais da IA substituem a captura genérica do mock.
- Desktop foi conferido em viewport padrão; estrutura anterior do plano permanece disponível.

## Fluxos conferidos

- Testes da captura cobrem o envio de Tarefa para revisão IA, o salvamento privado de Nota e a obrigatoriedade de projeto para Nota.
- Navegação do painel “Mais” para Reuniões funcionou. A Caixa de entrada abriu a fila inteligente existente.
- Nenhuma nota ou tarefa foi gravada durante a verificação visual.
- A integração Trello continua como placeholder neste repositório. A captura Tarefa usa o fluxo existente de Revisão IA; não cria cards Trello.

## Achados

- Nenhuma diferença visual P0, P1 ou P2 encontrada para a tela mobile selecionada.
- P3 de ambiente: o indicador do Next.js Dev ocupa o canto inferior esquerdo e sobrepõe visualmente o primeiro item da navegação na captura de desenvolvimento. Não pertence ao app em produção; excluído da comparação.

final result: passed

---

# Design QA — Roadmap contínuo — 05/10/2026

## Referência e evidências

- Card lido: https://trello.com/c/J3Nu4vn0 — Redesenhar roadmap com timeline contínua e visões Dias / Semanas. Descrição completa obtida na busca; leitura adicional respondeu HTTP 429.
- Fonte visual: C:/Users/JOAO~1.NER/AppData/Local/Temp/codex-clipboard-75d2b801-5f40-45eb-8102-32068296b322.png — 1586 × 992 px.
- Implementação: src/roadmapView.tsx, src/roadmap.css, src/roadmap.ts; integração de cabeçalho restrita ao ramo Roadmap em src/phase1.tsx.
- Evidências da implementação: capturas inline do cua_repl, aba 1, URL https://localhost:3000/impeccable-preview/roadmap. Exportação para arquivo retornou EPERM; não há PNG local da implementação.
- Desktop: viewport 1586 × 992 CSS px, devicePixelRatio 1; captura JPEG 1576 × 986 px. Comparação normalizada pela largura útil, excluindo bordas/scrollbars do navegador. Fonte e implementação exibidas juntas na mesma chamada de revisão; última captura com todas as faixas abertas.
- Mobile: viewport efetivo medido 360 × 844 CSS px; também observado viewport 400 × 937 CSS px durante ajuste do navegador. Referência fornecida é desktop: mobile avaliado pela adaptação responsiva, sem alegar cópia de um mock mobile inexistente.
- Estado: escopo global, três projetos, tarefas concluídas/em andamento/bloqueadas, prioridades P1/P2/P3, marco independente e três tarefas sem data. Dados de demonstração, sem gravação de tarefas durante inspeção.

## Histórico de comparação e correções

1. [P2 corrigido] Subtítulo cortado pela margem negativa: removida sobreposição, reutilizado PageHeading no cabeçalho do Roadmap.
2. [P2 corrigido] Badge Sem marco estreito e textos pequenos: mostrar vínculos existentes e ampliar tipografia dos cards.
3. [P1 corrigido] Mobile com nome fixo consumindo metade da tela: projeto agora é cabeçalho horizontal da faixa; datas e cards ocupam toda largura disponível. Desktop mantém nomes fixos à esquerda.
4. [P2 corrigido] Filtro comprimido e retorno a Hoje fora da viewport pequena: filtro ganha linha adequada; cálculo de posicionamento usa largura medida e escala atual.
5. [P2 corrigido] Troca Dias/Semanas escondia semana atual no celular: manter data central ao mudar escala. Evidência posterior mostrou semana 05–11/out inteira dentro da viewport.
6. Capturas posteriores conferiram faixa Sem data definida acessível por rolagem, navegação inferior preservada e ausência de overflow horizontal da página.

## Superfícies verificadas

- Tipografia: fontes existentes DM Sans/Space Grotesk; título amplo no desktop e 32 px no mobile, nomes e status legíveis, títulos quebrando sem cortar informação essencial.
- Ritmo/layout: faixas por projeto, divisórias leves, cards compactos, controle estreito de navegação e tray inferior. Sem imagens decorativas novas.
- Cores: fundo escuro e menta existentes; status concluído verde, execução azul, bloqueio âmbar; prioridades altas destacadas. Status também identificado por texto/ícone.
- Assets: ícones Phosphor reutilizados. Marca e sidebar existentes preservadas; não fazem parte da alteração solicitada. Não há raster novo nem substituição de assets por desenhos CSS.
- Conteúdo: contagem real de tarefas da fixture, datas ISO completas, status, prioridades e vínculos existentes. Marcos mantêm resumo e abertura das tarefas vinculadas.
- Comparação de regiões: cabeçalho/filtros, datas/Hoje, faixas/cards e tray conferidos separadamente nas capturas; mobile Dias e Semanas conferidos com Hoje completamente visível.

## Interações e validação

- Navegador: filtro global/por projeto, abertura de tarefa concluída no modal existente com prazo 30/09/2026, alternância de escala, retorno a Hoje, expansão/recolhimento, navegação e acesso ao tray mobile.
- Sem erros de console durante inspeção do Roadmap antes de abrir histórico da tarefa de demonstração.
- 22 testes passaram em roadmap.test.ts, roadmapTimeline.test.ts, roadmapView.test.tsx, dnd.test.ts e calendar.test.ts.
- Proteções: viradas de mês/ano; agrupamento sem perdas; marco independente/vínculos; datas preservadas ao explorar; janela de 49 colunas após histórico longo; teclado e gesto de fundo sem escrita; criação com projeto/data; drop explícito; mesma semana não troca prazo por segunda-feira; Hoje/escala visíveis no celular.
- TypeScript e git diff --check passaram. Next build passou, incluindo geração estática e verificação de tipos. npm run build completo encontrou EPERM na substituição da DLL Prisma em uso; Next foi compilado separadamente usando cliente Prisma já gerado.
- Persistência de replanejamento usa ações existentes; verificada com mocks, sem alteração de registros reais durante QA.

## Resultado

- Nenhum P0/P1/P2 aberto no escopo do Roadmap.
- P3: marca/sidebar e shell anterior diferem do mock; preservados por escopo. Indicador de desenvolvimento do Next não pertence ao layout de produção.
- Limitação de evidência: capturas vistas inline; gravação em arquivo indisponível nesta sessão (EPERM).

final result: passed

## Correção — arraste por toque no Roadmap

- Falha reportada: aparência mobile validada anteriormente, mas cards dependiam de drag/drop HTML e não tinham caminho próprio para Pointer Events de toque.
- Correção: componente TouchDragHandle e registro reutilizável de destinos em src/touchDrag.tsx; integração limitada ao Roadmap. Alça de 44 × 44 CSS px, touch-action:none, captura do ponteiro, preview flutuante, destino destacado e autoscroll nas bordas. Toque no restante do card continua abrindo detalhe; swipes fora da alça continuam explorando a timeline.
- Testes primeiro: cinco casos novos falharam por ausência da alça. Correção posterior protege escrita única ao soltar, cancelamento/perda de captura, movimento mínimo, bloqueio entre projetos, retirada explícita de prazo e autoscroll sem gravação prematura.
- Resultado final: 25 testes passaram em roadmapView.test.tsx, roadmap.test.ts, roadmapTimeline.test.ts e dnd.test.ts. TypeScript e git diff --check passaram.
- Inspeção no navegador em viewport mobile confirmou alças visíveis de 44 × 44, touch-action:none, instrução de uso e console sem erros. Eventos pointerType=touch validados em testes DOM; não houve teste em aparelho físico nem gravação de prazo real.
- Correção aplicada no checkout local; publicação não executada nesta etapa.

final result: passed

## Publicação — Roadmap

- Publicação autorizada pelo usuário em 05/10/2026. Cópia isolada de HEAD 320d865 com apenas phase1.tsx, roadmap.ts, roadmapView.tsx, roadmap.css, touchDrag.tsx e testes do Roadmap; demais alterações locais preservadas.
- 26 testes passaram na cópia isolada, incluindo arraste por toque e mouse. TypeScript local passou; build e TypeScript da Vercel passaram.
- Deploy dpl_HTAsKrGB1YoWWKWGeoR7gYTPx8L3: READY, produção, alias https://anota-ai-orcin.vercel.app.
- Conferência no endereço público com sessão existente: nova timeline Dias/Semanas e filtro PAX; em viewport 390 × 844 as alças medem 44 × 44 com touch-action:none, instrução de arraste visível. Console sem erros ou avisos. Viewport restaurado ao concluir.
- Captura conferida inline. Sem teste em aparelho físico e sem alteração de datas reais na verificação de produção.

final result: passed

# Design QA — Kanban compacto (07/10/2026)

- Referência: primeira imagem selecionada, exec-dccb933e-f9b7-4053-a4ca-59d11d0718eb.png, com arraste dos cards para os status no topo do celular.
- Implementação: src/kanban.tsx, src/kanban.css e mecanismo compartilhado src/touchDrag.tsx.
- Conferência no navegador local usando App real, dados fictícios e API de escrita simulada; nenhuma tarefa real alterada.
- Desktop: 1440 x 1024 CSS px, seis colunas na mesma faixa, sem vazamento lateral. Arraste entre colunas conferido no navegador.
- Celular: 390 x 844 CSS px, uma coluna selecionada, status superiores com rolagem horizontal e navegação inferior existente. Sem vazamento lateral da página.
- Corrigidos filtro de marco quebrado no celular e datas quebradas nos cards desktop.
- Gesto compartilhado: segurar card por 350 ms inicia arraste; rolagem comum e toque continuam disponíveis; cancelar não salva; destinos superiores destacam o status e aceitam uma única movimentação.
- 27 testes Kanban/Roadmap aprovados: todos os destinos, reordenação desktop, cancelamento, bloqueio de rolagem somente durante arraste e falha de salvamento mantendo coluna de origem.
- Toque validado em testes automatizados; celular físico não foi usado nesta revisão. Persistência usa a ação existente do app, sem nova API.

final result: passed
