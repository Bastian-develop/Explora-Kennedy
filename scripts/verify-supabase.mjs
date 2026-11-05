/**
 * Diagnóstico de solo lectura para la configuración pública de Supabase.
 * Ejecutar desde la raíz con: node scripts/verify-supabase.mjs
 * Nunca imprime las claves ni realiza inserciones, cambios o borrados.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env.local');
let envVars = {};

try {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsAt = trimmed.indexOf('=');
    if (equalsAt > 0) envVars[trimmed.slice(0, equalsAt).trim()] = trimmed.slice(equalsAt + 1).trim();
  }
} catch {
  console.error('No se encontró .env.local. Copia .env.example y agrega las variables del proyecto.');
  process.exit(1);
}

const url = envVars.VITE_SUPABASE_URL;
const anonKey = envVars.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local.');
  process.exit(1);
}

let host = 'URL no válida';
try { host = new URL(url).host; } catch { /* no imprimir el contenido de la variable */ }
console.log(`Proyecto configurado: ${host}`);

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
let failed = false;

const checkReadable = async (table, columns, description) => {
  const { error } = await supabase.from(table).select(columns).limit(1);
  if (error) {
    failed = true;
    console.error(`${description}: no disponible (${error.message})`);
  } else {
    console.log(`${description}: consulta pública correcta.`);
  }
};

await checkReadable('global_state', 'id', 'Lugares');
await checkReadable('comments', 'id', 'Comentarios');
console.log('Administradores: esta verificación pública no consulta ni revela cuentas. Inicia sesión desde la página para validar el acceso administrativo.');
console.log('Diagnóstico finalizado sin escrituras.');
if (failed) process.exitCode = 1;
