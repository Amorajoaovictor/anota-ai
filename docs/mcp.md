# MCP do Anota Aí

O servidor expõe projetos, cards, contexto de projeto e caixa de entrada. Notas privadas não são ferramentas MCP. HTTP remoto e `stdio` local usam as mesmas regras de negócio e a mesma base de dados.

## Preparação

1. Aplique a migration `20260923201500_mcp_tokens` no ambiente onde o Anota Aí roda.
2. Entre no app e abra **Integrações > MCP**.
3. Crie uma conexão com os escopos necessários. Copie o token: ele aparece só nessa resposta. Tokens expiram após 90 dias e podem ser revogados nessa tela.

## HTTP remoto

Configure no cliente MCP a URL `https://SEU-DOMINIO/api/mcp` e envie `Authorization: Bearer <token>`. O endpoint usa Streamable HTTP e responde a clientes MCP atuais e legados. Use sempre HTTPS fora do ambiente local.

## stdio local

No checkout do projeto, configure `.env.local` com a conexão de banco usada pelo app. Passe `ANOTA_MCP_TOKEN` ao processo do agente sem gravá-lo no repositório. Configure o cliente para iniciar `node --env-file=.env.local --import tsx src/server/mcp/stdio.ts` no diretório do projeto. O processo lê o mesmo banco do app e escreve mensagens do protocolo apenas em `stdout`. Não use `npm run` como comando do cliente: o banner do npm pode contaminar `stdout`.

Exemplo genérico de configuração de cliente:

```json
{
  "command": "node",
  "args": ["--env-file=.env.local", "--import", "tsx", "src/server/mcp/stdio.ts"],
  "cwd": "CAMINHO_ABSOLUTO_DO_PROJETO",
  "env": { "ANOTA_MCP_TOKEN": "TOKEN_GERADO_NO_APP" }
}
```

O formato de configuração varia conforme o cliente. Proteja o token como senha e revogue a conexão quando deixar de usá-la.

## Ferramentas e confirmação

Escopos: `read`, `create`, `update` e `context`. Toda escrita exige `confirmed: true`. Mudanças de prazo, prioridade alta, arquivamento, descarte e edição de contexto também exigem `confirmedSensitive: true`. O agente deve mostrar a ação ao usuário e obter resposta afirmativa antes de preencher esses campos. O servidor registra a declaração de confirmação, o cliente, a ferramenta, os campos enviados, o resultado e um `requestId`.

A confirmação ocorre na conversa com o agente. O servidor não tem acesso a essa conversa e não consegue verificar de forma independente se a resposta veio do usuário. Conceda escopos de escrita somente a clientes MCP em que confia.

Operações de inbox seguem o classificador legado ao chamar `inbox.create`. `inbox.harness` permite ler o estado de uma revisão existente; sua aprovação e execução continuam disponíveis no app. Cards podem ser criados diretamente por `tasks.create`, sem passar pelo classificador.
