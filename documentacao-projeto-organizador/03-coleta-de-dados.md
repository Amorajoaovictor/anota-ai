# Coleta de dados — plano de pesquisa com usuários

Este documento é o plano de pesquisa acionável do projeto, derivado do PRD v2.0 (fonte normativa). Ele define o que validar, com quem, como, e como os resultados serão registrados e usados para revisar decisões de produto.

> **Importante:** até o momento **nenhuma entrevista ou teste com terceiros foi realizado**. Tudo o que está marcado como *Hipótese* ainda não foi validado; apenas os itens marcados como *Evidência existente* representam fatos observados.

---

## 1. Objetivo da pesquisa

Validar, antes e durante a construção do MVP, se o produto resolve o problema central descrito no PRD: demandas fragmentadas entre planilhas, Trello, mensagens, áudios, reuniões e memória pessoal, sem uma visão única do que é urgente.

A pesquisa deve responder a três perguntas mestras:

1. A fragmentação descrita no PRD é vivida da mesma forma por outras pessoas que administram múltiplos projetos?
2. Um agente contextual que classifica entradas com confiança, evidências e confirmação gera mais confiança do que um cadastro totalmente manual?
3. Em quais situações o usuário aceita delegar à IA, e em quais exige controle manual?

---

## 2. Evidência existente vs. hipóteses

### 2.1 Evidência existente (já observada)

Estes fatos originaram o PRD e **não precisam ser revalidados como problema**, mas suas generalizações sim:

- O criador do projeto administra múltiplos projetos simultaneamente e precisa centralizar ideias, tarefas e roadmap.
- Existe hoje uma planilha de acompanhamento com estrutura inconsistente (mistura de status/etapa/responsável, pendências heterogêneas, prazos raramente preenchidos), descrita na seção 3 do PRD.
- Projetos reais já são acompanhados nela (ex.: Intranet, Observa SEUMA, Guichê Virtual, PAX/VistaFor, Monitoramento do Ar, App Vistoria — CELAM/NUEE).
- O mesmo projeto é chamado por nomes diferentes (ex.: PAX como nome anterior do VistaFor) e possui vocabulário próprio ("planta", "raster", "quadra", "loteamento").
- Áudios precisam hoje ser transformados manualmente em atividades.
- O Trello já é usado como ferramenta operacional, em paralelo à planilha, gerando atualização duplicada.

### 2.2 Hipóteses a validar (ainda sem evidência)

| # | Hipótese | Tema | Como validar |
|---|---|---|---|
| H1 | Outras pessoas que gerenciam múltiplos projetos perdem demandas por não saberem onde registrar | Fragmentação | Diário + entrevistas |
| H2 | Um agente que sugere projeto/módulo/tipo com evidências é preferido ao preenchimento manual de todos os campos | Confiança na IA | Teste de fluxo |
| H3 | Mostrar o nível de confiança e as evidências da classificação aumenta a taxa de aceite da sugestão | Confiança na IA | Teste de fluxo A/B |
| H4 | Usuários aceitam confirmação simplificada para classificação, mas exigem confirmação explícita para alterações de prioridade, prazo e ações em lote | Confirmação | Teste de fluxo + entrevistas |
| H5 | A criação manual rápida (disponível em qualquer tela) é essencial e segue sendo usada mesmo quando a IA funciona bem | Criação manual | Teste de fluxo |
| H6 | Usuários gravariam áudios para registrar demandas se a transcrição e a extração fossem confiáveis em português | Áudio | Teste de fluxo + entrevistas |
| H7 | A sincronização bidirecional com o Trello reduz trabalho duplicado sem gerar medo de perda de dados | Trello | Entrevistas + teste de fluxo |
| H8 | Lembretes em múltiplos momentos (metade do prazo, 7, 3 e 1 dia) são suficientes; não é necessário mais | Prazos | Diário + entrevistas |
| H9 | Contexto acumulado por projeto (aliases, vocabulário, decisões anteriores) é o que diferencia a classificação correta da errada | Contexto | Teste de fluxo |
| H10 | O usuário confia em deixar notas pessoais fora do alcance da IA/MCP por padrão e quer decidir o que expor | Privacidade | Entrevistas |
| H11 | Ações sensíveis (alterar prazo/prioridade, operações em lote, MCP) só serão aceitas com aprovação obrigatória | Confirmação | Teste de fluxo + entrevistas |

---

## 3. Perfis e recrutamento

### 3.1 Perfis

| Perfil | Descrição | Qtde. alvo | Prioridade |
|---|---|---|---|
| P0 — Criador | Usuário 0; dono do problema original e da planilha real | 1 | Já incluído (auto-observação) |
| P1 — Gestor multi-projeto técnico | Pessoa que administra simultaneamente projetos de software, demandas institucionais, correções e prazos (perfil descrito na seção 5 do PRD) | 3 a 5 | Alta |
| P2 — Usuário de Trello + planilha | Pessoa que hoje combina Kanban/Trello com planilhas e notas, mesmo sem perfil técnico | 2 | Média |

### 3.2 Critérios de recrutamento

- Administra pelo menos 3 projetos ou frentes de trabalho simultâneas.
- Usa ao menos duas ferramentas de organização ao mesmo tempo (planilha, Trello, notas, mensagens).
- Já perdeu ou esqueceu alguma demanda, prazo ou decisão de reunião (critério de triagem).
- Disponibilidade para 1 entrevista (45–60 min) + 1 sessão de teste de fluxo (45 min) + até 5 dias de diário.

### 3.3 Como recrutar

- Convite direto a colegas com perfil semelhante ao do criador (P1), deixando claro que a participação é voluntária e não vinculada a avaliação de desempenho.
- Triagem por questionário curto (5 perguntas) cobrindo os critérios acima.
- Registro de cada participante com código anônimo (ex.: `ENT-01`), nunca por nome, nos artefatos de pesquisa.

---

## 4. Métodos

### 4.1 Método A — Diário de auto-observação (criador, semana 1)

O criador registra durante uma semana de trabalho real:

1. Toda situação em que uma ideia, tarefa, decisão ou prazo quase foi perdido ou foi perdido.
2. Em qual ferramenta a informação nasceu (mensagem, reunião, áudio, memória) e onde foi registrada.
3. Tempo gasto para transformar uma informação solta em tarefa planejada.
4. Quantas vezes a mesma informação precisou ser atualizada em mais de uma ferramenta (planilha + Trello).
5. Toda vez que um áudio ou reunião gerou ação manual de transcrição/anotação.

**Saída esperada:** tabela de eventos com data, tipo de perda, ferramentas envolvidas e tempo gasto. Serve de base concreta para as entrevistas e para os cenários do teste de fluxo.

### 4.2 Método B — Entrevistas semiestruturadas (45–60 min)

Objetivo: entender contexto, frustrações e limites de confiança do participante. Roteiro na seção 5. Devem ser gravadas somente com consentimento explícito; caso contrário, anotações escritas.

### 4.3 Método C — Teste de fluxo com protótipo (45 min)

Usar o protótipo navegável descrito em `10-prototipo-alta-fidelidade.md` (ou, quando existir, build inicial do MVP). O participante executa as tarefas da seção 6 enquanto o observador anota:

- Sucesso ou falha em cada tarefa.
- Tempo para concluir.
- Momentos de hesitação, confusão ou erro.
- Reações espontâneas às sugestões da IA (aceite, desconfiança, correção).

**Regra:** não explicar a interface antes do participante tentar; intervir apenas se houver bloqueio completo.

---

## 5. Roteiro de entrevistas

### 5.1 Abertura (5 min)

- Objetivo da conversa; nenhum conhecimento prévio é testado.
- Consentimento para gravação e uso anônimo das respostas.

### 5.2 Contexto e fragmentação (15 min) — H1, H8

1. Quantos projetos ou frentes você acompanha hoje? Como os acompanha?
2. Onde você registra uma ideia ou demanda nova no momento em que ela aparece?
3. Já perdeu ou quase perdeu uma demanda, prazo ou decisão por não saber onde estava? Conte o caso.
4. Como você sabe o que fazer hoje? Existe uma visão única de urgências?
5. Como lida com prazos — onde ficam, como são lembrados, o que acontece quando passam?

### 5.3 Transformação e priorização (10 min) — H1, H8

6. Como uma ideia vira tarefa executável? Quanto tempo isso leva?
7. Como define prioridades quando tudo parece urgente?
8. Como acompanha entregas futuras e o que está bloqueado?

### 5.4 Ferramentas e duplicação (10 min) — H7

9. Quais ferramentas usa em combinação (planilha, Trello, notas, mensagens)? Qual manda em quê?
10. Com que frequência precisa registrar a mesma coisa em dois lugares? O que acontece quando divergem?
11. Se o Trello sincronizasse automaticamente com sua central, o que te tranquilizaria? O que te preocuparia?

### 5.5 Áudio e entrada natural (5 min) — H6

12. Você costuma gravar áudios ou ditados para não esquecer coisas de trabalho? Que tipo?
13. O que te faria confiar (ou desconfiar) que um áudio transcrito virasse uma tarefa correta?

### 5.6 IA: confiança, evidências e confirmação (15 min) — H2, H3, H4, H9, H10, H11

14. Se uma IA classificasse automaticamente a qual projeto uma demanda pertence, o que você precisaria ver para confiar na sugestão?
15. Faz diferença para você ver o nível de confiança (ex.: 93%) e as evidências (termos citados, demandas anteriores relacionadas)? Por quê?
16. Que tipo de ação você deixaria a IA fazer sozinha? E qual exigiria sua aprovação sempre? (Apresentar a escada do PRD: classificar → criar tarefa → alterar prazo/prioridade → ações em lote → operações sensíveis.)
17. Se a IA errasse o projeto, como você gostaria de corrigir? Confiaria que ela aprenderia com a correção?
18. Você teria notas pessoais que não gostaria que nenhuma IA lesse ou usasse? Como gostaria de controlar isso?

### 5.7 Encerramento (5 min)

19. Qual é o maior incômodo nas suas ferramentas atuais, em uma frase?
20. O que você confiaria à IA hoje, e o que jamais confiaria?

---

## 6. Tarefas de observação (teste de fluxo)

Cada tarefa abaixo mapeia hipóteses. Registrar para cada uma: sucesso (sim/parcial/não), tempo, erros e fala espontânea.

| # | Tarefa no protótipo | Hipóteses |
|---|---|---|
| T1 | Registrar uma entrada livre na caixa de entrada ("A planta principal continua travando o mapa; prioridade alta") e revisar a classificação proposta pela IA, verificando projeto, evidências e confiança | H2, H3, H9 |
| T2 | Corrigir uma classificação errada proposta pela IA (trocar o projeto sugerido) | H2, H9 |
| T3 | Criar uma tarefa manualmente usando a criação rápida, sem passar pela IA | H5 |
| T4 | Simular a queda do serviço de IA e constatar que o cadastro manual continua funcionando | H5 |
| T5 | Gravar (ou reproduzir) um áudio curto e revisar a transcrição e as entidades propostas (tarefa, reunião, nota) | H6 |
| T6 | Aprovar uma proposta simples (classificar) e uma proposta sensível (alterar prazo de tarefa existente), comparando o nível de confirmação exigido | H4, H11 |
| T7 | Verificar o reflexo de uma tarefa criada no quadro Trello sincronizado e identificar como um conflito seria apresentado | H7 |
| T8 | Localizar, na central de prazos, tarefas atrasadas, próximas do prazo e sem prazo | H8 |
| T9 | Consultar uma decisão anterior registrada de um projeto e o contexto associado | H9 |
| T10 | Confirmar que uma nota pessoal marcada como privada não aparece nas sugestões da IA | H10 |

---

## 7. Métricas e sinais de sucesso

As métricas de pesquisa antecipam os indicadores de sucesso do PRD (seção 20) e serão medidas durante o teste de fluxo e o diário:

| Métrica de pesquisa | Fonte | Sinal de sucesso | Meta indicativa |
|---|---|---|---|
| Entradas classificadas no projeto correto | Teste T1 | Confirma viabilidade do agente | ≥ 85% |
| Sugestões de alta confiança aceitas sem troca de projeto | Teste T1 | Confirma H2/H3 | ≥ 90% |
| Tarefas importantes com prazo ou justificativa após a sessão | Teste T8 | Confirma utilidade da central de prazos | ≥ 80% |
| Percepção de redução de atualização duplicada (Trello + app) | Entrevista + T7 | Confirma H7 | ≥ 80% |
| Eventos de perda de demanda registrados no diário | Diário (Método A) | Linha de base do problema | Reduzir após adoção |
| Tempo para transformar informação solta em tarefa planejada | Diário + T1/T3 | Reduzir vs. linha de base | Comparar antes/depois |
| Correções do usuário refletidas em classificações futuras | Teste T2 reaplicado | Confirma aprendizado corrigível | ≥ 80% |
| Taxa de conclusão das tarefas T1–T10 sem ajuda | Teste de fluxo | Usabilidade mínima | 100% das críticas |

**Sinais qualitativos de sucesso:** participante verbaliza que deixaria de usar uma ferramenta redundante; demonstra interesse em revisar as evidências da IA em vez de ignorá-las; afirma que usaria áudio como entrada principal em alguma situação do seu dia.

**Sinais de alerta:** participante corrige a IA repetidamente no mesmo ponto; prefere preencher todos os campos manualmente sem ser solicitado; expressa receio de perda de dados na sincronização; considera invasiva qualquer leitura de notas.

---

## 8. Registro e análise

### 8.1 Registro

- Cada evento de diário, entrevista e sessão de teste gera um registro padronizado em arquivo próprio da pesquisa (pasta de trabalho, fora desta documentação), com: código do participante, data, método, tarefa/pergunta, observação bruta, tempo e hipótese relacionada.
- Gravações de áudio/vídeo somente com consentimento; armazenadas com acesso restrito; transcrições anonimizadas.
- Nenhum nome real de participante aparece em registros ou relatórios.

### 8.2 Análise

1. Codificar observações por hipótese (H1–H11) e por tema (fragmentação, confiança, confirmação, áudio, Trello, prazos, contexto, privacidade).
2. Para cada hipótese, registrar o veredito com evidência citável:
   - **Validada** — evidência suficiente em ≥ 2 participantes ou evidência forte do usuário 0 + 1 participante.
   - **Refutada** — evidência contrária consistente.
   - **Inconclusiva** — sem dados suficientes; permanece como hipótese.
3. Consolidar em relatório curto por rodada (máx. 1 página por método), ligando achados a decisões do PRD.

### 8.3 Critérios para revisar decisões do produto

A pesquisa só cumpre seu papel se alterar decisões quando necessário. Regras:

- **Hipótese refutada que sustenta decisão do PRD** → a decisão correspondente deve ser reavaliada e documentada como "em revisão" antes da próxima fase de construção.
- **Validada** → registrar a evidência na documentação do produto (ex.: cenário, requisito ou decisão) citando o código do participante.
- **Inconclusiva** → replanejar coleta (nova tarefa de teste ou pergunta) antes de construir a funcionalidade dependente, exceto se a funcionalidade já for necessária por outros motivos.
- Achados inesperados entram como novas hipótesas na próxima rodada, nunca como requisitos imediatos sem triagem.

---

## 9. Ética e privacidade

- Participação voluntária, com direito de retirada a qualquer momento, sem consequência para o participante.
- Consentimento explícito registrado antes de qualquer gravação; consentimento separado para uso de exemplos reais de trabalho do participante.
- Anonimização obrigatória: nomes de pessoas, clientes e dados sensíveis removidos dos artefatos; exemplos adaptados quando identificáveis.
- A regra de privacidade do produto também vale para a pesquisa: notas pessoais são privadas por padrão e não devem ser expostas a IA/MCP; nenhum dado de participante será usado para treinar ou alimentar agentes.
- Gravações e registros de pesquisa têm acesso restrito e prazo de retenção definido no início da rodada.

---

## 10. Limitações

- A base inicial de evidência vem de um único usuário (o criador); qualquer generalização depende dos resultados desta pesquisa.
- Amostra pequena (5 a 8 pessoas) é exploratória: indica direção, não significância estatística.
- O teste de fluxo com protótipo mede reação à proposta, não comportamento de uso prolongado; conclusões sobre hábito exigirão acompanhamento após o MVP.
- Resultados não devem ser citados como "entrevistas concluídas" ou validação de produto até que o registro correspondente exista neste plano.

---

## 11. Próximos passos imediatos

1. Iniciar o diário de auto-observação (Método A, semana 1).
2. Montar o questionário de triagem e convidar participantes P1/P2.
3. Preparar o protótipo e o script do teste de fluxo com as tarefas T1–T10.
4. Executar a primeira rodada: diário → entrevistas → testes de fluxo → relatório com vereditos por hipótese.
