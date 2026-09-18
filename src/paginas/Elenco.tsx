import { useCallback, useEffect, useState } from "react";
import {
  listarJogadores,
  listarUniformes,
  criarJogador,
  criarUniforme,
  atualizarJogador,
  atualizarUniforme,
  alternarUniforme,
  excluirJogador,
  idsDeJogadoresComHistorico,
} from "../lib/dados";
import type { Jogador, Uniforme, TipoJogador, Vinculo } from "../lib/tipos";

/**
 * Elenco: uniformes e jogadores.
 *
 * Lê em público — é o que permite mandar o link no grupo. Escreve só com
 * `admin`, porque o RLS restringe insert e update a quem está na tabela
 * `administrador`. Sem login os controles nem aparecem, em vez de
 * aparecerem e falharem no envio.
 */
export default function Elenco({ admin }: { admin: boolean }) {
  const [jogadores, setJogadores] = useState<Jogador[] | null>(null);
  const [uniformes, setUniformes] = useState<Uniforme[] | null>(null);
  const [comHistorico, setComHistorico] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  // Administrador enxerga inativos, para poder reativar. O grupo não.
  const carregar = useCallback(async () => {
    try {
      const [j, u, h] = await Promise.all([
        listarJogadores(admin),
        listarUniformes(),
        admin ? idsDeJogadoresComHistorico() : Promise.resolve(new Set<string>()),
      ]);
      setJogadores(j);
      setUniformes(u);
      setComHistorico(h);
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    }
  }, [admin]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
        comHistorico={comHistorico}
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
  const [editando, setEditando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  return (
    <section>
      <Titulo>
        Uniformes <span className="tabular">({uniformes.length})</span>
      </Titulo>

      <ul className="divide-line divide-y">
        {uniformes.map((u) =>
          editando === u.id ? (
            <li key={u.id} className="py-3">
              <FormUniforme
                inicial={u}
                aoSalvar={() => {
                  setEditando(null);
                  aoMudar();
                }}
                aoCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <LinhaUniforme
              key={u.id}
              uniforme={u}
              admin={admin}
              aoEditar={() => setEditando(u.id)}
              aoMudar={aoMudar}
            />
          )
        )}
      </ul>

      {admin &&
        (criando ? (
          <div className="mt-4">
            <FormUniforme
              aoSalvar={() => {
                setCriando(false);
                aoMudar();
              }}
              aoCancelar={() => setCriando(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setCriando(true)}
            className="border-line text-muted mt-4 rounded border border-dashed px-4 py-2 text-sm"
          >
            + Novo uniforme
          </button>
        ))}
    </section>
  );
}

function LinhaUniforme({
  uniforme: u,
  admin,
  aoEditar,
  aoMudar,
}: {
  uniforme: Uniforme;
  admin: boolean;
  aoEditar: () => void;
  aoMudar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Aposentar nunca apaga: partidas antigas continuam apontando para ele.
  async function alternar() {
    setErro(null);
    setOcupado(true);
    try {
      await alternarUniforme(u.id, !u.ativo);
      aoMudar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
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
          <div className="flex shrink-0 gap-2">
            <Acao onClick={aoEditar}>Editar</Acao>
            <Acao onClick={() => void alternar()} disabled={ocupado}>
              {u.ativo ? "Aposentar" : "Reativar"}
            </Acao>
          </div>
        )}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
    </li>
  );
}

function FormUniforme({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: Uniforme;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [primaria, setPrimaria] = useState(inicial?.cor_primaria ?? "#1E5AA8");
  const [secundaria, setSecundaria] = useState(
    inicial?.cor_secundaria ?? "#EDEBE3"
  );
  const [ano, setAno] = useState(
    String(inicial?.ano ?? new Date().getFullYear())
  );
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const campos = {
      nome: nome.trim(),
      cor_primaria: primaria,
      cor_secundaria: secundaria,
      ano: Number(ano),
    };
    try {
      if (inicial) await atualizarUniforme(inicial.id, campos);
      else await criarUniforme(campos);
      aoSalvar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="border-line bg-surface space-y-3 rounded-lg border p-4"
    >
      <p className="text-muted text-sm">
        {inicial ? `Editando ${inicial.nome}` : "Novo uniforme"}
      </p>

      <Texto rotulo="Nome" valor={nome} aoMudar={setNome} />

      <div className="flex flex-wrap items-start gap-4">
        <Cor rotulo="Primária" valor={primaria} aoMudar={setPrimaria} />
        <Cor rotulo="Secundária" valor={secundaria} aoMudar={setSecundaria} />
        <label className="block">
          <span className="text-muted mb-1 block text-sm">Ano</span>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="bg-surface2 border-line text-chalk tabular w-24 rounded border px-3 py-2"
          />
        </label>
        <div className="flex items-center gap-2 pb-2">
          <span className="text-muted text-sm">Prévia:</span>
          <Amostra primaria={primaria} secundaria={secundaria} />
        </div>
      </div>

      {erro && <p className="text-alert text-sm">{erro}</p>}

      <Botoes
        enviando={enviando}
        desabilitado={!nome.trim()}
        rotulo={inicial ? "Salvar" : "Criar uniforme"}
        aoCancelar={aoCancelar}
      />
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
  comHistorico,
  admin,
  aoMudar,
}: {
  jogadores: Jogador[];
  comHistorico: Set<string>;
  admin: boolean;
  aoMudar: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const ativos = jogadores.filter((j) => j.ativo).length;

  return (
    <section>
      <Titulo>
        Jogadores <span className="tabular">({ativos})</span>
      </Titulo>

      <ul className="divide-line divide-y">
        {jogadores.map((j) =>
          editando === j.id ? (
            <li key={j.id} className="py-3">
              <FormJogador
                inicial={j}
                aoSalvar={() => {
                  setEditando(null);
                  aoMudar();
                }}
                aoCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <LinhaJogador
              key={j.id}
              jogador={j}
              admin={admin}
              temHistorico={comHistorico.has(j.id)}
              aoEditar={() => setEditando(j.id)}
              aoMudar={aoMudar}
            />
          )
        )}
      </ul>

      {admin &&
        (criando ? (
          <div className="mt-4">
            <FormJogador
              aoSalvar={() => {
                setCriando(false);
                aoMudar();
              }}
              aoCancelar={() => setCriando(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setCriando(true)}
            className="border-line text-muted mt-4 rounded border border-dashed px-4 py-2 text-sm"
          >
            + Novo jogador
          </button>
        ))}
    </section>
  );
}

function LinhaJogador({
  jogador: j,
  admin,
  temHistorico,
  aoEditar,
  aoMudar,
}: {
  jogador: Jogador;
  admin: boolean;
  temHistorico: boolean;
  aoEditar: () => void;
  aoMudar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
      aoMudar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
      setOcupado(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-baseline gap-3">
        <div className="min-w-0 flex-1">
          <p className={j.ativo ? "font-medium" : "text-muted font-medium"}>
            {j.apelido}
            {j.tipo === "goleiro" && (
              <span className="text-gold ml-2 text-xs uppercase">goleiro</span>
            )}
            {!j.ativo && (
              <span className="text-muted ml-2 text-xs uppercase">inativo</span>
            )}
          </p>
          {(j.nome_completo || j.posicao_preferida) && (
            <p className="text-muted truncate text-sm">
              {[j.nome_completo, j.posicao_preferida].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span className="text-muted shrink-0 text-xs uppercase">
          {j.vinculo}
        </span>
      </div>

      {admin && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Acao onClick={aoEditar}>Editar</Acao>
          <Acao
            onClick={() =>
              void executar(() => atualizarJogador(j.id, { ativo: !j.ativo }))
            }
            disabled={ocupado}
          >
            {j.ativo ? "Desativar" : "Reativar"}
          </Acao>

          {/* Exclusão real só para quem nunca entrou em partida. Com histórico,
              escalacao aponta para ele e apagar reescreveria o passado. */}
          {temHistorico ? (
            <span className="text-muted self-center text-xs">
              tem histórico — não pode ser excluído
            </span>
          ) : confirmando ? (
            <span className="flex items-center gap-2">
              <span className="text-alert text-xs">Apagar de vez?</span>
              <Acao
                onClick={() => void executar(() => excluirJogador(j.id))}
                disabled={ocupado}
                perigo
              >
                Sim, excluir
              </Acao>
              <Acao onClick={() => setConfirmando(false)}>Não</Acao>
            </span>
          ) : (
            <Acao onClick={() => setConfirmando(true)} perigo>
              Excluir
            </Acao>
          )}
        </div>
      )}

      {erro && <Aviso>{erro}</Aviso>}
    </li>
  );
}

function FormJogador({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: Jogador;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [apelido, setApelido] = useState(inicial?.apelido ?? "");
  const [nomeCompleto, setNomeCompleto] = useState(inicial?.nome_completo ?? "");
  const [posicao, setPosicao] = useState(inicial?.posicao_preferida ?? "");
  const [tipo, setTipo] = useState<TipoJogador>(inicial?.tipo ?? "linha");
  const [vinculo, setVinculo] = useState<Vinculo>(inicial?.vinculo ?? "suplente");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const campos = {
      apelido: apelido.trim(),
      nome_completo: nomeCompleto.trim() || null,
      posicao_preferida: posicao.trim() || null,
      tipo,
      vinculo,
    };
    try {
      if (inicial) await atualizarJogador(inicial.id, campos);
      else await criarJogador(campos);
      aoSalvar();
    } catch (x) {
      const m = x instanceof Error ? x.message : String(x);
      // O apelido é único dentro do horário: é por ele que a leitura de
      // súmula encontra a pessoa.
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
      className="border-line bg-surface space-y-3 rounded-lg border p-4"
    >
      <p className="text-muted text-sm">
        {inicial ? `Editando ${inicial.apelido}` : "Novo jogador"}
      </p>

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

      <Botoes
        enviando={enviando}
        desabilitado={!apelido.trim()}
        rotulo={inicial ? "Salvar" : "Criar jogador"}
        aoCancelar={aoCancelar}
      />
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
    <div className="border-alert bg-surface text-alert my-2 rounded-lg border p-3 text-sm break-words">
      {children}
    </div>
  );
}

function Acao({
  children,
  onClick,
  disabled,
  perigo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-3 py-1.5 text-sm disabled:opacity-40 ${
        perigo ? "border-alert text-alert" : "border-line text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Botoes({
  enviando,
  desabilitado,
  rotulo,
  aoCancelar,
}: {
  enviando: boolean;
  desabilitado: boolean;
  rotulo: string;
  aoCancelar: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="submit"
        disabled={enviando || desabilitado}
        className="bg-gold text-pitch rounded px-4 py-2 font-semibold disabled:opacity-40"
      >
        {enviando ? "Salvando…" : rotulo}
      </button>
      <button type="button" onClick={aoCancelar} className="text-muted px-4 py-2">
        Cancelar
      </button>
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

/**
 * Dezesseis cores de camisa, em quatro faixas: neutros, quentes, frios e
 * verdes com roxos. Cobre o que um horário de society usa na prática, e
 * inclui os tons dos uniformes atuais — o azul e o amarelo do Boca, o
 * azul-claro do Racing — para reencontrá-los num toque.
 *
 * Atalho, não limite: o seletor e o campo de código continuam ali para
 * qualquer cor fora desta lista.
 */
const PALETA: Array<[string, string]> = [
  ["#edebe3", "Branco"],    ["#9aa3a8", "Cinza"],      ["#3a4046", "Grafite"],   ["#17191c", "Preto"],
  ["#c62828", "Vermelho"],  ["#e2711d", "Laranja"],    ["#f2c230", "Amarelo"],   ["#d9a441", "Dourado"],
  ["#0b2a6b", "Marinho"],   ["#1e5aa8", "Azul"],       ["#79aedc", "Azul-claro"],["#0e8f86", "Turquesa"],
  ["#1e7a3c", "Verde"],     ["#7bb13c", "Verde-limão"],["#6b3fa0", "Roxo"],      ["#7e1f3a", "Vinho"],
];

/**
 * Cor por paleta, por seletor OU por código digitado.
 *
 * O seletor do sistema é desconfortável no celular e não permite repetir
 * uma cor exata. O campo de texto resolve os dois casos: dá para colar o
 * código da camisa e obter sempre o mesmo tom.
 *
 * O texto tem estado próprio para que digitar parcialmente não atropele a
 * cor válida; só sobe quando vira um hex completo.
 */
function Cor({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const [texto, setTexto] = useState(valor);

  useEffect(() => setTexto(valor), [valor]);

  function digitou(v: string) {
    setTexto(v);
    const hex = "#" + v.trim().replace(/^#/, "");
    if (/^#[0-9a-f]{6}$/i.test(hex)) aoMudar(hex.toLowerCase());
  }

  const atual = valor.toLowerCase();

  return (
    <div>
      <span className="text-muted mb-1 block text-sm">{rotulo}</span>

      <div className="mb-2 grid w-[9.5rem] grid-cols-4 gap-1.5">
        {PALETA.map(([hex, nome]) => (
          <button
            key={hex}
            type="button"
            onClick={() => aoMudar(hex)}
            title={nome}
            aria-label={`${rotulo}: ${nome}`}
            aria-pressed={atual === hex}
            className={`h-8 w-8 rounded border transition-[box-shadow] ${
              atual === hex
                ? "border-gold ring-gold ring-2 ring-offset-1 ring-offset-transparent"
                : "border-line"
            }`}
            style={{ background: hex }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="border-line bg-surface2 h-10 w-12 shrink-0 rounded border"
          aria-label={`${rotulo}: seletor`}
        />
        <input
          type="text"
          value={texto}
          onChange={(e) => digitou(e.target.value)}
          onBlur={() => setTexto(valor)}
          spellCheck={false}
          autoCapitalize="none"
          placeholder="#0B2A6B"
          aria-label={`${rotulo}: código`}
          className="bg-surface2 border-line text-chalk tabular w-24 rounded border px-2 py-2 font-mono text-sm"
        />
      </div>
    </div>
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
