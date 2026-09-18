import { useCallback, useEffect, useState } from "react";
import {
  listarJogadores,
  listarUniformes,
  listarRodadasDetalhadas,
  lerRodada,
  salvarRodada,
} from "../lib/dados";
import type { Jogador, Uniforme, Lado } from "../lib/tipos";

/**
 * Lançar, modo preencher.
 *
 * É a tela que substitui a planilha, e a única com trava dura: o botão de
 * salvar fica desabilitado enquanto a soma dos gols individuais não bate
 * exatamente com o placar declarado dos dois lados. A `salvar_rodada`
 * repete a conferência no servidor — esta aqui existe para avisar antes,
 * não para ser a garantia.
 *
 * Assistência nunca bloqueia: campo opcional, padrão zero, sem validação
 * cruzada. O dado de origem é reconhecidamente incerto.
 */

type Linha = { lado: Lado; gols: number; assistencias: number };
type Escalados = Record<string, Linha>;

export default function Lancar({
  rodadaId,
  aoSalvar,
  aoCancelar,
}: {
  rodadaId?: string;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [uniformes, setUniformes] = useState<Uniforme[]>([]);

  const [data, setData] = useState(hoje());
  const [hora, setHora] = useState("09:00");
  const [local, setLocal] = useState("");
  const [uniCasa, setUniCasa] = useState("");
  const [uniFora, setUniFora] = useState("");
  const [golsCasa, setGolsCasa] = useState(0);
  const [golsFora, setGolsFora] = useState(0);
  const [goleiroCasa, setGoleiroCasa] = useState("");
  const [goleiroFora, setGoleiroFora] = useState("");
  const [escalados, setEscalados] = useState<Escalados>({});

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [js, us] = await Promise.all([listarJogadores(), listarUniformes()]);
      setJogadores(js);
      setUniformes(us);

      if (rodadaId) {
        const { rodada, partida, escalacao } = await lerRodada(rodadaId);
        setData(rodada.data);
        setHora(rodada.hora_inicio?.slice(0, 5) ?? "");
        setLocal(rodada.local ?? "");
        setUniCasa(partida.uniforme_casa_id);
        setUniFora(partida.uniforme_fora_id);
        setGolsCasa(partida.gols_casa);
        setGolsFora(partida.gols_fora);
        setGoleiroCasa(partida.goleiro_casa_id ?? "");
        setGoleiroFora(partida.goleiro_fora_id ?? "");
        setEscalados(
          Object.fromEntries(
            escalacao.map((e) => [
              e.jogador_id,
              { lado: e.lado, gols: e.gols, assistencias: e.assistencias },
            ])
          )
        );
      } else {
        const ativos = us.filter((u) => u.ativo);
        setUniCasa(ativos[0]?.id ?? "");
        setUniFora(ativos[1]?.id ?? "");

        // Os goleiros são contratados fixos: pré-preencher com os da rodada
        // anterior economiza dois toques toda semana.
        const [ultima] = await listarRodadasDetalhadas();
        const anterior = ultima?.partidas[0]?.partida;
        if (anterior) {
          setGoleiroCasa(anterior.goleiro_casa_id ?? "");
          setGoleiroFora(anterior.goleiro_fora_id ?? "");
        }
      }
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setCarregando(false);
    }
  }, [rodadaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /* -------------------------------------------------------------- */

  function alternarLado(id: string, lado: Lado) {
    setEscalados((e) => {
      // O índice é tipado como sempre presente, mas em tempo de execução
      // pode não estar: quem ainda não foi escalado não tem linha.
      const atual: Linha | undefined = e[id];
      const copia = { ...e };
      // Clicar no lado em que já está remove; clicar no outro troca de lado
      // preservando gols e assistências já lançados.
      if (atual?.lado === lado) delete copia[id];
      else copia[id] = atual ? { ...atual, lado } : { lado, gols: 0, assistencias: 0 };
      return copia;
    });
  }

  function somar(id: string, campo: "gols" | "assistencias", delta: number) {
    setEscalados((e) => {
      const linha = e[id];
      if (!linha) return e;
      return {
        ...e,
        [id]: { ...linha, [campo]: Math.max(0, linha[campo] + delta) },
      };
    });
  }

  const linhas = Object.entries(escalados);
  const somaCasa = soma(linhas, "C");
  const somaFora = soma(linhas, "F");
  const qtdCasa = linhas.filter(([, l]) => l.lado === "C").length;
  const qtdFora = linhas.filter(([, l]) => l.lado === "F").length;

  const fecha = somaCasa === golsCasa && somaFora === golsFora;
  // Uma rodada sem ninguém escalado não gera estatística nenhuma: é erro,
  // não caso de uso. O placar zerado passaria na trava sem isto.
  const temGente = qtdCasa > 0 && qtdFora > 0;
  const uniformesOk = !!uniCasa && !!uniFora && uniCasa !== uniFora;
  const podeSalvar = fecha && temGente && uniformesOk && !!data && !salvando;

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await salvarRodada({
        rodada_id: rodadaId,
        data,
        hora_inicio: hora || undefined,
        local: local.trim() || undefined,
        uniforme_casa: uniCasa,
        uniforme_fora: uniFora,
        gols_casa: golsCasa,
        gols_fora: golsFora,
        goleiro_casa: goleiroCasa || undefined,
        goleiro_fora: goleiroFora || undefined,
        escalacao: linhas.map(([jogador, l]) => ({
          jogador,
          lado: l.lado,
          gols: l.gols,
          assistencias: l.assistencias,
        })),
      });
      aoSalvar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
      setSalvando(false);
    }
  }

  /* -------------------------------------------------------------- */

  if (carregando) return <p className="text-muted">Carregando…</p>;

  const deLinha = jogadores.filter((j) => j.tipo === "linha");
  const goleiros = jogadores.filter((j) => j.tipo === "goleiro");

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-condensed text-2xl tracking-wide uppercase">
          {rodadaId ? "Editar rodada" : "Lançar rodada"}
        </h2>
        <button onClick={aoCancelar} className="text-muted text-sm underline">
          Cancelar
        </button>
      </div>

      {/* Quando e onde */}
      <div className="flex flex-wrap gap-3">
        <Campo rotulo="Data">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="bg-surface2 border-line text-chalk tabular rounded border px-3 py-2"
          />
        </Campo>
        <Campo rotulo="Início">
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="bg-surface2 border-line text-chalk tabular rounded border px-3 py-2"
          />
        </Campo>
        <Campo rotulo="Local (opcional)">
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="bg-surface2 border-line text-chalk w-32 rounded border px-3 py-2"
          />
        </Campo>
      </div>

      {/* Os dois times */}
      <div className="grid grid-cols-2 gap-3">
        <CartaoTime
          uniformes={uniformes}
          selecionado={uniCasa}
          aoSelecionar={setUniCasa}
          gols={golsCasa}
          aoMudarGols={setGolsCasa}
          lancados={somaCasa}
          goleiros={goleiros}
          goleiro={goleiroCasa}
          aoSelecionarGoleiro={setGoleiroCasa}
        />
        <CartaoTime
          uniformes={uniformes}
          selecionado={uniFora}
          aoSelecionar={setUniFora}
          gols={golsFora}
          aoMudarGols={setGolsFora}
          lancados={somaFora}
          goleiros={goleiros}
          goleiro={goleiroFora}
          aoSelecionarGoleiro={setGoleiroFora}
        />
      </div>

      {!uniformesOk && (
        <p className="text-alert text-sm">
          {uniCasa && uniCasa === uniFora
            ? "Os dois lados estão com o mesmo uniforme."
            : "Escolha o uniforme dos dois lados."}
        </p>
      )}

      {/* Quem jogou */}
      <div>
        <h3 className="font-condensed text-muted border-line mb-2 border-b pb-1 text-xl tracking-wide uppercase">
          Quem jogou
        </h3>

        {deLinha.length === 0 && (
          <p className="text-muted py-3 text-sm">
            Nenhum jogador de linha cadastrado. Cadastre o elenco primeiro.
          </p>
        )}

        <ul className="divide-line divide-y">
          {deLinha.map((j) => (
            <LinhaJogador
              key={j.id}
              jogador={j}
              linha={escalados[j.id]}
              aoAlternar={(lado) => alternarLado(j.id, lado)}
              aoSomar={(campo, d) => somar(j.id, campo, d)}
            />
          ))}
        </ul>
      </div>

      {erro && (
        <div className="border-alert bg-surface text-alert rounded-lg border p-3 text-sm break-words">
          {erro}
        </div>
      )}

      <div className="border-line bg-surface sticky bottom-0 -mx-4 border-t px-4 py-3">
        <button
          onClick={() => void salvar()}
          disabled={!podeSalvar}
          className="bg-gold text-pitch w-full rounded py-3 font-semibold disabled:opacity-40"
        >
          {salvando ? "Salvando…" : rodadaId ? "Salvar alterações" : "Salvar rodada"}
        </button>
        {!fecha && (
          <p className="text-muted mt-2 text-center text-sm">
            A soma dos gols precisa bater com o placar dos dois lados.
          </p>
        )}
        {fecha && !temGente && (
          <p className="text-muted mt-2 text-center text-sm">
            Marque quem jogou de cada lado.
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

function CartaoTime({
  uniformes,
  selecionado,
  aoSelecionar,
  gols,
  aoMudarGols,
  lancados,
  goleiros,
  goleiro,
  aoSelecionarGoleiro,
}: {
  uniformes: Uniforme[];
  selecionado: string;
  aoSelecionar: (id: string) => void;
  gols: number;
  aoMudarGols: (n: number) => void;
  lancados: number;
  goleiros: Jogador[];
  goleiro: string;
  aoSelecionarGoleiro: (id: string) => void;
}) {
  const uni = uniformes.find((u) => u.id === selecionado);
  // Aposentado some do seletor, mas o já selecionado continua na lista —
  // senão editar rodada antiga apagaria o uniforme dela.
  const opcoes = uniformes.filter((u) => u.ativo || u.id === selecionado);

  const estourou = lancados > gols;
  const proporcao = gols > 0 ? Math.min(1, lancados / gols) : lancados > 0 ? 1 : 0;

  return (
    <div className="border-line bg-surface overflow-hidden rounded-lg border">
      {/* A cor do uniforme é o que diz de qual lado você está digitando. */}
      <div
        className="h-1.5"
        style={{ background: uni?.cor_primaria ?? "transparent" }}
      />
      <div className="space-y-2 p-3">
        <select
          value={selecionado}
          onChange={(e) => aoSelecionar(e.target.value)}
          className="bg-surface2 border-line text-chalk w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">Uniforme…</option>
          {opcoes.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
              {!u.ativo ? " (aposentado)" : ""}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={gols}
          onChange={(e) => aoMudarGols(Math.max(0, Number(e.target.value) || 0))}
          className="bg-surface2 border-line text-chalk font-condensed tabular w-full rounded border py-1 text-center text-4xl font-bold"
        />

        <div>
          <div className="bg-surface2 h-1.5 overflow-hidden rounded">
            <div
              className={`h-full transition-[width] ${
                estourou ? "bg-alert" : lancados === gols ? "bg-gold" : "bg-muted"
              }`}
              style={{ width: `${proporcao * 100}%` }}
            />
          </div>
          <p
            className={`tabular mt-1 text-center text-xs ${
              estourou ? "text-alert" : "text-muted"
            }`}
          >
            {lancados} de {gols} lançados
          </p>
        </div>

        <select
          value={goleiro}
          onChange={(e) => aoSelecionarGoleiro(e.target.value)}
          className="bg-surface2 border-line text-muted w-full rounded border px-2 py-1.5 text-xs"
        >
          <option value="">Goleiro…</option>
          {goleiros.map((g) => (
            <option key={g.id} value={g.id}>
              {g.apelido}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LinhaJogador({
  jogador: j,
  linha,
  aoAlternar,
  aoSomar,
}: {
  jogador: Jogador;
  linha?: Linha;
  aoAlternar: (lado: Lado) => void;
  aoSomar: (campo: "gols" | "assistencias", delta: number) => void;
}) {
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate ${
            linha ? "font-medium" : "text-muted"
          }`}
        >
          {j.apelido}
        </span>

        {(["C", "F"] as const).map((lado) => (
          <button
            key={lado}
            onClick={() => aoAlternar(lado)}
            className={`w-16 rounded border px-2 py-1 text-xs ${
              linha?.lado === lado
                ? "bg-gold text-pitch border-gold font-semibold"
                : "border-line text-muted"
            }`}
          >
            {lado === "C" ? "Casa" : "Fora"}
          </button>
        ))}
      </div>

      {linha && (
        <div className="mt-2 flex flex-wrap gap-4 pl-1">
          <Contador
            rotulo="Gols"
            valor={linha.gols}
            aoSomar={(d) => aoSomar("gols", d)}
          />
          <Contador
            rotulo="Assist."
            valor={linha.assistencias}
            aoSomar={(d) => aoSomar("assistencias", d)}
            discreto
          />
        </div>
      )}
    </li>
  );
}

function Contador({
  rotulo,
  valor,
  aoSomar,
  discreto,
}: {
  rotulo: string;
  valor: number;
  aoSomar: (delta: number) => void;
  discreto?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${discreto ? "text-muted" : "text-chalk"}`}>
        {rotulo}
      </span>
      <button
        onClick={() => aoSomar(-1)}
        disabled={valor === 0}
        className="border-line text-muted h-8 w-8 rounded border disabled:opacity-30"
        aria-label={`Menos um em ${rotulo}`}
      >
        −
      </button>
      <span className="tabular w-5 text-center font-medium">{valor}</span>
      <button
        onClick={() => aoSomar(1)}
        className="border-line text-chalk h-8 w-8 rounded border"
        aria-label={`Mais um em ${rotulo}`}
      >
        +
      </button>
    </div>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-muted mb-1 block text-sm">{rotulo}</span>
      {children}
    </label>
  );
}

/* ---------------------------------------------------------------- */

function soma(linhas: Array<[string, Linha]>, lado: Lado) {
  return linhas.reduce((s, [, l]) => (l.lado === lado ? s + l.gols : s), 0);
}

/** Data local em YYYY-MM-DD, sem passar por UTC. */
function hoje() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
