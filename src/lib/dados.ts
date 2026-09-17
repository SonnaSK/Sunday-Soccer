// src/lib/dados.ts
//
// ÚNICA camada de acesso ao banco. Nenhum componente chama supabase.from()
// direto. O motivo é prático: modo offline, cache ou troca de backend viram
// mudança em um arquivo em vez de quarenta.

import { supabase } from "./supabase";
import type {
  Jogador, Uniforme, Rodada, Partida, Escalacao,
  Participacao, GoleiroPartida, FichaPartida, RodadaParaSalvar,
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

/** Só quem está em administrador pode escrever. Use para mostrar/esconder telas. */
export async function ehAdministrador(): Promise<boolean> {
  const user = await usuarioAtual();
  if (!user) return false;
  const { data, error } = await supabase
    .from("administrador").select("papel").eq("user_id", user.id).limit(1);
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

/** Exclusão lógica. Nunca DELETE. */
export async function arquivarRodada(id: string) {
  const { error } = await supabase.from("rodada").update({ ativo: false }).eq("id", id);
  if (error) erro("arquivarRodada", error);
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
