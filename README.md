# Domingo — app de organização de pelada

App para registrar os jogos semanais de um horário de futebol society e acompanhar as estatísticas da temporada.

Um administrador lança o resultado de domingo — colando o texto da súmula ou preenchendo campo a campo — e o grupo inteiro acessa os rankings por um link, sem login.

## Estrutura

```
domingo/
├── CLAUDE.md                  instruções do projeto para o Claude Code
├── README.md                  este arquivo
├── docs/
│   ├── 01-PRODUTO.md
│   ├── 02-MODELO-DADOS.md
│   ├── 03-DESENVOLVIMENTO.md
│   ├── 04-MANUAL.md
│   ├── schema.sql
│   ├── rpc-salvar-rodada.sql
│   └── seed-rodada.sql
└── src/
    └── lib/
        ├── supabase.ts
        ├── tipos.ts
        └── dados.ts
```

O `CLAUDE.md` fica na **raiz**, não em `docs/` — é lá que o Claude Code procura.

## Documentação

| Documento | Para quê |
|---|---|
| [01-PRODUTO.md](docs/01-PRODUTO.md) | O que o app é, para quem, telas, regras de negócio, decisões e roadmap |
| [02-MODELO-DADOS.md](docs/02-MODELO-DADOS.md) | Esquema do banco, decisões de modelagem e as queries de estatística |
| [03-DESENVOLVIMENTO.md](docs/03-DESENVOLVIMENTO.md) | Stack, ambiente, Supabase, estrutura, paleta, deploy |
| [04-MANUAL.md](docs/04-MANUAL.md) | Como usar, para o administrador e para o grupo |

## SQL

Todos testados em PostgreSQL 16 e já aplicados no projeto Supabase.

| Arquivo | Quando |
|---|---|
| [schema.sql](docs/schema.sql) | Migração inicial: tabelas, índices, gatilhos, views, RLS e grants |
| [rpc-salvar-rodada.sql](docs/rpc-salvar-rodada.sql) | Função transacional que grava rodada, partida e escalação de uma vez |
| [seed-rodada.sql](docs/seed-rodada.sql) | Primeira rodada real, com consultas de conferência |

## Estado

Atualizado em 17/09/2026.

Banco no ar no Supabase, com 3 uniformes, 14 jogadores e a rodada Boca 10 x 7 Racing de 07/09. Administrador registrado.

Três telas prontas: **Elenco** (uniformes e jogadores, com criar, editar e excluir), **Rodadas** (arquivar, restaurar e editar) e **Lançar** em modo preencher, com a trava do placar. Mais o login do administrador.

O marco foi atingido: **Lançar funciona**, então a planilha pode ser aposentada.

Próximo: **Estatísticas**, com os cinco rankings. Depois **deploy** — que subiu de prioridade, porque hoje o app só roda na máquina do administrador.

## Como rodar

Precisa de Node 20 ou superior e do `.env.local` preenchido:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Então, na pasta do projeto:

```bash
npm install     # só na primeira vez
npm run dev
```

Ele imprime dois endereços. O `Local` abre no próprio PC; o `Network` é o IP da máquina na rede e serve para abrir no celular, **desde que esteja no mesmo wi-fi**. O servidor vive enquanto o comando estiver rodando — fechou o terminal, acabou. Enquanto não houver deploy, é assim que o app existe.

O banco não depende disso: ele está no Supabase e continua no ar de qualquer jeito.

## Princípio que orienta o projeto

**O app vive ou morre no domingo à noite.** Se lançar o resultado der trabalho, ninguém lança, e sem dado não existe estatística nem motivo para abrir o app. Toda decisão de produto se subordina a isso: menos campos obrigatórios, menos telas até o "salvar", menos gente envolvida no preenchimento.
