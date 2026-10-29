# Geração de cenários positivo e negativo

Este documento descreve cenários realistas de uso do Organizador Pessoal Inteligente de Projetos, com base no PRD v2.0. Eles servem para validar regras de produto antes da implementação: classificação por confiança e evidências, confirmação proporcional ao risco, backend como fonte de verdade e disponibilidade dos recursos manuais.

Cada cenário registra quatro elementos:

- **Contexto:** situação do usuário e estado do sistema antes do fluxo.
- **Fluxo:** passos executados pelo usuário e pelo sistema.
- **Resultado esperado:** estado observável ao final.
- **Salvaguardas:** mecanismos do PRD que garantem o resultado e impedem danos.

Os cenários positivos mostram o produto funcionando como planejado. Os negativos mostram erros de interpretação e de integração sendo contidos pelas salvaguardas. Os de indisponibilidade mostram degradação controlada de serviços externos.

---

## 1. Cenários positivos

### 1.1 Texto com confiança alta: classificação direta de projeto e módulo

**Contexto.** Alex administra vários projetos, entre eles o VistaFor, cadastrado com o alias “PAX” e os termos relacionados “planta”, “raster”, “loteamento”, “quadra” e “mapa”. Ele digita na caixa de entrada: “A planta principal continua carregando automaticamente e travando o mapa. Coloca isso como prioridade alta.”

**Fluxo.**

1. A entrada chega à caixa de entrada como texto.
2. O agente consulta aliases, vocabulário, tarefas semelhantes e decisões anteriores.
3. Calcula confiança de 93% para VistaFor e 88% para o módulo Mapa/Loteamentos.
4. Classifica o tipo como Bug, extrai a prioridade alta informada e gera a proposta estruturada.
5. A tela de revisão exibe projeto sugerido, módulo, tipo, prioridade, confiança e evidências (“o texto menciona planta”, “existem demandas anteriores sobre raster no VistaFor”, “PAX é alias do VistaFor”).
6. Como a confiança é alta (≥ 85%), o projeto já vem pré-selecionado.
7. Alex confere, mantém a sugestão e confirma.

**Resultado esperado.** A tarefa “Impedir carregamento automático da planta principal” é criada no VistaFor, módulo Mapa, tipo Bug, prioridade P1, visível na planilha, no Kanban e no roadmap. A entrada contextual fica vinculada à tarefa como origem, e a classificação com evidências fica registrada em auditoria.

**Salvaguardas.** Mesmo com confiança alta, a classificação é exibida antes da confirmação final (PRD 9.7); nada é gravado sem aprovação. Toda ação passa pelos serviços do backend (PRD 6.4), nunca por acesso direto do agente ao banco.

### 1.2 Áudio com confiança média: confirmação simples do projeto

**Contexto.** No fim do dia, Alex grava um áudio de 40 segundos relatando que “a tela de processos não está mostrando o prazo e o pessoal do jurídico reclamou”. Não há menção explícita ao nome do projeto.

**Fluxo.**

1. O áudio é validado, armazenado temporariamente e transcrito pelo serviço de speech-to-text, em português, com pontuação automática e destaque de trechos incertos.
2. A transcrição é enviada ao agente, que encontra dois projetos candidatos: Processos Acompanhados (72%) e ARPA 2 (25%).
3. Como a confiança é média (60–84%), o sistema destaca os projetos mais prováveis e pede confirmação simples.
4. Alex seleciona Processos Acompanhados, ajusta o título sugerido e confirma.

**Resultado esperado.** A tarefa é criada no projeto correto, com a transcrição preservada junto à entrada contextual. A escolha de Alex é registrada como sinal para classificações futuras (PRD 9.8).

**Salvaguardas.** O áudio original e a transcrição ficam preservados e editáveis (PRD 13.1 e 13.2). O projeto nunca é aplicado automaticamente em confiança média. A política de retenção de áudio é configurável.

### 1.3 Proposta multi-entidade a partir de áudio de reunião

**Contexto.** Alex grava o resumo de uma reunião: “Ficou decidido que o relatório mensal sai até sexta. Marca uma reunião com a CEGEO na terça para validar as medidas. E lembra que medidas só vão para validação depois da CEGEO aprovar.”

**Fluxo.**

1. A transcrição chega ao agente, que identifica múltiplas entidades na mesma entrada:
   - uma decisão (“relatório mensal sai até sexta”);
   - uma reunião com a CEGEO na terça (lembrete com título, data e horário);
   - uma regra de contexto para o projeto (“demandas sobre medidas passam por validação da CEGEO”);
   - uma tarefa de acompanhamento do relatório, como card principal.
2. O agente gera uma proposta única com as ações relacionadas, em ordem de execução (a tarefa depende da reunião; o contexto é independente).
3. A tela de revisão mostra o plano completo: texto original, transcrição, cada ação proposta, os trechos que originaram cada informação e os vínculos entre elas.
4. Alex edita o título da tarefa, mantém reunião e regra, rejeita uma tag sugerida e aprova o plano de uma vez.
5. O backend executa somente as ações aprovadas, respeitando a ordem de dependência.

**Resultado esperado.** Tarefa, reunião, decisão e memória contextual criadas e vinculadas entre si. A reunião aparece na visão global e na aba do projeto (PRD 10.9). A regra aprendida fica visível e editável na gestão de contexto (PRD 6.6 e 12.9).

**Salvaguardas.** Cada ação pode ser corrigida ou rejeitada individualmente antes da aprovação do plano (PRD 6.3). A extração prioriza cards sem ignorar reuniões, notas e marcos (PRD 13.3). Entidades só existem após confirmação (PRD 21.4).

### 1.4 Detecção de duplicidade antes da criação

**Contexto.** Um colega comenta no Trello que “o carregamento do raster está lento de novo”. O card chega à caixa de entrada como entrada contextual vinda do Trello.

**Fluxo.**

1. Antes de propor criação, o agente pesquisa títulos semelhantes, descrições semanticamente relacionadas, mesmo módulo, mesma origem e cards relacionados no Trello (PRD 9.9).
2. Encontra uma tarefa aberta idêntica no VistaFor, módulo Mapa.
3. Em vez de propor nova tarefa, sugere “atualizar tarefa existente” com uma observação relatando a reincidência, exibindo a demanda semelhante e as evidências.
4. Alex aprova a observação.

**Resultado esperado.** Nenhuma tarefa duplicada é criada. A tarefa existente recebe a observação, e o card do Trello fica relacionado a ela. O indicador de origem mostra que a atualização veio de entrada do Trello.

**Salvaguardas.** Busca de duplicidade é etapa obrigatória antes da criação. Webhooks idempotentes impedem que eventos repetidos do Trello gerem registros duplicados (PRD 19.1 e 21.6).

### 1.5 Correção da classificação e aprendizado registrado

**Contexto.** Alex escreve “atualizar as normas jurídicas do módulo de logradouros”. O agente classifica como Observa SEUMA com 68% de confiança, mas a demanda pertence ao VistaFor.

**Fluxo.**

1. A tela de revisão mostra o projeto sugerido com confiança média e projetos alternativos.
2. Alex troca o projeto para VistaFor e confirma.
3. O sistema registra a correção e identifica que ela revela um padrão recorrente.
4. Sugere registrar a associação como contexto do projeto e, se aplicável, um alias ou termo estruturado — sem criar usuários ou entidades de pessoas (PRD 6.6).
5. Alex aprova o novo contexto na gestão de contexto.

**Resultado esperado.** A tarefa nasce no VistaFor. A correção fica registrada em auditoria e passa a influenciar classificações futuras; a informação aprendida é visualizável e editável pelo usuário.

**Salvaguardas.** Correções nunca são aplicadas em silêncio: toda associação aprendida exige visualização e aprovação (PRD 6.6 e 12.9). O histórico mostra quais classificações utilizaram cada informação.

### 1.6 Prazo sensível identificado na entrada

**Contexto.** Alex registra: “Enviar a prestação de contas do Monitoramento do Ar até 25/08, senão o órgão notifica.”

**Fluxo.**

1. O agente classifica a entrada com confiança alta no projeto Monitoramento do Ar e extrai o prazo explícito de 25/08.
2. Como alterar ou definir prazo é ação sensível, a proposta apresenta o prazo identificado e pede confirmação explícita (PRD 6.3).
3. Alex confirma a tarefa e o prazo.

**Resultado esperado.** A tarefa aparece na central de prazos nas seções correspondentes (“próximos sete dias” etc.), com lembretes na metade do prazo e a 7, 3 e 1 dia antes (PRD, Fase 5). O prazo original e qualquer adiamento futuro ficam registrados no histórico.

**Salvaguardas.** O prazo só é gravado após confirmação explícita. Nenhum prazo é alterado automaticamente pelo agente (PRD 12.7). Adiar prazo exige justificativa e contabiliza adiamentos.

### 1.7 Sincronização bidirecional com o Trello sem conflito

**Contexto.** O projeto Guichê Virtual tem quadro Trello vinculado, com listas associadas aos status.

**Fluxo.**

1. Alex conclui uma tarefa no Kanban do aplicativo.
2. A sincronização aplicativo → Trello move o card para a lista correspondente e atualiza o estado do card (PRD 14.3).
3. No dia seguinte, um colega move outro card diretamente no Trello.
4. A sincronização Trello → aplicativo atualiza o status da tarefa local (PRD 14.4).
5. A tela Hoje exibe as alterações recentes vindas do Trello, e o indicador de sincronização mostra o estado atual.

**Resultado esperado.** As duas ferramentas permanecem consistentes, com origem de cada operação registrada. O aplicativo segue como fonte de verdade para memória contextual, dependências, roadmap, decisões e auditoria (PRD 14.1).

**Salvaguardas.** Idempotência e registro de origem impedem ciclos de sincronização (PRD 24). Somente campos mapeados sincronizam; informações exclusivas do aplicativo (decisões, contexto, histórico de IA) não vazam para o Trello.

---

## 2. Cenários negativos

### 2.1 Confiança baixa: entrada permanece na caixa de entrada

**Contexto.** Alex cola um trecho de e-mail: “Precisamos ajustar aquela integração conforme combinado.” Não há termos que remetam a nenhum projeto cadastrado.

**Fluxo.**

1. O agente calcula confiança abaixo de 60% para todos os projetos candidatos.
2. Nenhuma classificação é aplicada. A entrada permanece na caixa de entrada com status “aguardando confirmação”.
3. O sistema pergunta a qual projeto ela pertence e lista os candidatos mais próximos, se houver.
4. A entrada também aparece na tela Hoje, na área de entradas aguardando classificação e de baixa confiança.
5. Quando Alex tiver tempo, ele atribui o projeto manualmente ou descarta a entrada.

**Resultado esperado.** Nenhuma tarefa é criada no projeto errado. A informação não se perde: fica retida, visível e recuperável na caixa de entrada (PRD 9.7).

**Salvaguardas.** Confiança baixa nunca gera criação automática. A pergunta de esclarecimento usa a resposta futura como sinal de aprendizado (PRD 9.8).

### 2.2 Desambiguação entre dois projetos prováveis

**Contexto.** A entrada “A tela de processos não está mostrando o prazo” gera dois candidatos fortes: Processos Acompanhados (72%) e ARPA 2 (25%), porque ambos lidam com processos e prazos.

**Fluxo.**

1. O sistema apresenta os candidatos com suas confianças e pergunta: “Essa demanda pertence ao ARPA 2 ou ao Processos Acompanhados?” (PRD 9.8).
2. Alex responde Processos Acompanhados.
3. A resposta é registrada como sinal para classificações futuras.

**Resultado esperado.** A entrada é classificada corretamente, e o sistema fica mais preciso para termos ambíguos semelhantes.

**Salvaguardas.** Empates técnicos e confianças próximas nunca são resolvidos por sorteio silencioso: sempre há pergunta explícita. Evidências exibidas permitem a Alex entender por que a dúvida existiu.

### 2.3 IA interpreta mal uma entrada incompleta

**Contexto.** Alex anota rapidamente “corrigir o relatório”. Sem mais detalhes, o agente propõe uma tarefa de Bug no projeto Intranet com prioridade P0 — interpretação incorreta: trata-se de uma melhoria no Observa SEUMA, prioridade P2.

**Fluxo.**

1. A proposta chega à tela de revisão com confiança e evidências.
2. Alex percebe o erro antes de confirmar: troca projeto, tipo e prioridade nos próprios campos da revisão.
3. Confirma a versão corrigida.
4. O sistema registra a correção como sinal de aprendizado (cenário 1.5).

**Resultado esperado.** Apenas a versão corrigida é gravada. Kanban, roadmap e planilha permanecem consistentes porque a ação errada nunca chegou ao banco.

**Salvaguardas.** O fluxo obrigatório de revisão (propor → revisar → confirmar) impede que a interpretação errada vire dado (PRD 1 e 6.3). Classificações sem evidências suficientes pedem esclarecimento em vez de arriscar.

### 2.4 Transcrição ruim de áudio ambíguo

**Contexto.** Alex grava um áudio em ambiente ruidoso. O serviço de speech-to-text devolve uma transcrição com trechos incertos e nomes próprios deformados.

**Fluxo.**

1. A transcrição chega à revisão com os trechos incertos destacados (PRD 13.2).
2. Alex percebe que o agente classificou a entrada em um projeto errado por causa de uma palavra transcrita incorretamente.
3. Ele edita a transcrição e aciona a reanálise, ou corrige diretamente a classificação.
4. Se preferir, registra tudo apenas como observação, sem criar tarefa.

**Resultado esperado.** Nenhum registro incorreto é criado. A entrada pode ser reprocessada com outro provedor de transcrição, se necessário (PRD 13.2).

**Salvaguardas.** A transcrição é sempre editável antes da classificação definitiva. O conteúdo original do áudio e o texto original são preservados para conferência.

### 2.5 Rejeição parcial de uma proposta multi-entidade

**Contexto.** Uma entrada de reunião gera proposta com tarefa, marco e duas notas. O agente propôs também alterar o prazo de uma tarefa existente — ação sensível que Alex considera precipitada.

**Fluxo.**

1. A revisão exibe o plano completo com ordem de execução e dependências.
2. Alex aprova tarefa e marco, rejeita a alteração de prazo e edita uma das notas.
3. O sistema executa somente as ações aprovadas, na ordem correta, resolvendo referências entre entidades recém-criadas (PRD, Fase 4).

**Resultado esperado.** As ações aprovadas são gravadas; a alteração de prazo não ocorre. A proposta rejeitada fica registrada em auditoria como não executada.

**Salvaguardas.** A execução respeita a aprovação item a item; rejeitar uma ação nunca derruba ações independentes aprovadas, e ações dependentes de uma rejeitada são sinalizadas, não executadas às escondidas (PRD 6.3).

### 2.6 Conflito de sincronização com o Trello

**Contexto.** Alex altera a descrição de uma tarefa no aplicativo enquanto um colega altera a descrição do mesmo card no Trello, antes da sincronização.

**Fluxo.**

1. A sincronização detecta o conflito de valores para o mesmo campo.
2. O sistema apresenta o conflito com as duas versões e as opções: manter valor do aplicativo, manter valor do Trello, mesclar ou adiar a resolução (PRD 14.6).
3. O estado de sincronização fica visível enquanto o conflito está pendente.
4. Alex escolhe “mesclar” e valida o texto final.

**Resultado esperado.** Nenhuma das duas versões é perdida silenciosamente. A resolução fica registrada no histórico e a sincronização é concluída.

**Salvaguardas.** Conflitos nunca são resolvidos por sobrescrita automática (PRD 14.6). O indicador de metas exige zero conflitos com perda silenciosa (PRD 20).

### 2.7 Evento repetido do Trello

**Contexto.** O webhook do Trello reenvia o mesmo evento de criação de card por instabilidade de rede.

**Fluxo.**

1. O backend recebe o evento duplicado.
2. O processamento idempotente reconhece que o card já foi importado.
3. Nenhuma segunda tarefa ou entrada é criada.

**Resultado esperado.** O evento repetido é descartado com registro em auditoria, sem duplicar trabalho (PRD 19.1 e 21.6).

**Salvaguardas.** Idempotência de webhooks e registro da origem de cada operação protegem contra ciclos aplicativo ↔ Trello (PRD 24).

### 2.8 Operação sensível via MCP sem autorização

**Contexto.** Um cliente MCP externo com escopo apenas de leitura tenta chamar `tasks.update` para alterar o prazo de várias tarefas.

**Fluxo.**

1. A chamada é verificada contra os escopos de permissão do cliente (leitura, classificação, criação, atualização, sincronização, administração de contexto, operações sensíveis — PRD 15.3).
2. Sem escopo de atualização, a operação é negada.
3. Mesmo para clientes com escopo, alterar prazos, prioridades críticas ou várias tarefas exige confirmação explícita (PRD 15.4).
4. A tentativa negada fica registrada em auditoria com usuário, cliente, ferramenta, parâmetros e resultado.

**Resultado esperado.** Nenhuma tarefa é alterada. A tentativa fica auditável.

**Salvaguardas.** Escopos por ferramenta MCP, confirmação para escrita sensível e auditoria completa de toda chamada (PRD 15.5 e 19.3).

### 2.9 Tentativa de alteração automática de prazo ou de banco

**Contexto.** Durante o replanejamento, o agente identifica que três tarefas precisarão de novos prazos e tenta persistir as alterações diretamente.

**Fluxo.**

1. O agente não possui acesso direto ao banco; toda escrita passa pelos serviços do backend (PRD 6.4 e decisão 11).
2. O backend trata alteração de prazo como operação sensível e a converte em proposta sujeita a confirmação explícita (PRD 6.3 e 12.7).
3. A revisão mostra os três prazos sugeridos com justificativa; Alex aprova dois e mantém um.

**Resultado esperado.** Somente os prazos aprovados mudam, com histórico do valor original e do novo.

**Salvaguardas.** Nenhum prazo é alterado automaticamente pelo agente (PRD 12.7); atualizações em massa exigem confirmação reforçada (PRD 6.3).

---

## 3. Cenários de indisponibilidade

### 3.1 Agente ou modelo de IA indisponível

**Contexto.** O provedor do modelo de linguagem está fora do ar. Alex precisa registrar uma demanda urgente.

**Fluxo.**

1. A criação manual de tarefa permanece acessível em qualquer tela: ação global na barra superior, atalho de teclado, cabeçalhos do Kanban, do roadmap, da planilha e da central de prazos (PRD 6.5 e 12.10).
2. Alex cria a tarefa informando apenas título e projeto; os demais campos são opcionais e nascem com valores padrão (Backlog, tipo Tarefa, P3).
3. Entradas que dependiam da IA ficam na fila com estado visível (“com erro” ou “aguardando”) e são reprocessadas quando o serviço voltar (PRD 19.1 e 19.2).
4. Na janela de criação rápida, a sugestão opcional de campos pela IA falha ou não aparece; isso não bloqueia a criação (PRD 12.10 e 19.2).

**Resultado esperado.** O trabalho de Alex segue normalmente sem a IA. Nada é perdido: o que dependia do agente fica enfileirado e recuperável.

**Salvaguardas.** Recursos manuais sempre disponíveis (PRD 6.5); operações de IA processadas em fila com reenvio (PRD 19.1); ausência de sugestão da IA jamais impede salvar o card.

### 3.2 Serviço de speech-to-text indisponível

**Contexto.** Alex grava um áudio, mas o provedor de transcrição está fora.

**Fluxo.**

1. O áudio é validado e armazenado temporariamente com sucesso.
2. A entrada fica na caixa de entrada no estado “transcrevendo”/pendente, com status visível.
3. Alex pode, enquanto isso, digitar ou colar texto normalmente — a falha do STT não afeta entradas de texto (PRD 19.2).
4. Quando o serviço voltar, a transcrição é processada; se necessário, o áudio pode ser reprocessado com outro provedor (PRD 13.2).

**Resultado esperado.** O áudio não se perde e a transcrição acontece de forma assíncrona. O restante do produto segue utilizável.

**Salvaguardas.** Desacoplamento entre agente e provedor de STT (PRD 8.1); política de retenção configurável protege o áudio enquanto ele aguarda.

### 3.3 Trello indisponível

**Contexto.** A API do Trello apresenta instabilidade durante o dia.

**Fluxo.**

1. Todas as operações locais — criar tarefas, mover no Kanban, revisar entradas, consultar prazos — continuam funcionando (PRD 19.2).
2. O indicador de sincronização mostra o estado pendente na planilha e nas demais visões.
3. As operações de sincronização ficam enfileiradas e são reenviadas automaticamente quando a API voltar (PRD 19.2).
4. Ao reconectar, eventos repetidos são descartados por idempotência (cenário 2.7).

**Resultado esperado.** O aplicativo segue sendo a fonte de verdade utilizável; a sincronização atrasada se resolve sem intervenção manual e sem duplicações.

**Salvaguardas.** Falhas do Trello não impedem uso local; estado de sincronização permanece visível; idempotência impede efeitos colaterais no reenvio.

### 3.4 MCP com serviço degradado

**Contexto.** O agente usa ferramentas MCP (`context.search`, `tasks.search_similar`) para classificar, mas parte das consultas está lenta ou falhando.

**Fluxo.**

1. As consultas com falha são reportadas ao agente, que reduz a confiança da classificação ou solicita esclarecimento, em vez de completar com dados inventados.
2. A proposta exibida reflete apenas as evidências efetivamente obtidas.
3. Se a indisponibilidade impedir a classificação, a entrada permanece na caixa de entrada (como no cenário 2.1) e o usuário pode classificá-la manualmente.

**Resultado esperado.** Nenhuma classificação é fabricada a partir de contexto incompleto; o usuário mantém controle total.

**Salvaguardas.** Toda classificação exige evidências reais (PRD 6.2 e 19.4); incerteza resulta em pergunta ou retenção, nunca em suposição gravada.

---

## 4. Critérios de risco por cenário

| Risco (PRD 24) | Cenário que o exercita | Mitigação observável |
|---|---|---|
| Agente associar demanda ao projeto errado | 1.1, 1.2, 2.1, 2.2, 2.3 | Confiança, evidências e confirmação antes de gravar |
| IA criar informações inexistentes | 2.3, 2.5, 3.4 | Schema estruturado, evidências e revisão obrigatória |
| Criação de tarefas duplicadas | 1.4, 2.7 | Busca semântica antes da criação; idempotência |
| Perda em conflitos de sincronização | 2.6 | Resolução manual com quatro opções; zero perda silenciosa |
| Ciclo entre aplicativo e Trello | 1.7, 2.7 | Idempotência e registro de origem da operação |
| Agente alterar prazo indevidamente | 1.6, 2.9 | Confirmação explícita; nenhum prazo automático |
| MCP executar ação indevida | 2.8 | Escopos por ferramenta, confirmação e auditoria |
| Contexto de projetos se misturar | 1.5, 2.2 | Isolamento por projeto e módulo; desambiguação |
| Memória ficar desatualizada | 1.5 | Gestão de contexto, correções editáveis, expiração |
| Áudios conterem dados sensíveis | 1.2, 2.4, 3.2 | Retenção configurável, edição e reprocessamento |
| Falha de IA/STT/Trello bloquear o usuário | 3.1, 3.2, 3.3 | Recursos manuais sempre disponíveis; fila e reenvio |

---

## 5. O que nunca deve ocorrer

Estas são linhas vermelhas do produto. Qualquer cenário, teste ou implementação que resulte em uma delas é considerado defeito grave:

1. **Alteração silenciosa.** Nenhum dado (tarefa, prazo, prioridade, status, contexto ou memória) pode ser alterado sem que o usuário veja a proposta e a aprove, nem sobrescrito em conflitos de sincronização.
2. **Criação sem aprovação.** Nenhuma entidade proposta pela IA (tarefa, reunião, nota, marco, decisão, alias, módulo, tag ou contexto) pode ser gravada antes da confirmação do usuário — com a exceção prevista de tags e aliases de apoio criados automaticamente dentro de uma proposta aprovada como plano único (PRD, Fase 0).
3. **Mistura de contexto.** Contextos, memórias, vocabulários e classificações de projetos diferentes jamais podem ser combinados: o isolamento por projeto e módulo é obrigatório.
4. **Bloqueio do cadastro manual.** Falha de agente, modelo, STT, Trello ou MCP nunca pode impedir a criação manual de projetos e tarefas, acessível de qualquer tela.
5. **Prazo alterado automaticamente.** Nenhum prazo é mudado pelo agente sem confirmação explícita; adiar prazo exige justificativa registrada.
6. **Acesso direto do agente ao banco.** Toda escrita passa pelos serviços e regras de negócio do backend, única fonte de verdade.
7. **Criação de usuários ou entidades de pessoas.** O agente pode criar entidades de negócio, nunca pessoas; registros de infraestrutura (jobs, auditoria) são exclusivos da aplicação.
8. **Exposição indevida de notas privadas.** Notas manuais permanecem privadas e fora do alcance da IA e do MCP por padrão (PRD, Fases 0 e 7).
9. **Classificação sem evidência.** Toda classificação exibida deve mostrar confiança e os elementos que a fundamentaram; sem evidência real, o sistema pergunta ou retém a entrada.
10. **Perda de entrada capturada.** Texto ou áudio recebido não pode desaparecer por falha de processamento: fica na caixa de entrada com estado visível até ser processado, descartado pelo usuário ou reprocessado.
