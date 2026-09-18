import { useEffect, useState } from "react";
import {
  listarJogadores,
  listarUniformes,
  criarJogador,
  criarUniforme,
  alternarUniforme,
} from "../lib/dados";
import type { Jogador, Uniforme, TipoJogador, Vinculo } from "../lib/tipos";

/**
 * Elenco: uniformes e jogadores.
 *
 * Lê em público — é o que permite mandar o link no grupo. Escreve só com
 * `admin`, porque o RLS restringe insert e update a quem está na tabela
 * `administrador`. Sem login os formulários nem aparecem, em vez de
 * aparecerem e falharem no envio.
 */
export default function Elenco({ admin }: { admin: boolean }) {
  const [jogadores, setJogadores] = useState<Jogador[] | null>(null);
  const [uniformes, setUniformes] = useState<Uniforme[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      const [j, u] = await Promise.all([listarJogadores(), listarUniformes()]);
      setJogadores(j);
      setUniformes(u);
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!jogadores || !uniformes)
    return <p className="text-muted">Carregando elenco…</p>;

  return (
    <div className="space-y-10">
      <SecaoUniformes
        uniformes={uniformes}
        admin={admin}
        aoMudar={() => void carregar()}
      />
      <SecaoJogadores
        jogadores={jogadores}
        admin={admin}
        aoMudar={() => void carregar()}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Uniformes                                                       */
/* ---------------------------------------------------------------- */

function SecaoUniformes({
  uniformes,
  admin,
  aoMudar,
}: {
  uniformes: Uniforme[];
  admin: boolean;
  aoMudar: () => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Aposentar nunca apaga: partidas antigas continuam apontando para ele.
  async function alternar(u: Uniforme) {
    setErro(null);
    setOcupado(u.id);
    try {
      await alternarUniforme(u.id, !u.ativo);
      aoMudar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section>
      <Titulo>Uniformes</Titulo>

      {erro && <Aviso>{erro}</Aviso>}

      <ul className="divide-line divide-y">
        {uniformes.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-3">
            <Amostra primaria={u.cor_primaria} secundaria={u.cor_secundaria} />
            <div className="min-w-0 flex-1">
              <p className={u.ativo ? "font-medium" : "text-muted font-medium"}>
                {u.nome}
              </p>
              <p className="text-muted tabular text-sm">
                {u.ano ?? "—"}
                {!u.ativo && " · aposentado"}
              </p>
            </div>
            {admin && (
              <button
                onClick={() => void alternar(u)}
                disabled={ocupado === u.id}
                className="border-line text-muted shrink-0 rounded border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {u.ativo ? "Aposentar" : "Reativar"}
              </button>
            )}
          </li>
        ))}
      </ul>

      {admin && <FormUniforme aoCriar={aoMudar} />}
    </section>
  );
}

function FormUniforme({ aoCriar }: { aoCriar: () => void }) {
  const [nome, setNome] = useState("");
  const [primaria, setPrimaria] = useState("#1E5AA8");
  const [secundaria, setSecundaria] = useState("#EDEBE3");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await criarUniforme({
        nome: nome.trim(),
        cor_primaria: primaria,
        cor_secundaria: secundaria,
        ano: Number(ano),
      });
      setNome("");
      aoCriar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="border-line bg-surface mt-4 space-y-3 rounded-lg border p-4"
    >
      <p className="text-muted text-sm">Novo uniforme</p>

      <Texto rotulo="Nome" valor={nome} aoMudar={setNome} />

      <div className="flex flex-wrap gap-4">
        <Cor rotulo="Cor primária" valor={primaria} aoMudar={setPrimaria} />
        <Cor rotulo="Cor secundária" valor={secundaria} aoMudar={setSecundaria} />
        <label className="block">
          <span className="text-muted mb-1 block text-sm">Ano</span>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="bg-surface2 border-line text-chalk tabular w-24 rounded border px-3 py-2"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-muted text-sm">Prévia:</span>
        <Amostra primaria={primaria} secundaria={secundaria} />
      </div>

      {erro && <p className="text-alert text-sm">{erro}</p>}

      <button
        type="submit"
        disabled={enviando || !nome.trim()}
        className="bg-gold text-pitch rounded px-4 py-2 font-semibold disabled:opacity-40"
      >
        {enviando ? "Salvando…" : "Criar uniforme"}
      </button>
    </form>
  );
}

function Amostra({
  primaria,
  secundaria,
}: {
  primaria: string;
  secundaria: string;
}) {
  return (
    <span
      aria-hidden
      className="border-line inline-block h-8 w-8 shrink-0 rounded-full border"
      style={{
        background: `linear-gradient(135deg, ${primaria} 50%, ${secundaria} 50%)`,
      }}
    />
  );
}

/* ---------------------------------------------------------------- */
/*  Jogadores                                                       */
/* ---------------------------------------------------------------- */

const VINCULOS: Vinculo[] = ["mensalista", "suplente", "contratado", "espera"];

function SecaoJogadores({
  jogadores,
  admin,
  aoMudar,
}: {
  jogadores: Jogador[];
  admin: boolean;
  aoMudar: () => void;
}) {
  return (
    <section>
      <Titulo>
        Jogadores <span className="tabular">({jogadores.length})</span>
      </Titulo>

      <ul className="divide-line divide-y">
        {jogadores.map((j) => (
          <li key={j.id} className="flex items-baseline gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {j.apelido}
                {j.tipo === "goleiro" && (
                  <span className="text-gold ml-2 text-xs uppercase">
                    goleiro
                  </span>
                )}
              </p>
              {(j.nome_completo || j.posicao_preferida) && (
                <p className="text-muted truncate text-sm">
                  {[j.nome_completo, j.posicao_preferida]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <span className="text-muted shrink-0 text-xs uppercase">
              {j.vinculo}
            </span>
          </li>
        ))}
      </ul>

      {admin && <FormJogador aoCriar={aoMudar} />}
    </section>
  );
}

function FormJogador({ aoCriar }: { aoCriar: () => void }) {
  const [apelido, setApelido] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [posicao, setPosicao] = useState("");
  const [tipo, setTipo] = useState<TipoJogador>("linha");
  const [vinculo, setVinculo] = useState<Vinculo>("suplente");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await criarJogador({
        apelido: apelido.trim(),
        nome_completo: nomeCompleto.trim() || null,
        posicao_preferida: posicao.trim() || null,
        tipo,
        vinculo,
      });
      setApelido("");
      setNomeCompleto("");
      setPosicao("");
      aoCriar();
    } catch (x) {
      const m = x instanceof Error ? x.message : String(x);
      // O apelido é único dentro do horário: é ele que a leitura de súmula procura.
      setErro(
        /duplicate|unique/i.test(m)
          ? `Já existe um jogador com o apelido "${apelido.trim()}". O apelido precisa ser único.`
          : m
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="border-line bg-surface mt-4 space-y-3 rounded-lg border p-4"
    >
      <p className="text-muted text-sm">Novo jogador</p>

      <Texto rotulo="Apelido" valor={apelido} aoMudar={setApelido} />
      <Texto
        rotulo="Nome completo"
        valor={nomeCompleto}
        aoMudar={setNomeCompleto}
        opcional
      />
      <Texto
        rotulo="Posição preferida"
        valor={posicao}
        aoMudar={setPosicao}
        opcional
      />

      <div className="flex flex-wrap gap-4">
        <Escolha
          rotulo="Tipo"
          valor={tipo}
          opcoes={["linha", "goleiro"]}
          aoMudar={(v) => setTipo(v as TipoJogador)}
        />
        <Escolha
          rotulo="Vínculo"
          valor={vinculo}
          opcoes={VINCULOS}
          aoMudar={(v) => setVinculo(v as Vinculo)}
        />
      </div>

      {erro && <p className="text-alert text-sm">{erro}</p>}

      <button
        type="submit"
        disabled={enviando || !apelido.trim()}
        className="bg-gold text-pitch rounded px-4 py-2 font-semibold disabled:opacity-40"
      >
        {enviando ? "Salvando…" : "Criar jogador"}
      </button>
    </form>
  );
}

/* ---------------------------------------------------------------- */
/*  Peças comuns                                                    */
/* ---------------------------------------------------------------- */

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-condensed border-line mb-2 border-b pb-1 text-2xl tracking-wide uppercase">
      {children}
    </h2>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-alert bg-surface text-alert my-3 rounded-lg border p-3 text-sm break-words">
      {children}
    </div>
  );
}

function Texto({
  rotulo,
  valor,
  aoMudar,
  opcional,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  opcional?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-muted mb-1 block text-sm">
        {rotulo}
        {opcional && <span className="ml-1 text-xs">(opcional)</span>}
      </span>
      <input
        type="text"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="bg-surface2 border-line text-chalk w-full rounded border px-3 py-2"
      />
    </label>
  );
}

function Cor({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-muted mb-1 block text-sm">{rotulo}</span>
      <input
        type="color"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="border-line bg-surface2 h-10 w-16 rounded border"
      />
    </label>
  );
}

function Escolha({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  opcoes: readonly string[];
  aoMudar: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-muted mb-1 block text-sm">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="bg-surface2 border-line text-chalk rounded border px-3 py-2 capitalize"
      >
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
