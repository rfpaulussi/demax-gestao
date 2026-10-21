// Leitura somente-leitura do estado atual (funcionarios, ferias, postos, funcoes) para o planejador.
// Uso: node scripts/ferias-rh/dump-db.mjs <saida.json>
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function all(table, sel) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(sel).order('id').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const saida = process.argv[2]
if (!saida) { console.error('Uso: node scripts/ferias-rh/dump-db.mjs <saida.json>'); process.exit(1) }

const func = await all('funcionarios', 'id,nome,registro,status,data_admissao,funcao_id,posto_id')
const ferias = await all('ferias', '*')
const postos = await all('postos', 'id,nome,secretaria')
const funcoes = await all('funcoes', 'id,nome')
const csp = await sb.from('config_supervisores_postos').select('posto_id,ativo,perfis!config_supervisores_postos_supervisor_id_fkey(nome)').eq('ativo', true)
const sup = (csp.data ?? []).map(c => ({ posto_id: c.posto_id, sup: c.perfis?.nome }))
const cols = { ferias_dias_falta: !(await sb.from('ferias').select('dias_falta').limit(1)).error,
               func_centro_custo: !(await sb.from('funcionarios').select('centro_custo').limit(1)).error }
fs.writeFileSync(saida, JSON.stringify({ func, ferias, postos, funcoes, sup, cols, gerado_em: new Date().toISOString() }))
console.log({ func: func.length, ferias: ferias.length, postos: postos.length, colunas_novas_existem: cols })
