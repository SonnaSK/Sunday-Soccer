-- ============================================================
-- salvar_rodada — grava rodada, partida e escalação numa transação só
-- Rodar no SQL Editor depois do schema.sql. Testado em PostgreSQL 16.
--
-- Por que existe: gravar uma rodada toca três tabelas. Em três chamadas
-- separadas do cliente, uma queda de rede no meio deixa rodada órfã.
-- Aqui é tudo ou nada.
--
-- Bônus: a trava do placar passa a valer no servidor. O cliente pode ter
-- bug ou ser contornado; o banco não aceita súmula que não fecha.
-- ============================================================

create or replace function salvar_rodada(p jsonb)
returns uuid
language plpgsql
as $fn$
declare
  v_horario uuid;
  v_rodada  uuid;
  v_partida uuid;
  item      jsonb;
  soma_c    int;
  soma_f    int;
begin
  select id into v_horario from horario limit 1;

  -- Trava do placar
  select coalesce(sum((e->>'gols')::int), 0) into soma_c
    from jsonb_array_elements(p->'escalacao') e where e->>'lado' = 'C';
  select coalesce(sum((e->>'gols')::int), 0) into soma_f
    from jsonb_array_elements(p->'escalacao') e where e->>'lado' = 'F';

  if soma_c <> (p->>'gols_casa')::int then
    raise exception 'Gols da casa (%) não batem com o placar (%)', soma_c, p->>'gols_casa';
  end if;
  if soma_f <> (p->>'gols_fora')::int then
    raise exception 'Gols de fora (%) não batem com o placar (%)', soma_f, p->>'gols_fora';
  end if;

  -- Rodada: cria nova, ou regrava a existente do zero
  if p->>'rodada_id' is not null then
    v_rodada := (p->>'rodada_id')::uuid;
    update rodada
       set data = (p->>'data')::date,
           hora_inicio = nullif(p->>'hora_inicio', '')::time
     where id = v_rodada;
    delete from partida where rodada_id = v_rodada;   -- cascata leva a escalação
  else
    insert into rodada (horario_id, data, hora_inicio, local)
    values (v_horario, (p->>'data')::date, nullif(p->>'hora_inicio', '')::time, p->>'local')
    returning id into v_rodada;
  end if;

  insert into partida (horario_id, rodada_id, ordem,
                       uniforme_casa_id, uniforme_fora_id, gols_casa, gols_fora,
                       goleiro_casa_id, goleiro_fora_id)
  values (v_horario, v_rodada, 1,
          (p->>'uniforme_casa')::uuid, (p->>'uniforme_fora')::uuid,
          (p->>'gols_casa')::int, (p->>'gols_fora')::int,
          nullif(p->>'goleiro_casa', '')::uuid, nullif(p->>'goleiro_fora', '')::uuid)
  returning id into v_partida;

  for item in select * from jsonb_array_elements(p->'escalacao') loop
    insert into escalacao (horario_id, partida_id, jogador_id, lado, posicao, gols, assistencias)
    values (v_horario, v_partida, (item->>'jogador')::uuid, item->>'lado', item->>'posicao',
            coalesce((item->>'gols')::int, 0), coalesce((item->>'assistencias')::int, 0));
  end loop;

  return v_rodada;
end $fn$;

-- A função roda com os privilégios de quem chama, então o RLS continua valendo:
-- só quem está em administrador consegue gravar.
grant execute on function salvar_rodada(jsonb) to authenticated;
revoke execute on function salvar_rodada(jsonb) from anon;
