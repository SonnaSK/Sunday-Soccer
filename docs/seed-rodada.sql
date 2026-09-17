-- ============================================================
-- Primeira rodada real: Boca 10 x 7 Racing (07/09)
-- Rodar DEPOIS do schema.sql. Testado em PostgreSQL 16.
-- ============================================================

-- 1. Jogadores dessa súmula que não vieram na semente do schema
insert into jogador (horario_id, apelido, nome_completo, tipo, vinculo, posicao_preferida)
select id, x.ap, x.nc, 'linha', x.vc, x.pos from horario,
  (values ('Brunno', 'Brunno Tavares', 'mensalista', 'Ataque'),
          ('João',   'João Renato',    'mensalista', 'Meio'),
          ('JV',     'João Vitor',     'mensalista', 'Ataque')) as x(ap, nc, vc, pos)
on conflict (horario_id, apelido) do nothing;

-- 2. A rodada, a partida e as doze linhas de escalação, numa transação só
with h as (select id from horario limit 1),
r as (
  insert into rodada (horario_id, data, hora_inicio, local)
  select h.id, date '2026-09-07', time '09:00', 'Quadra' from h
  returning id, horario_id
),
p as (
  insert into partida (horario_id, rodada_id, ordem,
                       uniforme_casa_id, uniforme_fora_id, gols_casa, gols_fora,
                       goleiro_casa_id, goleiro_fora_id)
  select r.horario_id, r.id, 1,
         (select id from uniforme where nome = 'Boca'),
         (select id from uniforme where nome = 'Racing'),
         10, 7,
         (select id from jogador where apelido = 'Dione'),
         (select id from jogador where apelido = 'Eskatista')
  from r returning id, horario_id
)
insert into escalacao (horario_id, partida_id, jogador_id, lado, gols, assistencias)
select p.horario_id, p.id, j.id, x.lado, x.g, x.a
from p, (values
  -- Boca (lado C)
  ('Leo','C',6,0), ('Brunno','C',1,0), ('Alan','C',0,2),
  ('Luiz','C',0,0), ('João','C',2,0),  ('Barba','C',1,2),
  -- Racing (lado F)
  ('JV','F',5,0),   ('Matheus','F',1,2), ('Bill','F',1,1),
  ('Murilo','F',0,0),('Osmar','F',0,0),  ('Muller','F',0,0)
) as x(ap, lado, g, a)
join jogador j on j.apelido = x.ap;


-- ============================================================
-- Conferência — rode depois e compare com a sua súmula
-- ============================================================

-- A soma dos gols individuais bate com o placar?
-- Esperado: C = 10/10, F = 7/7
select e.lado, sum(e.gols) as gols_lancados,
       case when e.lado = 'C' then max(pa.gols_casa) else max(pa.gols_fora) end as placar
from escalacao e join partida pa on pa.id = e.partida_id
group by e.lado;

-- Artilharia. Esperado: Leo 6, JV 5, João 2, depois os de 1.
select j.apelido, sum(p.gols) as gols, sum(p.assistencias) as assistencias, count(*) as jogos
from v_participacao p join jogador j on j.id = p.jogador_id
where j.tipo = 'linha'
group by j.apelido having sum(p.gols) > 0
order by gols desc, assistencias desc;

-- Goleiros. Esperado: Dione 7 sofridos, Eskatista 10.
select j.apelido, count(*) as partidas, sum(g.gols_sofridos) as sofridos,
       round(avg(g.gols_sofridos), 2) as media
from v_goleiro g join jogador j on j.id = g.goleiro_id
group by j.apelido order by media;

-- Ficha da partida. Esperado: 17 gols no total, margem 3.
select data, uniforme_casa, gols_casa, gols_fora, uniforme_fora, total_gols, margem
from v_partida;
