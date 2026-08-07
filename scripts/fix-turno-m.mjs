// Corrige saída do "Turno 7h (m)" de 17:00 para 16:48 em todos os postos.
// Uso: node scripts/fix-turno-m.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const dryRun = process.argv.includes('--dry-run')

const { data: turnos, error } = await supabase
  .from('turnos_postos')
  .select('id, nome, posto_id, hora_entrada, hora_inicio_almoco, hora_fim_almoco, hora_saida_seg_qui, hora_saida_sex, ativo')
  .eq('nome', 'Turno 7h (m)')

if (error) { console.error(error); process.exit(1) }

console.log(`Encontrados ${turnos.length} registros "Turno 7h (m)":`)
for (const t of turnos) console.log(t)

const idsParaCorrigir = turnos
  .filter(t => t.hora_saida_seg_qui !== '16:48' || t.hora_saida_sex !== '16:48')
  .map(t => t.id)

console.log(`\n${idsParaCorrigir.length} registro(s) com saída errada.`)

if (idsParaCorrigir.length === 0) {
  console.log('Nada a corrigir.')
  process.exit(0)
}

if (dryRun) {
  console.log('--dry-run: nenhuma alteração feita.')
  process.exit(0)
}

const { error: updErr, data: updated } = await supabase
  .from('turnos_postos')
  .update({ hora_saida_seg_qui: '16:48', hora_saida_sex: '16:48' })
  .in('id', idsParaCorrigir)
  .select('id, nome, posto_id')

if (updErr) { console.error(updErr); process.exit(1) }
console.log('Atualizados:', updated)

// Quantos funcionários vinculados a esses turnos (vigentes, sem data_fim)
const { data: vinculos, error: vErr } = await supabase
  .from('horarios_funcionarios')
  .select('id, funcionario_id, turno_id')
  .in('turno_id', idsParaCorrigir)
  .is('data_fim', null)

if (vErr) { console.error(vErr); process.exit(1) }
console.log(`\n${vinculos.length} funcionário(s) vigente(s) usando esse(s) turno(s) — já corrigidos automaticamente (turno_id referencia turnos_postos).`)
