# Domingo — app de organização de pelada

App para registrar os jogos semanais de um horário de futebol society e acompanhar as estatísticas da temporada.

Um administrador lança o resultado de domingo — colando o texto da súmula ou preenchendo campo a campo — e o grupo inteiro acessa os rankings por um link, sem login.

## Como instalar estes arquivos no projeto

```
domingo/
├── CLAUDE.md                  ← raiz do projeto
├── docs/
│   ├── README.md              ← este arquivo
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

O `CLAUDE.md` vai na **raiz**, não em `docs/` — é lá que o Claude Code procura.

## Documentação

| Documento | Para quê |
|---|---|
| [01-PRODUTO.md](01-PRODUTO.md) | O que o app é, para quem, telas, regras de negócio, decisões e roadmap |
| [02-MODELO-DADOS.md](02-MODELO-DADOS.md) | Esquema do banco, decisões de modelagem e as queries de estatística |
| [03-DESENVOLVIMENTO.md](03-DESENVOLVIMENTO.md) | Stack, ambiente, Supabase, estrutura, paleta, deploy |
| [04-MANUAL.md](04-MANUAL.md) | Como usar, para o administrador e para o grupo |

## SQL

Todos testados em PostgreSQL 16 e já aplicados no projeto Supabase.

| Arquivo | Quando |
|---|---|
| [schema.sql](schema.sql) | Migração inicial: tabelas, índices, gatilhos, views, RLS e grants |
| [rpc-salvar-rodada.sql](rpc-salvar-rodada.sql) | Função transacional que grava rodada, partida e escalação de uma vez |
| [seed-rodada.sql](seed-rodada.sql) | Primeira rodada real, com consultas de conferência |

## Estado

Banco criado e populado, com uma rodada real dentro. `src/lib/` pronto. Nenhuma tela construída.

Próximo: tela de Elenco, depois Lançar, depois Estatísticas. A ordem está no fim do `03-DESENVOLVIMENTO.md`.

## Teste rápido antes da primeira tela

Com `.env.local` preenchido, coloque num componente:

```ts
import { listarJogadores } from "./lib/dados";
listarJogadores().then(console.log);
```

Se os jogadores aparecerem no console, a corrente inteira está funcionando: chave, grants, RLS e camada de dados. Se falhar, é uma linha para depurar em vez de uma tela.

## Princípio que orienta o projeto

**O app vive ou morre no domingo à noite.** Se lançar o resultado der trabalho, ninguém lança, e sem dado não existe estatística nem motivo para abrir o app. Toda decisão de produto se subordina a isso: menos campos obrigatórios, menos telas até o "salvar", menos gente envolvida no preenchimento.
