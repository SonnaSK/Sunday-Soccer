-- ============================================================
-- Domingo — migração inicial
-- Rodar no SQL Editor do Supabase, de uma vez, em projeto novo.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Gatilho de atualizado_em
-- ------------------------------------------------------------
create or replace function tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

-- ------------------------------------------------------------
-- Domínio
-- ------------------------------------------------------------

create table horario (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cidade        text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table uniforme (
  id             uuid primary key default gen_random_uuid(),
  horario_id     uuid not null references horario(id) on delete cascade,
  nome           text not null,
  cor_primaria   text not null default '#000000',
  cor_secundaria text not null default '#FFFFFF',
  ano            int,
  ativo          boolean not null default true,   -- false = aposentado
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (horario_id, nome)
);

create table jogador (
  id                uuid primary key default gen_random_uuid(),
  horario_id        uuid not null references horario(id) on delete cascade,
  apelido           text not null,
  nome_completo     text,
  tipo              text not null default 'linha'
                    check (tipo in ('linha', 'goleiro')),
  vinculo           text not null default 'suplente'
                    check (vinculo in ('mensalista', 'suplente', 'contratado', 'espera')),
  posicao_preferida text,
  slot              int,          -- vaga do mensalista (1..12) ou posição na fila de suplente
  tem_uniforme      boolean not null default false,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (horario_id, apelido)
);

create table rodada (
  id            uuid primary key default gen_random_uuid(),
  horario_id    uuid not null references horario(id) on delete cascade,
  data          date not null,
  hora_inicio   time,
  local         text,
  observacao    text,
  ativo         boolean not null default true,   -- exclusão lógica
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table partida (
  id               uuid primary key default gen_random_uuid(),
  horario_id       uuid not null references horario(id) on delete cascade,
  rodada_id        uuid not null references rodada(id) on delete cascade,
  ordem            int  not null default 1,
  uniforme_casa_id uuid not null references uniforme(id),
  uniforme_fora_id uuid not null references uniforme(id),
  gols_casa        int  not null default 0 check (gols_casa >= 0),
  gols_fora        int  not null default 0 check (gols_fora >= 0),
  goleiro_casa_id  uuid references jogador(id),
  goleiro_fora_id  uuid references jogador(id),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (rodada_id, ordem),
  check (uniforme_casa_id <> uniforme_fora_id)
);

create table escalacao (
  id            uuid primary key default gen_random_uuid(),
  horario_id    uuid not null references horario(id) on delete cascade,
  partida_id    uuid not null references partida(id) on delete cascade,
  jogador_id    uuid not null references jogador(id),
  lado          char(1) not null check (lado in ('C', 'F')),
  posicao       text,   -- nulo no fluxo rápido; preenchido pelo pré-jogo (v1.2)
  gols          int not null default 0 check (gols >= 0),
  assistencias  int not null default 0 check (assistencias >= 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (partida_id, jogador_id)
);

-- v1.2 — presença e substituição. Criada agora para não exigir migração depois.
create table presenca (
  id             uuid primary key default gen_random_uuid(),
  horario_id     uuid not null references horario(id) on delete cascade,
  rodada_id      uuid not null references rodada(id) on delete cascade,
  jogador_id     uuid not null references jogador(id),
  status         text not null default 'confirmado'
                 check (status in ('confirmado', 'ausente', 'pendente')),
  substitui_id   uuid references jogador(id),   -- mensalista que este suplente cobre
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (rodada_id, jogador_id)
);

create table administrador (
  horario_id uuid not null references horario(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  papel      text not null default 'admin' check (papel in ('dono', 'admin')),
  criado_em  timestamptz not null default now(),
  primary key (horario_id, user_id)
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index on uniforme  (horario_id, ativo);
create index on jogador   (horario_id, tipo, ativo);
create index on rodada    (horario_id, data desc);
create index on partida   (rodada_id);
create index on escalacao (partida_id);
create index on escalacao (jogador_id);
create index on presenca  (rodada_id);

-- ------------------------------------------------------------
-- Gatilhos
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['horario','uniforme','jogador','rodada','partida','escalacao','presenca']
  loop
    execute format(
      'create trigger trg_%1$s_atualizado before update on %1$s
       for each row execute function tocar_atualizado_em()', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Views de estatística
-- ------------------------------------------------------------

-- Uma linha por jogador por partida, já com placar e resultado resolvidos.
create view v_participacao as
select
  e.horario_id,
  e.jogador_id,
  e.partida_id,
  p.rodada_id,
  r.data,
  e.lado,
  e.posicao,
  e.gols,
  e.assistencias,
  case when e.lado = 'C' then p.gols_casa else p.gols_fora end as gols_time,
  case when e.lado = 'C' then p.gols_fora else p.gols_casa end as gols_adversario,
  case when e.lado = 'C' then p.uniforme_casa_id else p.uniforme_fora_id end as uniforme_id,
  case
    when (case when e.lado = 'C' then p.gols_casa else p.gols_fora end)
       > (case when e.lado = 'C' then p.gols_fora else p.gols_casa end) then 'V'
    when p.gols_casa = p.gols_fora then 'E'
    else 'D'
  end as resultado
from escalacao e
join partida p on p.id = e.partida_id
join rodada  r on r.id = p.rodada_id
where r.ativo;

-- Uma linha por goleiro por partida.
create view v_goleiro as
select p.horario_id, p.goleiro_casa_id as goleiro_id, p.id as partida_id,
       r.data, p.gols_fora as gols_sofridos
from partida p join rodada r on r.id = p.rodada_id and r.ativo
where p.goleiro_casa_id is not null
union all
select p.horario_id, p.goleiro_fora_id, p.id, r.data, p.gols_casa
from partida p join rodada r on r.id = p.rodada_id and r.ativo
where p.goleiro_fora_id is not null;

-- Ficha resumida de cada partida, para a navegação por jogos antigos.
create view v_partida as
select p.id, p.horario_id, r.data, r.hora_inicio,
       uc.nome as uniforme_casa, uc.cor_primaria as cor_casa,
       uf.nome as uniforme_fora, uf.cor_primaria as cor_fora,
       p.gols_casa, p.gols_fora,
       p.gols_casa + p.gols_fora      as total_gols,
       abs(p.gols_casa - p.gols_fora) as margem
from partida p
join rodada   r  on r.id = p.rodada_id and r.ativo
join uniforme uc on uc.id = p.uniforme_casa_id
join uniforme uf on uf.id = p.uniforme_fora_id;

-- Sem isto, a view roda com os privilégios do dono e IGNORA o RLS
-- das tabelas de baixo. Com security_invoker, a política vale através dela.
alter view v_participacao set (security_invoker = true);
alter view v_goleiro      set (security_invoker = true);
alter view v_partida      set (security_invoker = true);

-- ------------------------------------------------------------
-- Row Level Security
-- Leitura pública (link no grupo, sem login) + escrita só de administrador.
-- ------------------------------------------------------------

create or replace function eh_admin(h uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from administrador a
    where a.horario_id = h and a.user_id = auth.uid()
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['horario','uniforme','jogador','rodada','partida','escalacao','presenca']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy leitura_publica on %I for select using (true)', t);
    if t = 'horario' then
      execute 'create policy escrita_admin on horario for all
               using (eh_admin(id)) with check (eh_admin(id))';
    else
      execute format(
        'create policy escrita_admin on %I for all
         using (eh_admin(horario_id)) with check (eh_admin(horario_id))', t);
    end if;
  end loop;
end $$;

alter table administrador enable row level security;
create policy admin_le_se_mesmo on administrador for select using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Exposição na Data API (grants)
--
-- Grant e RLS são camadas diferentes: o grant diz se o papel enxerga
-- a tabela, o RLS diz quais linhas ele vê. Desde 2026 o Supabase não
-- expõe tabelas novas automaticamente, então a exposição vai aqui,
-- declarada junto do esquema, em vez de ser clicada no painel.
-- ------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- Leitura pública: é o que permite mandar o link no grupo sem login.
grant select on table
  horario, uniforme, jogador, rodada, partida, escalacao, presenca
  to anon, authenticated;

grant select on table v_participacao, v_goleiro, v_partida to anon, authenticated;

-- Escrita só para usuário logado — e o RLS ainda confere se ele é admin.
-- anon deliberadamente NÃO recebe insert/update/delete: mesmo que uma
-- política falhe algum dia, o papel anônimo esbarra antes, no grant.
grant insert, update, delete on table
  horario, uniforme, jogador, rodada, partida, escalacao, presenca
  to authenticated;

grant select on table administrador to authenticated;

-- ------------------------------------------------------------
-- Semente — trocar pelos dados reais do horário
-- ------------------------------------------------------------
insert into horario (nome, cidade) values ('Domingo de manhã', 'Ribeirão Preto');

insert into uniforme (horario_id, nome, cor_primaria, cor_secundaria, ano, ativo)
select id, x.nome, x.p, x.s, x.ano, x.ativo from horario,
  (values ('Boca','#0B2A6B','#F2C230',2026,true),
          ('Racing','#79AEDC','#F2F4F3',2025,true),
          ('Preto','#23262B','#C9CCD1',2024,true)) as x(nome,p,s,ano,ativo);

insert into jogador (horario_id, apelido, nome_completo, tipo, vinculo, posicao_preferida, slot)
select id, x.ap, x.nc, x.tp, x.vc, x.pos, x.slot from horario,
  (values ('Leo','Leonardo Prado','linha','mensalista','Meio',2),
          ('Matheus','Matheus Antunes','linha','mensalista','Defesa',3),
          ('Murilo','Murilo Esteves','linha','mensalista','Defesa',5),
          ('Luiz','Luiz Fernando','linha','mensalista','Defesa',6),
          ('Barba','Rodrigo Barbosa','linha','mensalista','Meio',7),
          ('Alan','Alan Ribeiro','linha','mensalista','Defesa',9),
          ('Bill','William Costa','linha','mensalista','Meio',10),
          ('Osmar','Osmar Pinto','linha','suplente','Meio',3),
          ('Muller','Müller Andrade','linha','suplente','Meio',1),
          ('Dione','Dione Barros','goleiro','contratado','Goleiro',null),
          ('Eskatista','Fábio Eskatista','goleiro','contratado','Goleiro',null)
  ) as x(ap,nc,tp,vc,pos,slot);

-- Depois de criar seu usuário em Authentication > Users, rode:
-- insert into administrador (horario_id, user_id, papel)
-- select h.id, 'COLE-AQUI-O-UUID-DO-USUARIO', 'dono' from horario h;
