import { useState } from "react";
import { entrar } from "../lib/dados";

/**
 * Login do administrador. O grupo nunca vê esta tela — lê tudo sem conta.
 * Só existe para liberar escrita, que o RLS restringe a quem está na
 * tabela `administrador`.
 */
export default function Entrar({
  aoEntrar,
  aoCancelar,
}: {
  aoEntrar: () => void;
  aoCancelar: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      aoEntrar();
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
      <h2 className="font-condensed text-lg tracking-wide uppercase">
        Entrar como administrador
      </h2>

      <Campo
        rotulo="Email"
        tipo="email"
        valor={email}
        aoMudar={setEmail}
        autoComplete="username"
      />
      <Campo
        rotulo="Senha"
        tipo="password"
        valor={senha}
        aoMudar={setSenha}
        autoComplete="current-password"
      />

      {erro && <p className="text-alert text-sm">{erro}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={enviando || !email || !senha}
          className="bg-gold text-pitch rounded px-4 py-2 font-semibold disabled:opacity-40"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          className="text-muted px-4 py-2"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({
  rotulo,
  tipo,
  valor,
  aoMudar,
  autoComplete,
}: {
  rotulo: string;
  tipo: string;
  valor: string;
  aoMudar: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-muted mb-1 block text-sm">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        autoComplete={autoComplete}
        onChange={(e) => aoMudar(e.target.value)}
        className="bg-surface2 border-line text-chalk w-full rounded border px-3 py-2"
      />
    </label>
  );
}
