// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !chave) {
  throw new Error(
    "Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local"
  );
}

// A chave anon é pública por natureza. Quem protege a escrita é o RLS
// mais os grants, não o sigilo dela. A service_role nunca entra aqui.
export const supabase = createClient(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true },
});
