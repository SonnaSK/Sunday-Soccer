// src/lib/tipos.ts
// Espelho do schema.sql. Se mudar o banco, mude aqui primeiro.

export type TipoJogador = "linha" | "goleiro";
export type Vinculo = "mensalista" | "suplente" | "contratado" | "espera";
export type Lado = "C" | "F";
export type Resultado = "V" | "E" | "D";

export interface Jogador {
  id: string;
  horario_id: string;
  apelido: string;
  nome_completo: string | null;
  tipo: TipoJogador;
  vinculo: Vinculo;
  posicao_preferida: string | null;
  slot: number | null;
  tem_uniforme: boolean;
  ativo: boolean;
}

export interface Uniforme {
  id: string;
  horario_id: string;
  nome: string;
  cor_primaria: string;
  cor_secundaria: string;
  ano: number | null;
  ativo: boolean; // false = aposentado: some do lançamento, fica no histórico
}

export interface Rodada {
  id: string;
  horario_id: string;
  data: string; // YYYY-MM-DD
  hora_inicio: string | null; // HH:MM:SS
  local: string | null;
  observacao: string | null;
  ativo: boolean;
}

export interface Partida {
  id: string;
  rodada_id: string;
  ordem: number;
  uniforme_casa_id: string;
  uniforme_fora_id: string;
  gols_casa: number;
  gols_fora: number;
  goleiro_casa_id: string | null;
  goleiro_fora_id: string | null;
}

export interface Escalacao {
  id: string;
  partida_id: string;
  jogador_id: string;
  lado: Lado;
  posicao: string | null; // nulo no fluxo rápido
  gols: number;
  assistencias: number;
}

/** Uma linha por jogador por partida, com placar e resultado já resolvidos. */
export interface Participacao {
  jogador_id: string;
  partida_id: string;
  rodada_id: string;
  data: string;
  lado: Lado;
  posicao: string | null;
  gols: number;
  assistencias: number;
  gols_time: number;
  gols_adversario: number;
  uniforme_id: string;
  resultado: Resultado;
}

export interface GoleiroPartida {
  goleiro_id: string;
  partida_id: string;
  data: string;
  gols_sofridos: number;
}

/** Ficha resumida da partida, para navegar pelos jogos antigos. */
export interface FichaPartida {
  id: string;
  data: string;
  hora_inicio: string | null;
  uniforme_casa: string;
  cor_casa: string;
  uniforme_fora: string;
  cor_fora: string;
  gols_casa: number;
  gols_fora: number;
  total_gols: number;
  margem: number;
}

/** O que a tela de lançamento monta e manda para salvar_rodada. */
export interface RodadaParaSalvar {
  rodada_id?: string; // presente = edição
  data: string;
  hora_inicio?: string;
  local?: string;
  uniforme_casa: string;
  uniforme_fora: string;
  gols_casa: number;
  gols_fora: number;
  goleiro_casa?: string;
  goleiro_fora?: string;
  escalacao: Array<{
    jogador: string;
    lado: Lado;
    posicao?: string;
    gols: number;
    assistencias: number;
  }>;
}
