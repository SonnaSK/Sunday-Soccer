# 02 — Modelo de dados

Banco: PostgreSQL (Supabase). A migração executável está em [schema.sql](schema.sql).

## Visão geral

```
horario ──┬── uniforme
          ├── jogador
          └── rodada ── partida ── escalacao
                           │            │
                           └── goleiros ┘ (FK para jogador)
```

Seis tabelas de domínio mais `administrador` para controle de escrita. A tabela `presenca` existe no esquema, marcada para a v1.2, e não é usada na v1.

## Tabelas

### horario

O horário de futebol. Na v1 existe uma linha só, mas todas as demais tabelas carregam `horario_id` desde o início — ver [Decisões](#decisões-de-modelagem).

### uniforme

Identidade visual permanente da temporada (Boca, Racing, Preto), com duas cores e ano de produção. O campo `ativo` controla o ciclo de vida: aposentado some do seletor de lançamento mas continua referenciável por partidas antigas. Nunca apagar.

### jogador

| Campo | Observação |
|---|---|
| `apelido` | Identificador visível em todo o app. Único dentro do horário. |
| `nome_completo` | Desambiguação. Existem vários "João" no grupo. |
| `tipo` | `linha` ou `goleiro`. Goleiro fica fora do sorteio, da artilharia e do aproveitamento. |
| `vinculo` | `mensalista`, `suplente`, `contratado` (goleiros) ou `espera` (fila para virar mensalista). |
| `slot` | Vaga numerada de 1 a 12 para mensalistas; posição na fila para suplentes. |
| `tem_uniforme` | Separa a fila de suplentes prioritários da fila sem uniforme. |
| `posicao_preferida` | Referência para montagem de times. Não é a posição jogada. |

### rodada

Um domingo. Carrega `data`, `hora_inicio` e `local`.

### partida

Um jogo dentro da rodada. Na prática deste horário é um jogo longo por domingo, mas `ordem` permite mais de um sem mudar nada.

Os dois goleiros ficam aqui, em `goleiro_casa_id` e `goleiro_fora_id`, e não na escalação. Como são fixos no gol enquanto os times giram, o cálculo sai direto: `gols_fora` é exatamente o que o goleiro da casa sofreu.

### escalacao

Quem jogou, de que lado, com quantos gols e assistências. Uma linha por jogador por partida.

`lado` é `'C'` ou `'F'`, apontando para os uniformes e placares de `partida`. `posicao` é texto livre e fica nulo no fluxo rápido — é preenchido só quando o pré-jogo da v1.2 for usado.

## Decisões de modelagem

### Escalação e estatística na mesma tabela

Uma versão anterior separava a composição do time da contagem de gols. Foram unificadas porque a fonte real do dado é uma linha única por jogador — a súmula diz "Leo 6", não seis eventos de gol. Uma tabela de eventos individuais só faria sentido se houvesse minutagem ou ordem dos gols, que não existem e não são desejadas.

Se um dia houver necessidade de granularidade por gol, `escalacao` continua correta e ganha uma tabela filha; nada precisa ser desfeito.

### `horario_id` em todas as tabelas desde a v1

Mesmo com um horário só, a coluna está presente em tudo. Adicionar coluna de tenant depois, num banco com dado real dentro, é o tipo de migração que trava projeto. Com ela presente, virar multi-horário é ajustar as políticas de acesso.

### UUID em vez de inteiro sequencial

Com inteiro auto-incremento, o dia que existir mais de um horário os identificadores colidem. UUID desde o início não custa nada e permite gerar o id no cliente, o que abre caminho para sincronização offline.

### Exclusão lógica e carimbo de tempo

`criado_em` e `atualizado_em` em todas as tabelas, com gatilho automático no update. Rodada e partida usam `ativo` em vez de `DELETE`. Sem isso não há como auditar quem alterou um placar nem sincronizar offline depois.

### Escalação é da partida, não do time

Uma versão anterior tinha uma entidade `time` por rodada, com a escalação pendurada nela. Como este horário joga um jogo por domingo, a indireção só acrescentava uma tabela. Os uniformes ficam direto em `partida`, e `lado` liga o jogador ao placar certo.

## Views e queries

O `schema.sql` cria `v_participacao`, que resolve de uma vez o cruzamento entre escalação, placar e resultado. Todas as estatísticas de jogador derivam dela.

```sql
-- Artilharia
select j.apelido, sum(p.gols) as gols, count(*) as jogos
from v_participacao p join jogador j on j.id = p.jogador_id
where j.tipo = 'linha'
group by j.apelido
having sum(p.gols) > 0
order by gols desc;

-- Aproveitamento (pontos ganhos sobre pontos disputados)
select j.apelido,
       count(*) as jogos,
       count(*) filter (where p.resultado = 'V') as v,
       count(*) filter (where p.resultado = 'E') as e,
       count(*) filter (where p.resultado = 'D') as d,
       round(100.0 * (count(*) filter (where p.resultado = 'V') * 3
                    + count(*) filter (where p.resultado = 'E'))
             / (count(*) * 3), 1) as aproveitamento
from v_participacao p join jogador j on j.id = p.jogador_id
where j.tipo = 'linha'
group by j.apelido
having count(*) >= 2          -- subir esse corte conforme o volume cresce
order by aproveitamento desc;

-- Goleiros
select j.apelido, count(*) as partidas, sum(g.gols_sofridos) as sofridos,
       round(avg(g.gols_sofridos), 2) as media
from v_goleiro g join jogador j on j.id = g.goleiro_id
group by j.apelido
order by media asc;

-- Duplas (v3) — química como diferença, não taxa bruta
select ja.apelido as jogador_a, jb.apelido as jogador_b,
       count(*) as juntos,
       round(100.0 * count(*) filter (where a.resultado = 'V') / count(*), 1) as vitorias_juntos
from v_participacao a
join v_participacao b
  on b.partida_id = a.partida_id and b.lado = a.lado and b.jogador_id > a.jogador_id
join jogador ja on ja.id = a.jogador_id
join jogador jb on jb.id = b.jogador_id
group by ja.apelido, jb.apelido
having count(*) >= 5          -- sem mínimo o ranking vira ruído
order by vitorias_juntos desc;
```

Estatísticas de partida, para a navegação por jogos antigos:

```sql
select p.id, r.data, r.hora_inicio,
       uc.nome as casa, uf.nome as fora,
       p.gols_casa, p.gols_fora,
       p.gols_casa + p.gols_fora    as total_gols,
       abs(p.gols_casa - p.gols_fora) as margem
from partida p
join rodada r   on r.id = p.rodada_id and r.ativo
join uniforme uc on uc.id = p.uniforme_casa_id
join uniforme uf on uf.id = p.uniforme_fora_id
order by total_gols desc;   -- trocar por margem desc (goleadas) ou asc (apertados)
```

Média de gols por rodada ao longo do semestre:

```sql
select r.data, sum(p.gols_casa + p.gols_fora) as gols
from partida p join rodada r on r.id = p.rodada_id and r.ativo
group by r.data order by r.data;
```

## Controle de acesso

Row Level Security ligada em todas as tabelas, com duas políticas por tabela:

- **Leitura pública.** Qualquer um com o link lê. É o que permite mandar no grupo sem cadastro.
- **Escrita restrita.** Só quem está em `administrador` para aquele horário escreve, verificado pela função `eh_admin(horario_id)`.

A tabela `administrador` referencia `auth.users` do Supabase. Na v1 tem uma linha. Múltiplos administradores na v3 é inserir mais linhas, sem mudança de código.
