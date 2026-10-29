# Mapa da jornada do usuário

Este mapa descreve a jornada ponta a ponta do usuário da Central de Projetos: do momento em que uma demanda surge até a execução, o acompanhamento e o aprendizado do sistema. Ele orienta decisões de UX e o protótipo navegável (documento 10), cobrindo antes, durante e depois da captura, além dos estados de erro e desvios.

Princípio condutor da jornada (PRD, seção 2.3): **o usuário informa o que aconteceu; o sistema entende onde aquilo pertence — e o usuário mantém a palavra final em todas as etapas.** O agente propõe, explica e espera aprovação; ações sensíveis nunca são executadas automaticamente.

---

## 1. Visão geral da jornada

| Fase | Momento | Objetivo do usuário | Resultado esperado |
|---|---|---|---|
| Antes | Demanda surge no dia a dia | Registrar rápido sem sair do fluxo | Informação capturada na caixa de entrada |
| Antes | Triagem automática | Saber onde a informação se encaixa | Classificação com confiança e evidências |
| Durante | Revisão e aprovação | Manter controle sobre o que será criado | Plano aprovado, corrigido ou rejeitado |
| Durante | Execução | Confiar que os dados ficaram corretos | Backend registra ações e sincroniza Trello |
| Depois | Acompanhamento | Saber o que fazer hoje | Plano diário, visualizações e prazos visíveis |
| Depois | Aprendizado | Melhorar as próximas classificações | Correções viram contexto editável do projeto |

A jornada tem três caminhos de entrada — **texto, áudio e Trello** — que convergem para a mesma triagem, revisão e execução. Nenhuma etapa depende de a IA estar disponível para o registro manual existir (PRD, seção 6.5).

---

## 2. Etapas detalhadas

### Etapa 1 — Surgimento da demanda (antes)

- **Ação do usuário:** recebe ou percebe uma demanda: comentário em reunião, mensagem, lembrança, bug encontrado, decisão tomada. Digita um texto, grava/envia um áudio, ou a demanda chega como card criado diretamente no Trello.
- **Pensamentos/perguntas:** “Onde eu registro isso?” “De qual projeto isso é mesmo?” “Isso é tarefa, decisão ou só observação?” “Já existe algo parecido?”
- **Emoções:** pressa, receio de esquecer, cansaço de atualizar várias ferramentas.
- **Pontos de dor:** demanda sem classificação clara; o mesmo projeto chamado por nomes diferentes (ex.: PAX e VistaFor); informações dependentes de contexto anterior; áudio que precisaria ser transformado manualmente em atividade; risco de cadastrar duplicado.
- **Touchpoints:** entrada de texto, gravação/upload de áudio (web/PWA), quadro Trello, criação rápida de tarefa (ação global disponível em qualquer tela), tela “Hoje”.
- **Oportunidades:** entrada única e natural, sem exigir preenchimento de campos; gravação de áudio como alternativa quando digitar é inconveniente; criação manual sempre acessível, mesmo com IA indisponível.
- **Métricas:** redução de atualizações manuais duplicadas (meta 80%); registro feito sem interromper o fluxo de trabalho.

### Etapa 2 — Captura e triagem (antes)

- **Ação do usuário:** acompanha o processamento; no caso de áudio, pode editar a transcrição antes da análise.
- **Pensamentos/perguntas:** “A transcrição saiu certa?” “O sistema está entendendo o contexto?” “Quanto falta para eu poder revisar?”
- **Emoções:** expectativa; impaciência se o processamento demorar ou travar.
- **Pontos de dor:** transcrição com trechos incertos; entrada aguardando classificação se acumular; não saber em que estágio o processamento está.
- **Touchpoints:** caixa de entrada inteligente (estados: recebida, transcrevendo, analisando contexto, aguardando confirmação, processada, descartada, com erro); transcrição editável com destaque de trechos incertos; indicador de status visível.
- **Oportunidades:** mostrar o estado de cada entrada; preservar texto e áudio originais junto da transcrição; política configurável de retenção do áudio.
- **Métricas:** entradas com status definido após revisão (meta 95%); classificação contextual com status visível (requisito de desempenho).

### Etapa 3 — Classificação com confiança e evidências (antes/durante)

- **Ação do usuário:** lê a classificação proposta: projeto, módulo, tipo (tarefa, bug, decisão, bloqueio, observação etc.), prioridade, prazo e relações com demandas anteriores.
- **Pensamentos/perguntas:** “Por que ele achou que é o VistaFor?” “De onde saiu essa prioridade?” “Isso não é a mesma coisa daquela outra tarefa?”
- **Emoções:** confiança quando as evidências fazem sentido; desconfiança quando a justificativa é vaga.
- **Pontos de dor:** IA sem contexto associar a demanda ao projeto errado; classificação sem explicação; duplicidades não detectadas.
- **Touchpoints:** caixa de entrada e tela de revisão contextual: projeto sugerido, projetos alternativos, módulo, tipo, confiança, evidências, trechos que originaram cada informação, possíveis duplicidades.
- **Oportunidades:** exibir sempre as evidências (ex.: menção a “planta” e “raster”, alias “PAX”, demandas anteriores sobre o mesmo erro); detectar duplicidade antes da criação e oferecer criar nova tarefa, atualizar existente, criar subtarefa, relacionar ou descartar.
- **Métricas:** entradas classificadas no projeto correto (meta 85%); classificações de alta confiança aceitas sem troca de projeto (meta 90%); duplicidades identificadas antes da criação (meta 80%).

### Etapa 4 — Desambiguação quando há dúvida (durante)

- **Ação do usuário:** responde à pergunta do sistema quando a confiança não é suficiente (ex.: “Essa demanda pertence ao ARPA 2 ou ao Processos Acompanhados?”) ou mantém a entrada na caixa de entrada para decidir depois.
- **Pensamentos/perguntas:** “Qual dos dois projetos faz sentido aqui?” “Vale responder agora ou depois?”
- **Emoções:** leve esforço adicional, tolerável quando a pergunta é curta e direta; frustração se perguntas se repetirem.
- **Pontos de dor:** confiança baixa sem alternativa clara; entrada parada na caixa de entrada sem encaminhamento.
- **Touchpoints:** tela de revisão contextual com projetos candidatos e percentuais; caixa de entrada para entradas abaixo de 60% de confiança.
- **Oportunidades:** confiança alta (≥85%) pré-seleciona o projeto, mas sempre mostra a classificação antes da confirmação; confiança média (60–84%) pede confirmação simples; confiança baixa (<60%) pergunta ao usuário; toda resposta vira sinal para classificações futuras.
- **Métricas:** redução progressiva das entradas de baixa confiança; correções refletidas em classificações futuras (meta 80%).

### Etapa 5 — Revisão e aprovação do plano (durante)

- **Ação do usuário:** revisa a proposta completa: cards sugeridos (principalmente tarefas), reuniões, notas, marcos, decisões, contextos e tags de apoio; corrige, rejeita ou reordena ações; aprova o plano.
- **Pensamentos/perguntas:** “Essas ações estão na ordem certa?” “Posso rejeitar uma parte e aprovar outra?” “O que acontece exatamente quando eu aprovar?”
- **Emoções:** sensação de controle quando cada ação pode ser editada individualmente; segurança ao saber que nada é executado antes da aprovação.
- **Pontos de dor:** sugestões incompletas ou inventadas; medo de perder dados; não entender a ordem de dependência entre ações da mesma proposta.
- **Touchpoints:** aba/tela Revisão IA: texto original, transcrição, resumo, cards sugeridos, ordem de execução e vínculos entre ações, controle para corrigir ou rejeitar cada ação, ações de confirmar/editar/unir/dividir/descartar/enviar ao Trello.
- **Oportunidades:** confirmação proporcional ao risco — classificar exige confirmação simplificada; criar tarefa, confirmação normal; alterar prioridade ou prazo, confirmação explícita; atualizar várias tarefas, confirmação reforçada; modificar código ou executar comandos, aprovação obrigatória. Permitir aprovação parcial: somente as ações aprovadas são executadas, respeitando a ordem de dependência.
- **Métricas:** sugestões aceitas após edição mínima (meta 70%); tarefas com status definido após revisão (meta 95%).

### Etapa 6 — Execução pelo backend (durante)

- **Ação do usuário:** acompanha o resultado: tarefas criadas, vínculos registrados, sincronização com o Trello; desfaz ou corrige se necessário.
- **Pensamentos/perguntas:** “Foi criado exatamente o que aprovei?” “O Trello já está sincronizado?” “Consigo desfazer se estiver errado?”
- **Emoções:** tranquilidade quando o resultado é imediato e rastreável; insegurança quando o estado de sincronização não é visível.
- **Pontos de dor:** falha parcial na execução sem aviso; sincronização com o Trello fora do ar sem indicação clara; alterações silenciosas.
- **Touchpoints:** serviços do backend (projetos, tarefas, prazos, roadmap, Trello, memória contextual, auditoria); indicador de sincronização; histórico de alterações; tela de conflitos Trello ↔ aplicativo.
- **Oportunidades:** o agente nunca altera o banco diretamente — toda ação passa pelos serviços e regras de negócio do backend (fonte de verdade); auditoria registra usuário, agente, ferramenta, parâmetros e resultado; conflitos com o Trello nunca são resolvidos com perda silenciosa (manter valor do app, manter valor do Trello, mesclar ou adiar).
- **Métricas:** alterações sincronizadas com o Trello (meta 95%); conflitos com perda silenciosa (meta 0).

### Etapa 7 — Visualização e acompanhamento (depois)

- **Ação do usuário:** consulta a mesma tarefa nas quatro visualizações: planilha, Kanban, roadmap e central de prazos; acompanha marcos, bloqueios e progresso; usa o plano diário para decidir o que fazer.
- **Pensamentos/perguntas:** “O que devo fazer hoje?” “O que está atrasado ou sem prazo?” “Esse marco ainda está no caminho?” “O que está bloqueado e qual a alternativa?”
- **Emoções:** clareza quando tudo está conectado; sobrecarga quando há muitos projetos e nenhuma prioridade visível.
- **Pontos de dor:** informações desconectadas entre ferramentas; prazos escondidos entre várias linhas; tarefas atrasadas sem destaque; não saber o que fazer primeiro.
- **Touchpoints:** tela “Hoje” (atrasadas, próximos 7 dias, plano de ação recomendado, entradas aguardando classificação); planilha com destaque de atrasos e origem por IA; Kanban com filtros e badges de marco; roadmap semana/mês/trimestre/ano; central de prazos (atrasadas, vencem hoje, 3/7/30 dias, sem prazo, aguardando retorno externo); detalhe do projeto.
- **Oportunidades:** manter vínculos entre nota de origem, tarefa, decisão e objetivo; cada recomendação do plano diário traz motivo da posição, próxima ação concreta e alternativa em caso de bloqueio; adiar prazo sempre com justificativa e histórico; nenhum prazo é alterado automaticamente pelo agente.
- **Métricas:** projetos visíveis em todas as visualizações (meta 100%); plano diário gerado adequadamente (meta 95%); tarefas importantes com prazo ou justificativa (meta 80%).

### Etapa 8 — Correção e aprendizado (depois)

- **Ação do usuário:** corrige uma classificação errada; registra regras e vocabulário do projeto; confirma, edita ou remove informações aprendidas; promove memórias temporárias para permanentes.
- **Pensamentos/perguntas:** “Como eu ensino o sistema a não errar isso de novo?” “O que o agente sabe sobre esse projeto?” “Posso apagar algo que ficou desatualizado?”
- **Emoções:** satisfação quando a correção evita o erro seguinte; desconforto se não souber o que o sistema aprendeu.
- **Pontos de dor:** memória desatualizada; contexto de projetos diferentes se misturar; aprendizado invisível ou não editável.
- **Touchpoints:** gestão de contexto do projeto (descrição, aliases, módulos, termos, regras aprendidas, memórias sugeridas, informações desatualizadas); registro da correção junto à entrada original; memória contextual com status de confirmação e expiração opcional.
- **Oportunidades:** toda associação aprendida é visualizável e editável; correções manuais podem originar aliases, módulos ou tags estruturados (nunca usuários ou entidades de pessoas); é possível ver quais classificações utilizaram cada informação; notas manuais são privadas e ficam fora da IA/MCP por padrão.
- **Métricas:** correções do usuário refletidas em classificações futuras (meta 80%); redução de classificações erradas repetidas por projeto.

---

## 3. Os três caminhos de entrada

| Etapa | Texto | Áudio | Trello |
|---|---|---|---|
| Entrada | Texto digitado ou colado | Áudio gravado ou arquivo enviado | Card criado no quadro Trello |
| Preparação | Nenhuma | Validação do arquivo, transcrição (pt-BR, pontuação, falantes quando possível), transcrição editável | Sincronização Trello → aplicativo (idempotente, sem duplicar em eventos repetidos) |
| Triagem | Agente consulta contexto, calcula confiança | Igual, sobre a transcrição | Agente identifica projeto interno, módulo, duplicidades e prioridade sugerida |
| Revisão | Tela de revisão contextual | Tela de revisão contextual + transcrição corrigível | Card pode virar tarefa/entrada conforme a confiança |
| Execução | Backend registra e sincroniza de volta ao Trello quando aplicável | Igual; áudio de entrada excluído após processamento, conforme política | Alterações aprovadas sincronizam nos dois sentidos |
| Desvio típico | Entrada mal interpretada | Transcrição com trechos incertos destacados para edição | Conflito de valores resolvido manualmente, sem perda silenciosa |

Os três caminhos convergem para a mesma caixa de entrada e a mesma revisão: a jornada muda na captura, não no controle.

---

## 4. Jornada ideal (caminho feliz)

1. O usuário grava um áudio curto relatando o bug: “A planta principal continua carregando automaticamente e travando o mapa. Coloca isso como prioridade alta.”
2. A transcrição chega à caixa de entrada; o usuário confere e ajusta um trecho.
3. O agente consulta contexto e propõe: projeto VistaFor (93%, alias “PAX”, termos “planta”/“mapa”, tarefas anteriores sobre raster), módulo Mapa/Loteamentos, tipo Bug, prioridade P1 — com evidências listadas.
4. Na revisão, o usuário confirma o card, ajusta o título e aprova o plano.
5. O backend cria a tarefa, registra a origem e as evidências na auditoria e sincroniza o card com o Trello.
6. A tarefa aparece na planilha, no Kanban, no roadmap e na central de prazos; o plano diário a posiciona com motivo e próxima ação.
7. Semanas depois, o usuário corrige uma classificação semelhante; a correção vira contexto editável do projeto e melhora as próximas triagens.

## 5. Desvios e estados de erro

| Situação | Comportamento do sistema | Recuperação do usuário |
|---|---|---|
| Classificação com projeto errado | Confiança e evidências visíveis; projetos alternativos listados | Corrige o projeto; correção alimenta classificações futuras |
| Confiança baixa (<60%) | Entrada permanece na caixa de entrada; sistema pergunta ao usuário | Responde depois, no seu ritmo; nada é criado sem definição |
| Duplicidade possível | Busca semântica antes da criação apresenta candidatas | Atualiza a existente, relaciona ou descarta |
| Conflito aplicativo ↔ Trello | Nada é sobrescrito silenciosamente | Escolhe manter valor do app, do Trello, mesclar ou adiar |
| IA indisponível | Cadastro manual segue disponível em qualquer tela; sugestão de autopreenchimento simplesmente não aparece | Cria tarefa manualmente com título e projeto; fluxo não bloqueia |
| Transcrição falha ou ruim | Trechos incertos destacados; texto original preservado | Edita a transcrição ou reprocessa com outro provedor |
| Falha parcial na execução | Apenas ações aprovadas e válidas executam; falhas ficam visíveis com estado de sincronização | Reenvia operações pendentes; corrige e reaprova |
| Trello fora do ar | Uso local não é impedido; operações pendentes ficam em fila | Sincroniza quando o serviço voltar; estado permanece visível |
| Memória desatualizada | Gestão de contexto lista informações com última utilização e expiração opcional | Corrige, remove ou confirma informação aprendida |

Regra transversal: falhas de agente, modelo, STT ou serviços externos nunca impedem o uso manual; o sistema degrada para o caminho manual em vez de bloquear (PRD, seções 6.5 e 19.2).

---

## 6. Controles do usuário em toda a jornada

- Toda classificação mostra confiança e evidências antes de qualquer confirmação.
- Toda ação sensível exige aprovação explícita: alterar prazos, prioridades críticas, várias tarefas, arquivar, alterar memória permanente, enviar a serviços externos, modificar código ou executar comandos.
- O agente propõe; somente o backend executa, após aprovação, passando por regras de negócio e auditoria.
- Nenhum prazo é alterado automaticamente; adiar prazo exige justificativa e registra histórico.
- O aprendizado é corrigível: toda informação aprendida é visualizável, editável, confirmável e removível.
- O usuário pode ignorar a IA em qualquer etapa: criação manual, edição direta na planilha/Kanban e revisão das entradas.

## 7. Resultado esperado

O usuário passa de demanda não estruturada — texto, áudio ou card solto no Trello — para plano executável e rastreável, com controle explícito em cada transição: captura sem atrito, triagem explicada, aprovação antes da execução, acompanhamento em visualizações conectadas e aprendizado contínuo que ele próprio governa.
