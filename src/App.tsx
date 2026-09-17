import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { listarJogadores, listarUniformes } from "./lib/dados";
import type { Jogador, Uniforme } from "./lib/tipos";

/**
 * Tela de verificação da corrente inteira — chave, grants, RLS e camada de
 * dados — como sugere o README. Não é a tela de Elenco: é o degrau anterior,
 * para que um erro de configuração apareça aqui e não no meio de uma tela.
 */
type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; jogadores: Jogador[]; uniformes: Uniforme[] };

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  useEffect(() => {
    Promise.all([listarJogadores(), listarUniformes()])
      .then(([jogadores, uniformes]) =>
        setEstado({ fase: "pronto", jogadores, uniformes })
      )
      .catch((e: unknown) =>
        setEstado({
          fase: "erro",
          mensagem: e instanceof Error ? e.message : String(e),
        })
      );
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8">
        <h1 className="font-condensed text-4xl font-bold tracking-wide uppercase">
          Domingo
        </h1>
        <p className="text-muted text-sm">Verificação de conexão</p>
      </header>

      {estado.fase === "carregando" && (
        <p className="text-muted">Consultando o banco…</p>
      )}

      {estado.fase === "erro" && (
        <div className="border-alert bg-surface rounded-lg border p-4">
          <p className="text-alert mb-2 font-semibold">A conexão falhou.</p>
          <p className="text-muted mb-3 text-sm break-words">
            {estado.mensagem}
          </p>
          <p className="text-muted text-sm">
            Confira <code className="text-chalk">.env.local</code>: a chave anon
            precisa estar preenchida. Depois de editar esse arquivo, o servidor
            tem que ser reiniciado.
          </p>
        </div>
      )}

      {estado.fase === "pronto" && (
        <div className="space-y-8">
          <p className="text-gold font-semibold">
            Conexão funcionando. Banco respondendo, RLS liberando leitura.
          </p>

          <Secao titulo="Jogadores" contagem={estado.jogadores.length}>
            <ul className="divide-line divide-y">
              {estado.jogadores.map((j) => (
                <li key={j.id} className="flex items-baseline gap-3 py-2">
                  <span className="font-medium">{j.apelido}</span>
                  <span className="text-muted text-sm">
                    {j.tipo === "goleiro" ? "goleiro" : j.vinculo}
                  </span>
                </li>
              ))}
            </ul>
          </Secao>

          <Secao titulo="Uniformes" contagem={estado.uniformes.length}>
            <ul className="divide-line divide-y">
              {estado.uniformes.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2">
                  <span
                    className="border-line inline-block h-5 w-5 shrink-0 rounded-full border"
                    style={{
                      background: `linear-gradient(135deg, ${u.cor_primaria} 50%, ${u.cor_secundaria} 50%)`,
                    }}
                  />
                  <span className="font-medium">{u.nome}</span>
                  <span className="text-muted tabular text-sm">{u.ano}</span>
                  {!u.ativo && (
                    <span className="text-muted text-xs uppercase">
                      aposentado
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Secao>
        </div>
      )}
    </main>
  );
}

function Secao({
  titulo,
  contagem,
  children,
}: {
  titulo: string;
  contagem: number;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-condensed text-muted mb-1 text-xl tracking-wide uppercase">
        {titulo} <span className="tabular">({contagem})</span>
      </h2>
      {contagem === 0 ? (
        <p className="text-muted text-sm">Nenhum registro.</p>
      ) : (
        children
      )}
    </section>
  );
}
