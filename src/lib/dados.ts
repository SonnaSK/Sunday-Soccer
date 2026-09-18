// src/lib/dados.ts
//
// ÚNICA camada de acesso ao banco. Nenhum componente chama supabase.from()
// direto. O motivo é prático: modo offline, cache ou troca de backend viram
// mudança em um arquivo em vez de quarenta.

import { supabase } from "./supabase";
import type {
  Jogador, Uniforme, Rodada, Partida, Escalacao,
  Participacao, GoleiroPartida, FichaPartida, RodadaParaSalvar,
  RodadaDetalhada,
} from "./tipos";

function erro(contexto: string, e: unknown): never {
  console.error(`[dados] ${contexto}`, e);
  const msg = (e as { message?: string })?.message ?? "erro desconhecido";
  throw new Error(`${contexto}: ${msg}`);
}

/* ---------------------------------------------------------------- */
/*  Sessão                                                          */
/* ---------------------------------------------------------------- */

export async function entrar(email: string, senha: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password: senha,
  });
  if (error) erro("entrar", error);
  return data.user;
}

export async function sair() {
  await supabase.auth.signOut();
}

export async function usuarioAtual() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Administrador DESTE horário. Use para mostrar/esconder controles.
 *
 * O filtro por horario_id espelha `eh_admin(h)` no banco, que confere
 * `horario_id = h and user_id = auth.uid()`. Sem ele, quem administrasse
 * outro horário veria os botões de editar e excluir aqui e só descobriria
 * a recusa ao clicar. Na v1 há um horário só e os dois dão o mesmo
 * resultado; a diferença aparece quando houver mais de um, que é
 * justamente o motivo de horario_id existir em todas as tabelas.
 *
 * Isto é conveniência de interface, não a trava: quem garante é o RLS.
 */
export async function ehAdministrador(): Promise<boolean> {
  const user = await usuarioAtual();
  if (!user) return false;
  const { data, error } = await supabase
    .from("administrador")
    .select("papel")
    .eq("user_id", user.id)
    .eq("horario_id", await horarioAtual())
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/* ---------------------------------------------------------------- */
/*  Jogadores                                                       */
/* ---------------------------------------------------------------- */

export async function listarJogadores(incluirInativos = false): Promise<Jogador[]> {
  let q = supabase.from("jogador").select("*").order("apelido");
  if (!incluirInativos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) erro("listarJogadores", error);
  return data as Jogador[];
}

export async function criarJogador(
  j: Pick<Jogador, "apelido"> & Partial<Jogador>
): Promise<Jogador> {
  const horario_id = await horarioAtual();
  const { data, error } = await supabase
    .from("jogador")
    .insert({ horario_id, tipo: "linha", vinculo: "suplente", ...j })
    .select().single();
  if (error) erro("criarJogador", error);
  return data as Jogador;
}

export async function atualizarJogador(id: string, campos: Partial<Jogador>) {
  const { error } = await supabase.from("jogador").update(campos).eq("id", id);
  if (error) erro("atualizarJogador", error);
}

/**
 * Apaga de verdade. Só use em jogador que nunca entrou em partida — o
 * banco recusa o resto, porque escalacao aponta para ele. Para quem tem
 * histórico, o caminho é `atualizarJogador(id, { ativo: false })`.
 */
export async function excluirJogador(id: string) {
  const { error } = await supabase.from("jogador").delete().eq("id", id);
  if (error) erro("excluirJogador", error);
}

/**
 * Quem já apareceu em alguma partida, como jogador de linha ou no gol.
 * Lê escalacao e partida direto, e não as views, porque estas escondem
 * rodada arquivada — e histórico arquivado ainda impede exclusão.
 */
export async function idsDeJogadoresComHistorico(): Promise<Set<string>> {
  const [esc, par] = await Promise.all([
    supabase.from("escalacao").select("jogador_id"),
    supabase.from("partida").select("goleiro_casa_id, goleiro_fora_id"),
  ]);
  if (esc.error) erro("idsDeJogadoresComHistorico", esc.error);
  if (par.error) erro("idsDeJogadoresComHistorico", par.error);

  const ids = new Set<string>();
  for (const e of esc.data as Array<{ jogador_id: string }>) ids.add(e.jogador_id);
  for (const p of par.data as Array<{
    goleiro_casa_id: string | null; goleiro_fora_id: string | null;
  }>) {
    if (p.goleiro_casa_id) ids.add(p.goleiro_casa_id);
    if (p.goleiro_fora_id) ids.add(p.goleiro_fora_id);
  }
  return ids;
}

/* ---------------------------------------------------------------- */
/*  Uniformes                                                       */
/* ---------------------------------------------------------------- */

export async function listarUniformes(somenteAtivos = false): Promise<Uniforme[]> {
  let q = supabase.from("uniforme").select("*").order("ano", { ascending: false });
  if (somenteAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) erro("listarUniformes", error);
  return data as Uniforme[];
}

export async function criarUniforme(u: {
  nome: string; cor_primaria: string; cor_secundaria: string; ano?: number;
}): Promise<Uniforme> {
  const horario_id = await horarioAtual();
  const { data, error } = await supabase
    .from("uniforme")
    .insert({ horario_id, ano: new Date().getFullYear(), ...u })
    .select().single();
  if (error) erro("criarUniforme", error);
  return data as Uniforme;
}

export async function atualizarUniforme(id: string, campos: Partial<Uniforme>) {
  const { error } = await supabase.from("uniforme").update(campos).eq("id", id);
  if (error) erro("atualizarUniforme", error);
}

/** Aposenta ou reativa. Nunca apague um uniforme: partidas antigas apontam para ele. */
export async function alternarUniforme(id: string, ativo: boolean) {
  const { error } = await supabase.from("uniforme").update({ ativo }).eq("id", id);
  if (error) erro("alternarUniforme", error);
}

/* ---------------------------------------------------------------- */
/*  Rodadas                                                         */
/* ---------------------------------------------------------------- */

export async function listarRodadas(): Promise<Rodada[]> {
  const { data, error } = await supabase
    .from("rodada").select("*").eq("ativo", true).order("data", { ascending: false });
  if (error) erro("listarRodadas", error);
  return data as Rodada[];
}

export async function lerRodada(id: string): Promise<{
  rodada: Rodada; partida: Partida; escalacao: Escalacao[];
}> {
  const { data, error } = await supabase
    .from("rodada")
    .select("*, partida(*, escalacao(*))")
    .eq("id", id).single();
  if (error) erro("lerRodada", error);

  const r = data as Rodada & { partida: Array<Partida & { escalacao: Escalacao[] }> };
  const partida = r.partida[0];
  return { rodada: r, partida, escalacao: partida?.escalacao ?? [] };
}

/**
 * Grava rodada + partida + escalação numa transação só, via função no Postgres.
 * O banco rejeita se a soma dos gols não bater com o placar — a validação da
 * tela é conveniência, esta aqui é a garantia.
 */
export async function salvarRodada(r: RodadaParaSalvar): Promise<string> {
  const { data, error } = await supabase.rpc("salvar_rodada", { p: r });
  if (error) erro("salvarRodada", error);
  return data as string;
}

/**
 * Rodadas com partidas e uniformes resolvidos, para a tela de gerenciamento.
 *
 * As partidas vêm aninhadas, mas os uniformes são casados aqui em memória
 * em vez de por join aninhado: `partida` aponta duas vezes para `uniforme`,
 * e desambiguar isso no PostgREST exige citar o nome da constraint de
 * chave estrangeira — detalhe frágil, e são três linhas de uniforme.
 */
export async function listarRodadasDetalhadas(
  incluirArquivadas = false
): Promise<RodadaDetalhada[]> {
  let q = supabase
    .from("rodada").select("*, partida(*)").order("data", { ascending: false });
  if (!incluirArquivadas) q = q.eq("ativo", true);

  const { data, error } = await q;
  if (error) erro("listarRodadasDetalhadas", error);

  const porId = new Map((await listarUniformes()).map((u) => [u.id, u]));

  return (data as Array<Rodada & { partida: Partida[] }>).map(
    ({ partida, ...rodada }) => ({
      rodada,
      partidas: [...(partida ?? [])]
        .sort((a, b) => a.ordem - b.ordem)
        .map((p) => ({
          partida: p,
          uniforme_casa: porId.get(p.uniforme_casa_id) ?? null,
          uniforme_fora: porId.get(p.uniforme_fora_id) ?? null,
        })),
    })
  );
}

/**
 * Exclusão lógica. Nunca DELETE — as três views filtram `where r.ativo`,
 * então arquivar já tira a rodada de toda estatística, e o dado continua
 * lá para ser restaurado.
 */
export async function arquivarRodada(id: string) {
  const { error } = await supabase.from("rodada").update({ ativo: false }).eq("id", id);
  if (error) erro("arquivarRodada", error);
}

/** Desfaz o arquivamento. */
export async function restaurarRodada(id: string) {
  const { error } = await supabase.from("rodada").update({ ativo: true }).eq("id", id);
  if (error) erro("restaurarRodada", error);
}

/* ---------------------------------------------------------------- */
/*  Estatística                                                     */
/* ---------------------------------------------------------------- */

export async function listarParticipacoes(): Promise<Participacao[]> {
  const { data, error } = await supabase.from("v_participacao").select("*");
  if (error) erro("listarParticipacoes", error);
  return data as Participacao[];
}

export async function listarGoleiros(): Promise<GoleiroPartida[]> {
  const { data, error } = await supabase.from("v_goleiro").select("*");
  if (error) erro("listarGoleiros", error);
  return data as GoleiroPartida[];
}

export async function listarFichasPartida(): Promise<FichaPartida[]> {
  const { data, error } = await supabase
    .from("v_partida").select("*").order("data", { ascending: false });
  if (error) erro("listarFichasPartida", error);
  return data as FichaPartida[];
}

/* ---------------------------------------------------------------- */

let _horarioId: string | null = null;

/** Na v1 existe um horário só. Isolado aqui para virar multi-horário sem caçar código. */
export async function horarioAtual(): Promise<string> {
  if (_horarioId) return _horarioId;
  const { data, error } = await supabase.from("horario").select("id").limit(1).single();
  if (error) erro("horarioAtual", error);
  _horarioId = (data as { id: string }).id;
  return _horarioId;
}
