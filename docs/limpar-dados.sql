-- ============================================================
-- LIMPEZA — apaga rodadas, partidas, escalação e jogadores
--
-- ATENÇÃO: isto é DELETE de verdade e NÃO TEM VOLTA. Não é o que o app
-- faz: o app arquiva (`ativo = false`), justamente para poder desfazer.
-- Este arquivo é manutenção, para zerar o banco antes do uso real.
--
-- Rodar uma vez, no SQL Editor do Supabase. Depois disso, cadastrar o
-- elenco pela tela de Elenco.
-- ============================================================

-- O que NÃO é apagado, e por quê:
--   horario       — tudo pendura nele; apagar quebraria o app inteiro
--   uniforme      — Boca, Racing e Preto são os uniformes reais em rotação
--   administrador — é o seu acesso de escrita
--
-- Para apagar os uniformes também, descomente o bloco no fim. Mas prefira
-- aposentá-los pela tela: uniforme aposentado some do lançamento e mantém
-- o histórico íntegro, que é a regra do projeto.

begin;

-- A ordem importa: as chaves estrangeiras vão das folhas para a raiz.
-- escalacao e partida apontam para jogador, então jogador sai por último.

delete from presenca;    -- v1.2, normalmente vazia
delete from escalacao;
delete from partida;
delete from rodada;
delete from jogador;

commit;


-- ============================================================
-- Conferência — rode depois e espere zero nas cinco primeiras
-- ============================================================

select 'rodada'        as tabela, count(*) from rodada
union all select 'partida',        count(*) from partida
union all select 'escalacao',      count(*) from escalacao
union all select 'jogador',        count(*) from jogador
union all select 'presenca',       count(*) from presenca
union all select 'uniforme (fica)', count(*) from uniforme
union all select 'horario (fica)',  count(*) from horario
union all select 'administrador (fica)', count(*) from administrador;


-- ============================================================
-- Opcional: apagar também os uniformes
-- Só funciona com partida já vazia, senão a chave estrangeira recusa —
-- e essa recusa é proposital.
-- ============================================================

-- delete from uniforme;
