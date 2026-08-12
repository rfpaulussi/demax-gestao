// Uso:
//   node scripts/check-regime-parity.mjs baseline   -> salva snapshot ANTES da troca
//   node scripts/check-regime-parity.mjs compare     -> recalcula e compara com o snapshot
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SNAPSHOT_PATH = new URL('./.regime-parity-snapshot.json', import.meta.url)

const now = new Date()
const mes = now.getMonth() + 1
const ano = now.getFullYear()
const mesStr = String(mes).padStart(2, '0')
const mesStartStr = `${ano}-${mesStr}-01`
const daysInMonth = new Date(ano, mes, 0).getDate()
const mesEndStr = `${ano}-${mesStr}-${String(daysInMonth).padStart(2, '0')}`

async function regimesAtuais() {
  // Reproduz a mesma resolução de regime que o código de produção usa hoje
  // (posto -> config_escalas_postos), pra comparar com a nova fonte depois.
  const { data: funcionarios, error: e1 } = await supabase
    .from('funcionarios')
    .select('id, posto_id')
    .lte('data_admissao', mesEndStr)
    .or(`data_desligamento.is.null,data_desligamento.gte.${mesStartStr}`)
  if (e1) throw e1

  const { data: postoConfig, error: e2 } = await supabase
    .from('config_escalas_postos')
    .select('posto_id, regime')
  if (e2) throw e2

  const postoConfigMap = new Map(postoConfig.map(pc => [pc.posto_id, pc.regime]))

  const { data: turnos, error: e3 } = await supabase
    .from('horarios_funcionarios')
    .select('funcionario_id, turnos_postos!turno_id ( tipo_escala )')
    .is('data_fim', null)
  if (e3) throw e3
  const turnoRegimeMap = new Map(
    turnos
      .filter(t => t.turnos_postos?.tipo_escala)
      .map(t => [t.funcionario_id, t.turnos_postos.tipo_escala]),
  )

  const resultado = {}
  for (const f of funcionarios) {
    const regimePosto = (f.posto_id && postoConfigMap.get(f.posto_id)) ?? '5x2'
    const regimeTurno = turnoRegimeMap.get(f.id) ?? regimePosto
    resultado[f.id] = { regimePosto, regimeTurno, igual: regimePosto === regimeTurno }
  }
  return resultado
}

const modo = process.argv[2]
const dados = await regimesAtuais()
const divergentes = Object.entries(dados).filter(([, v]) => !v.igual)

console.log(`Funcionários avaliados: ${Object.keys(dados).length}`)
console.log(`Divergentes (regime do turno != regime do posto): ${divergentes.length}`)
if (divergentes.length > 0) {
  console.log('Detalhe dos divergentes:', divergentes)
}

if (modo === 'baseline') {
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(dados, null, 2))
  console.log('Snapshot salvo em scripts/.regime-parity-snapshot.json')
} else if (modo === 'compare') {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error('Nenhum snapshot encontrado. Rode "baseline" antes de trocar o código.')
    process.exit(1)
  }
  const antes = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  let diffs = 0
  for (const [fid, depois] of Object.entries(dados)) {
    const a = antes[fid]
    if (!a) continue
    if (a.regimePosto !== depois.regimePosto) {
      console.log(`DIFF ${fid}: regimePosto ${a.regimePosto} -> ${depois.regimePosto}`)
      diffs++
    }
  }
  console.log(diffs === 0 ? 'OK: nenhuma diferença.' : `${diffs} diferença(s) encontrada(s).`)
} else {
  console.log('Uso: node scripts/check-regime-parity.mjs [baseline|compare]')
}
