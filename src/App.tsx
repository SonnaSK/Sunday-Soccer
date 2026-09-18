import { useCallback, useEffect, useState } from "react";
import { usuarioAtual, ehAdministrador, sair } from "./lib/dados";
import Elenco from "./paginas/Elenco";
import Entrar from "./paginas/Entrar";
import Rodadas from "./paginas/Rodadas";

type Sessao = {
  logado: boolean;
  admin: boolean;
  email: string | null;
};

type Aba = "elenco" | "rodadas";

export default function App() {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [aba, setAba] = useState<Aba>("elenco");

  const conferir = useCallback(async () => {
    const usuario = await usuarioAtual();
    setSessao({
      logado: !!usuario,
      admin: usuario ? await ehAdministrador() : false,
      email: usuario?.email ?? null,
    });
  }, []);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  const admin = sessao?.admin ?? false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="border-line mb-6 flex items-baseline justify-between gap-3 border-b pb-3">
        <h1 className="font-condensed text-3xl font-bold tracking-wide uppercase">
          Domingo
        </h1>

        {sessao && (
          <div className="text-right">
            {sessao.logado ? (
              <button
                onClick={async () => {
                  await sair();
                  await conferir();
                }}
                className="text-muted text-sm underline"
              >
                Sair
              </button>
            ) : (
              <button
                onClick={() => setMostrarLogin((v) => !v)}
                className="text-muted text-sm underline"
              >
                {mostrarLogin ? "Fechar" : "Entrar"}
              </button>
            )}
          </div>
        )}
      </header>

      {mostrarLogin && !sessao?.logado && (
        <div className="mb-6">
          <Entrar
            aoEntrar={async () => {
              setMostrarLogin(false);
              await conferir();
            }}
            aoCancelar={() => setMostrarLogin(false)}
          />
        </div>
      )}

      {/* O erro que o 03-DESENVOLVIMENTO.md avisa: o login funciona, mas
          sem linha em `administrador` o RLS recusa toda escrita. Sem este
          aviso o sintoma seria um botão que falha sem explicação. */}
      {sessao?.logado && !sessao.admin && (
        <div className="border-alert bg-surface text-alert mb-6 rounded-lg border p-3 text-sm">
          <p className="mb-1 font-semibold">
            Você entrou, mas não é administrador deste horário.
          </p>
          <p className="text-muted">
            Falta registrar {sessao.email} na tabela <code>administrador</code>.
            O passo está no <code>03-DESENVOLVIMENTO.md</code>, seção Supabase.
            Até lá, a escrita fica bloqueada pelo RLS.
          </p>
        </div>
      )}

      <nav className="mb-6 flex gap-2">
        {(["elenco", "rodadas"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`font-condensed rounded px-4 py-1.5 tracking-wide uppercase ${
              aba === a
                ? "bg-gold text-pitch font-semibold"
                : "border-line text-muted border"
            }`}
          >
            {a}
          </button>
        ))}
      </nav>

      {aba === "elenco" ? <Elenco admin={admin} /> : <Rodadas admin={admin} />}

      {sessao && !sessao.logado && (
        <p className="text-muted mt-10 text-sm">
          Somente leitura. Entre como administrador para editar.
        </p>
      )}
    </div>
  );
}
