import { useCallback, useEffect, useState } from "react";
import {
  listarRodadasDetalhadas,
  arquivarRodada,
  restaurarRodada,
} from "../lib/dados";
import type { RodadaDetalhada } from "../lib/tipos";

/**
 * Rodadas e partidas.
 *
 * Arquivar é a exclusão do app: `rodada.ativo = false`. As três views
 * filtram `where r.ativo`, então a rodada arquivada some de artilharia,
 * aproveitamento, goleiros e fichas — sem que o dado seja destruído.
 * É o que permite desfazer um arquivamento feito por engano.
 */
export default function Rodadas({
  admin,
  aoEditar,
}: {
  admin: boolean;
  aoEditar: (id: string) => void;
}) {
  const [rodadas, setRodadas] = useState<RodadaDetalhada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Só administrador enxerga arquivadas: para o grupo elas simplesmente não existem.
  const carregar = useCallback(async () => {
    try {
      setRodadas(await listarRodadasDetalhadas(admin));
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    }
  }, [admin]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alternar(id: string, ativo: boolean) {
    setErro(null);
    setOcupado(id);
    try {
      await (ativo ? arquivarRodada(id) : restaurarRodada(id));
      await carregar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado(null);
    }
  }

  if (erro)
    return (
      <div className="border-alert bg-surface text-alert rounded-lg border p-3 text-sm break-words">
        {erro}
      </div>
    );
  if (!rodadas) return <p className="text-muted">Carregando rodadas…</p>;

  const arquivadas = rodadas.filter((r) => !r.rodada.ativo).length;

  return (
    <section>
      <h2 className="font-condensed border-line mb-2 border-b pb-1 text-2xl tracking-wide uppercase">
        Rodadas <span className="tabular">({rodadas.length - arquivadas})</span>
      </h2>

      {rodadas.length === 0 && (
        <p className="text-muted py-4 text-sm">
          Nenhuma rodada registrada ainda.
        </p>
      )}

      <ul className="divide-line divide-y">
        {rodadas.map(({ rodada, partidas }) => (
          <li
            key={rodada.id}
            className={rodada.ativo ? "py-4" : "py-4 opacity-50"}
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div>
                <p className="tabular font-medium">
                  {formatarData(rodada.data)}
                  {rodada.hora_inicio && (
                    <span className="text-muted ml-2 text-sm">
                      {rodada.hora_inicio.slice(0, 5)}
                    </span>
                  )}
                </p>
                {(rodada.local || !rodada.ativo) && (
                  <p className="text-muted text-sm">
                    {[rodada.local, !rodada.ativo && "arquivada"]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>

              {admin && (
                <div className="flex shrink-0 gap-2">
                  {rodada.ativo && (
                    <button
                      onClick={() => aoEditar(rodada.id)}
                      className="border-line text-muted rounded border px-3 py-1.5 text-sm"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => void alternar(rodada.id, rodada.ativo)}
                    disabled={ocupado === rodada.id}
                    className={`rounded border px-3 py-1.5 text-sm disabled:opacity-40 ${
                      rodada.ativo
                        ? "border-alert text-alert"
                        : "border-line text-muted"
                    }`}
                  >
                    {rodada.ativo ? "Arquivar" : "Restaurar"}
                  </button>
                </div>
              )}
            </div>

            {partidas.map(({ partida, uniforme_casa, uniforme_fora }) => (
              <div
                key={partida.id}
                className="bg-surface flex items-center gap-2 rounded px-3 py-2"
              >
                <Lado
                  nome={uniforme_casa?.nome ?? "?"}
                  cor={uniforme_casa?.cor_primaria ?? "#666"}
                />
                <span className="font-condensed tabular text-xl font-bold">
                  {partida.gols_casa}
                </span>
                <span className="text-muted text-sm">x</span>
                <span className="font-condensed tabular text-xl font-bold">
                  {partida.gols_fora}
                </span>
                <Lado
                  nome={uniforme_fora?.nome ?? "?"}
                  cor={uniforme_fora?.cor_primaria ?? "#666"}
                  direita
                />
              </div>
            ))}
          </li>
        ))}
      </ul>

      {admin && arquivadas > 0 && (
        <p className="text-muted mt-4 text-sm">
          {arquivadas} rodada{arquivadas > 1 ? "s" : ""} arquivada
          {arquivadas > 1 ? "s" : ""}, visível só para você. Some de todas as
          estatísticas, mas o dado continua no banco.
        </p>
      )}
    </section>
  );
}

function Lado({
  nome,
  cor,
  direita,
}: {
  nome: string;
  cor: string;
  direita?: boolean;
}) {
  return (
    <span
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        direita ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span
        aria-hidden
        className="border-line inline-block h-3 w-3 shrink-0 rounded-full border"
        style={{ background: cor }}
      />
      <span className="truncate text-sm">{nome}</span>
    </span>
  );
}

/** `data` vem como YYYY-MM-DD. Formatado à mão para não passar por fuso. */
function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}
