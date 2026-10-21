// Aplica (ou desfaz) o plano gerado por planejar.py. Grava no banco de PRODUCAO: use so apos aprovar o dry-run.
//
//   node scripts/ferias-rh/aplicar.mjs plano.json                    # confere o plano contra o banco (nao grava)
//   node scripts/ferias-rh/aplicar.mjs plano.json --apply backup.json  # grava; salva antes/depois em backup.json
//   node scripts/ferias-rh/aplicar.mjs --rollback backup.json          # restaura os valores anteriores e apaga os inseridos
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)

async function emLotes(itens, tam, fn) {
  for (let i = 0; i < itens.length; i += tam) await Promise.all(itens.slice(i, i + tam).map(fn))
}

async function rollback(arq) {
  const bk = JSON.parse(fs.readFileSync(arq, 'utf8'))
  let ok = 0
  await emLotes(bk.antes, 20, async a => {
    const { error } = await sb.from(a.table).update(a.valores).eq('id', a.id)
    if (error) throw new Error(`rollback ${a.table} ${a.id}: ${error.message}`)
    ok++
  })
  const ids = bk.inseridos ?? []
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await sb.from('ferias').delete().in('id', ids.slice(i, i + 100))
    if (error) throw new Error(`rollback delete: ${error.message}`)
  }
  console.log(`Rollback concluido: ${ok} registros restaurados, ${ids.length} inseridos removidos.`)
}

if (args[0] === '--rollback') { await rollback(args[1]); process.exit(0) }

const planoArq = args[0]
const aplicar = args.includes('--apply')
const backupArq = aplicar ? args[args.indexOf('--apply') + 1] : null
if (!planoArq || (aplicar && !backupArq)) { console.error('Uso: ver cabecalho do arquivo'); process.exit(1) }

const plano = JSON.parse(fs.readFileSync(planoArq, 'utf8'))
const hoje = new Date().toISOString().slice(0, 10)
if (aplicar && plano.gerado_em !== hoje) {
  console.error(`Plano gerado em ${plano.gerado_em}, hoje e ${hoje}. Refaca dump + planejar antes de aplicar.`); process.exit(1)
}

const ordem = o => o.ordem ?? 5
const ops = [...plano.ops].sort((a, b) => ordem(a) - ordem(b))
const updates = ops.filter(o => o.op === 'update')
const inserts = ops.filter(o => o.op === 'insert')

// colunas novas precisam existir
const c1 = await sb.from('ferias').select('dias_falta,dias_afastado,obs_rh,rh_atualizado_em').limit(1)
const c2 = await sb.from('funcionarios').select('centro_custo').limit(1)
if (c1.error || c2.error) { console.error('Aplique antes a migracao 20261021_ferias_listagem_rh.sql:', (c1.error ?? c2.error).message); process.exit(1) }

// todos os ids a atualizar existem? guarda o estado anterior apenas das colunas que serao alteradas
const antes = []
for (const tabela of ['ferias', 'funcionarios']) {
  const grupo = updates.filter(o => o.table === tabela)
  const porId = new Map(grupo.map(o => [o.id, o]))
  const ids = [...porId.keys()]
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    const { data, error } = await sb.from(tabela).select('*').in('id', lote)
    if (error) throw new Error(error.message)
    const achados = new Map(data.map(r => [r.id, r]))
    for (const id of lote) {
      const r = achados.get(id)
      if (!r) throw new Error(`${tabela} ${id} nao existe mais; refaca dump + planejar`)
      const valores = {}
      // une as colunas de todas as operacoes sobre o mesmo id
      for (const o of grupo.filter(g => g.id === id)) for (const k of Object.keys(o.set)) valores[k] = r[k] ?? null
      if (!antes.some(a => a.table === tabela && a.id === id)) antes.push({ table: tabela, id, valores })
    }
  }
}
console.log(`Plano: ${updates.length} updates (${antes.length} registros distintos), ${inserts.length} inserts.`)
if (!aplicar) { console.log('Conferencia OK. Nada foi gravado. Use --apply <backup.json> para gravar.'); process.exit(0) }

fs.writeFileSync(backupArq, JSON.stringify({ criado_em: new Date().toISOString(), antes, inseridos: [] }))
console.log('Backup dos valores anteriores salvo em', backupArq)

let feitos = 0
for (const o of updates) {   // sequencial por ordem: updates do mesmo id nao disputam
  const { error } = await sb.from(o.table).update(o.set).eq('id', o.id)
  if (error) { console.error(`FALHOU update ${o.table} ${o.id} (${o.nome}): ${error.message}`); console.error('Rode --rollback para desfazer.'); process.exit(1) }
  feitos++
}
console.log(`${feitos} updates aplicados.`)

const inseridos = []
for (let i = 0; i < inserts.length; i += 100) {
  const lote = inserts.slice(i, i + 100)
  const { data, error } = await sb.from('ferias').insert(lote.map(o => o.row)).select('id')
  if (error) {
    fs.writeFileSync(backupArq, JSON.stringify({ criado_em: new Date().toISOString(), antes, inseridos }))
    console.error('FALHOU insert:', error.message, '- rode --rollback para desfazer o que foi gravado.'); process.exit(1)
  }
  inseridos.push(...data.map(d => d.id))
}
fs.writeFileSync(backupArq, JSON.stringify({ criado_em: new Date().toISOString(), antes, inseridos }))
console.log(`${inseridos.length} PAs inseridos. Backup atualizado: ${backupArq}`)
