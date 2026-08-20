# Model Business Canvas

> Canvas do **Central de Projetos** (nome provisório), alinhado ao PRD v2.0.
> A primeira versão é um **produto individual**, entregue como **aplicação web responsiva / PWA**.
> Itens marcados como *Hipótese* ainda precisam de validação; itens marcados como *Decisão* constam no PRD.

**Fora do escopo deste canvas (fora do MVP):** aplicativo mobile nativo, colaboração simultânea entre equipes, integrações com WhatsApp/e-mail/Google Calendar e agente de desenvolvimento de código.

---

## Visão geral

| Bloco | Definição |
|---|---|
| Segmentos de clientes | Desenvolvedores solo que administram vários projetos ao mesmo tempo; primeiro usuário é o próprio criador do produto |
| Proposta de valor | "O usuário informa o que aconteceu; o sistema entende onde aquilo pertence" |
| Canais | Aplicação web/PWA instalável, acesso direto pelo navegador do computador e do celular |
| Relacionamento com clientes | Autoatendimento, onboarding guiado pela importação da planilha atual, suporte dentro do produto |
| Fontes de receita | *Hipótese:* plano gratuito + plano pago com recursos avançados de IA |
| Recursos principais | Backend como fonte de verdade, agente contextual com memória por projeto, integrações (Trello, STT, LLM, MCP) |
| Atividades principais | Desenvolvimento do produto, curadoria de contexto, manutenção de integrações e suporte |
| Parceiros principais | Provedores de LLM e speech-to-text, Trello (Atlassian), serviços de hospedagem |
| Estrutura de custos | Desenvolvimento, hospedagem, banco de dados, consumo de IA/STT e suporte |

---

## 1. Segmentos de clientes

**Decisão:** a primeira versão é individual (PRD, decisão 12). Não há colaboração entre equipes no MVP.

- **Primeiro usuário (dogfooding):** o próprio desenvolvedor do produto, que hoje administra simultaneamente projetos como Intranet, Observa SEUMA, Guichê Virtual, PAX/VistaFor, Monitoramento do Ar e App Vistoria (CELAM/NUEE) — a base real usada para validar o produto.
- **Segmento inicial:** programadores solo e profissionais que conduzem vários projetos de software com demandas institucionais, correções, funcionalidades, dependências externas e prazos concorrentes.
- **Características do segmento:**
  - Usa planilha + Trello + mensagens + áudios + memória pessoal ao mesmo tempo.
  - Recebe demandas sem classificação clara e com vocabulário específico de cada projeto.
  - Precisa saber rapidamente o que fazer hoje, sem gastar tempo organizando ferramentas.

*Hipótese:* outros desenvolvedores solo com perfil semelhante ao do primeiro usuário têm o mesmo problema de fragmentação e aceitam centralizar o acompanhamento em uma única aplicação.

## 2. Problemas (dores do cliente)

Problemas observados na situação atual (PRD, seção 3):

- Demandas distribuídas entre planilhas, Trello, mensagens, anotações, áudios, reuniões e memória pessoal.
- Planilha atual com estrutura inconsistente: mistura status, etapa e responsável; mistura tarefas feitas e pendentes; prazos raramente preenchidos.
- O mesmo projeto é chamado por nomes diferentes (ex.: PAX e VistaFor), e termos como "planta", "raster" ou "loteamento" dependem de contexto para serem interpretados.
- Não existe visão única das tarefas mais urgentes; prazos ficam escondidos entre linhas.
- Tarefas, bloqueios, decisões e observações são misturados.
- Áudios precisam ser transformados manualmente em atividades; decisões de reuniões são esquecidas.
- Demandas semelhantes são cadastradas mais de uma vez.
- Uma IA sem contexto associa a demanda ao projeto errado.
- O usuário atualiza mais de uma ferramenta para registrar a mesma informação.

## 3. Proposta de valor

**Decisão (princípio central do PRD):**

> O usuário informa o que aconteceu; o sistema entende onde aquilo pertence.

- Registrar uma demanda de forma natural (texto ou áudio), sem preencher campos manualmente.
- O agente contextual interpreta a informação, encontra o projeto e o módulo relacionados, classifica o tipo (tarefa, bug, decisão, bloqueio ou observação), detecta duplicidades e propõe um card estruturado — sempre com **confiança, evidências e confirmação do usuário** antes de gravar.
- Uma única base de dados com quatro visualizações: planilha, Kanban, roadmap temporal e central de prazos.
- Plano diário de ação explicado, respondendo "o que fazer hoje".
- Falhas de IA ou de serviços externos **nunca bloqueiam o uso manual**: a criação manual de tarefas está disponível em qualquer tela.

*Hipótese:* a classificação automática com evidências gera confiança suficiente para o usuário abandonar a planilha como ferramenta principal.

## 4. Solução e capacidades principais

Capacidades do MVP (PRD, seção 7.1), agrupadas por prioridade de entrega:

- **P0 — Primeiro uso:** projetos com aliases e módulos, tarefas com prioridades/status/dependências, importação da planilha atual, visualização tabular, Kanban, central de prazos, busca, histórico, layout responsivo.
- **P1 — Diferencial principal:** caixa de entrada inteligente, agente contextual com memória por projeto, classificação automática com confiança e evidências, transcrição de áudio, revisão contextual, detecção de duplicidades, plano de ação por IA.
- **P2 — Integrações e expansão:** sincronização bidirecional com Trello, roadmap e marcos, MCP com operações controladas, PWA instalável, notificações, histórico de decisões, aprendizado com correções.

Princípios que diferenciam a solução:

- **Contexto antes da automação:** o agente consulta a memória do projeto antes de propor qualquer ação.
- **Confirmação proporcional ao risco:** classificar exige confirmação simples; alterar prazo/prioridade exige confirmação explícita; ações sensíveis via MCP exigem aprovação e geram auditoria.
- **Backend como fonte de verdade:** o agente nunca altera o banco diretamente; tudo passa pelas regras de negócio da aplicação.
- **Aprendizado corrigível:** correções do usuário alimentam contexto, aliases e vocabulário — sempre visíveis e editáveis.

## 5. Canais

**Decisão:** aplicação web responsiva, instalável como PWA, utilizável no computador e no navegador do celular (PRD, decisão 17: arquitetura preparada para mobile desde o início, sem aplicativo nativo no MVP).

- Acesso direto pelo navegador; instalação opcional como PWA.
- Divulgação inicial em comunidades de programação e desenvolvedores solo, após validação com o primeiro usuário.
- O Trello funciona também como canal de entrada de dados: cards criados lá podem ser classificados pelo agente.
- O MCP permite que clientes autorizados consultem e alterem dados de forma estruturada.

## 6. Relacionamento com clientes

- **Autoatendimento:** o produto deve ser utilizável sem treinamento formal.
- **Onboarding pela migração:** o primeiro valor vem da importação da planilha atual com revisão guiada — o usuário já começa com seus dados organizados.
- **Confiança progressiva na IA:** o relacionamento com o agente é construído por evidências visíveis, confirmação antes de gravar e correções que melhoram classificações futuras.
- **Suporte dentro do produto** e documentação das operações MCP.
- Garantia permanente: mesmo sem IA disponível, o usuário continua registrando e organizando tudo manualmente.

*Hipótese:* a importação da planilha como primeiro passo é suficiente para reter o usuário até a IA demonstrar valor.

## 7. Métricas de sucesso

Indicadores definidos no PRD (seção 20), que também validam as hipóteses do canvas:

| Indicador | Meta |
|---|---:|
| Projetos visíveis em todas as visualizações | 100% |
| Tarefas com status definido após revisão | 95% |
| Tarefas importantes com prazo ou justificativa | 80% |
| Alterações sincronizadas com Trello | 95% |
| Conflitos com perda silenciosa | 0 |
| Entradas classificadas no projeto correto | 85% |
| Classificações de alta confiança aceitas sem troca de projeto | 90% |
| Sugestões aceitas após edição mínima | 70% |
| Duplicidades identificadas antes da criação | 80% |
| Plano diário gerado adequadamente | 95% |
| Redução de atualizações manuais duplicadas | 80% |
| Correções do usuário refletidas em classificações futuras | 80% |

Métrica de negócio (hipótese): a planilha deixa de ser a interface principal de acompanhamento do primeiro usuário dentro do primeiro mês de uso do MVP.

## 8. Recursos principais

- **Backend e banco de dados:** fonte de verdade única para projetos, módulos, tarefas, decisões, marcos, reuniões, memória contextual e histórico.
- **Agente contextual:** classificação, desambiguação de aliases, detecção de duplicidade e plano de ação (baseado em Hermes ou tecnologia equivalente — *decisão:* Hermes é implementação possível, não dependência obrigatória).
- **Modelo de linguagem substituível:** DeepSeek, Gemini, modelos locais ou outro provedor configurável.
- **Serviço de speech-to-text:** componente separado, com português brasileiro como idioma padrão.
- **Camada MCP:** interface estruturada entre agente/clientes e aplicação, com escopos, aprovações e auditoria.
- **Memória contextual por projeto:** recurso acumulativo que diferencia o produto ao longo do uso.

## 9. Atividades principais

- Desenvolvimento e manutenção da aplicação (web/PWA) e do backend.
- Construção e refinamento do agente contextual: classificação, confiança, evidências e aprendizado com correções.
- Curadoria da memória contextual junto com o usuário (gestão de contexto editável).
- Operação das integrações: Trello bidirecional, STT, LLM e MCP.
- Importação e saneamento da planilha inicial.
- Monitoramento das métricas de classificação e sincronização.
- Suporte ao usuário.

## 10. Parceiros principais

- **Provedores de LLM** (DeepSeek, Gemini ou modelos locais) — com camada de adaptação para troca de fornecedor.
- **Provedor de speech-to-text** para transcrição de áudio.
- **Trello (Atlassian)** — ferramenta operacional sincronizada, não substituída.
- **Serviços de hospedagem e infraestrutura** (computação, banco de dados, armazenamento de anexos).
- **Comunidades de programação** — canal de validação e divulgação futura.

## 11. Estrutura de custos

- Desenvolvimento e manutenção do produto (custo dominante na fase atual).
- Hospedagem, banco de dados e armazenamento de anexos.
- Consumo de IA: chamadas ao LLM (classificação, plano de ação) e transcrição de áudio.
- Operação das integrações (Trello, MCP) e auditoria.
- Suporte ao usuário.

## 12. Fontes de receita

*Hipótese — ainda não validada; o MVP é de uso individual e sem cobrança:*

- **Plano gratuito:** organização de projetos e tarefas, visualizações e criação manual.
- **Plano pago:** recursos avançados de IA (agente contextual, transcrição de áudio, plano de ação), cobrindo o custo variável de LLM/STT.

A decisão sobre modelo de cobrança depende da validação do valor da IA com o primeiro usuário e da medição do custo por uso.

## 13. Riscos do modelo

Riscos que afetam diretamente o canvas (PRD, seção 24), com mitigação:

| Risco | Mitigação |
|---|---|
| Agente associar demanda ao projeto errado | Confiança, evidências e confirmação |
| Memória contextual ficar desatualizada | Gestão de contexto e expiração |
| Contexto de projetos diferentes se misturar | Isolamento por projeto e módulo |
| IA criar informações inexistentes | Schema, evidências e revisão |
| Criação de tarefas duplicadas | Busca semântica antes da criação |
| Dados inconsistentes da planilha | Importação com revisão |
| Ciclo de sincronização entre aplicativo e Trello | Idempotência e origem da operação |
| Perda de dados em conflitos | Versionamento e resolução manual |
| Agente alterar prazo indevidamente | Confirmação explícita |
| Modelo de IA específico deixar de existir | Camada de adaptação e modelo substituível |
| Áudios conterem dados sensíveis | Retenção e exclusão configuráveis; áudio de entrada excluído após processamento |
| MCP executar ação indevida | Escopos, aprovações e auditoria |
| Contexto malicioso em documentos | Validação e proteção contra instruções externas |
| Excesso de escopo no MVP | Implementação por fases |
| *Hipótese de segmento não se confirmar* | Validação com primeiro usuário antes de investir em aquisição |

## 14. Hipóteses × Decisões

**Decisões (PRD, seção 25):**

1. Produto individual na primeira versão; web/PWA como plataforma inicial.
2. Agente contextual é funcionalidade central; Hermes é implementação possível, não obrigatória.
3. Backend da aplicação é a fonte de verdade; Trello é ferramenta sincronizada.
4. Toda classificação possui confiança e evidências; classificações incertas exigem confirmação.
5. Toda ação sensível exige aprovação; o agente não acessa o banco diretamente.
6. Modelo de linguagem e provedor de STT são substituíveis.
7. Mobile nativo, colaboração, WhatsApp/e-mail/Calendar e agente de código são evolução futura (fora do MVP).

**Hipóteses testáveis:**

| Hipótese | Como testar | Critério de sucesso |
|---|---|---|
| O primeiro usuário substitui a planilha pela aplicação | Uso diário após importação | Planilha deixa de ser atualizada em 1 mês |
| A classificação automática acerta o projeto certo | Métrica de classificação | 85% das entradas no projeto correto |
| Evidências + confirmação geram confiança na IA | Taxa de aceitação sem correção | 90% das classificações de alta confiança aceitas |
| O fluxo de áudio reduz atrito de registro | Uso da caixa de entrada por áudio | Entradas por áudio viram tarefas com 70% de aceitação da sugestão |
| A sincronização elimina trabalho duplicado | Métrica de atualização duplicada | Redução de 80% |
| Outros desenvolvedores solo têm a mesma dor | Entrevistas/validação externa | Não validado no MVP — próximo passo |

---

> Este canvas deve ser revisado após a validação das hipóteses com o primeiro usuário e antes de qualquer expansão de segmento ou definição de cobrança.
