// scripts/validar-absenteismo.ts
// Somente leitura. Uso (na raiz do projeto): npx --yes tsx scripts/validar-absenteismo.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { carregarDados } from '../lib/absenteismo/carregar'
import { calcularPeriodo } from '../lib/absenteismo/calculo'
import { calcularKpis } from '../lib/absenteismo/kpis'
import { periodoDoMes } from '../lib/absenteismo/datas'
import { quadroNoDia } from '../lib/absenteismo/quadro'
import { calcularSerieMensal, mesesAte, periodoEfetivo } from '../lib/absenteismo/series'
import { DADOS_DESDE } from '../lib/absenteismo/constantes'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const supabase = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const LIMITE_QUADRO = 0.02 // 2%, medido em 2026-11-19 (máx. 1,63%)

async function main() {
  const hoje = new Date().toISOString().slice(0, 10)
  const [ano, mes] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))]
  const meses = mesesAte(ano, mes, 6)
  const primeiro = periodoDoMes(meses[0].ano, meses[0].mes).inicio
  const janelaIni = primeiro < DADOS_DESDE ? primeiro : DADOS_DESDE

  const dados = await carregarDados(supabase, { inicio: janelaIni, fim: hoje })
  console.log(`\nFuncionários carregados: ${dados.funcionarios.length} | faltas ${dados.faltas.length} | atestados ${dados.atestados.length} | afastamentos ${dados.afastamentos.length} | férias ${dados.ferias.length} | suspensões ${dados.suspensoes.length}`)

  // 1) quadro reconstruído x snapshots_diarios
  const { data: snaps, error } = await supabase
    .from('snapshots_diarios')
    .select('data, ativos, afastados, em_ferias')
    .order('data')
  if (error) throw new Error(error.message)
  let maxRel = 0
  let pior = ''
  for (const s of snaps ?? []) {
    const esperado = s.ativos + s.afastados + s.em_ferias
    const calc = quadroNoDia(dados.funcionarios, s.data)
    const rel = esperado > 0 ? Math.abs(calc - esperado) / esperado : 0
    if (rel > maxRel) { maxRel = rel; pior = `${s.data}: motor ${calc} x snapshot ${esperado}` }
  }
  console.log(`\nQuadro x snapshots (${snaps?.length ?? 0} dias): diferença relativa máxima ${(maxRel * 100).toFixed(2)}% (${pior}) — limite ${(LIMITE_QUADRO * 100).toFixed(0)}%`)

  // 2) mês corrente (até hoje) e mês anterior
  const cheio = periodoDoMes(ano, mes)
  const atual = periodoEfetivo(cheio.inicio, cheio.fim, DADOS_DESDE, hoje)
  if (atual) {
    const r = calcularPeriodo({ ...dados, inicio: atual.inicio, fim: atual.fim })
    const k = calcularKpis(r)
    console.log(`\nPeríodo ${atual.inicio} a ${atual.fim}${atual.parcial ? ' (parcial)' : ''}`)
    console.log(`  quadro médio ${k.quadro_medio.toFixed(1)} | jornadas programadas ${r.jornadas_programadas} | perdidas ${r.jornadas_perdidas}`)
    console.log(`  taxa ${k.taxa.toFixed(2)}% | episódios ${k.episodios} | afetados ${k.funcionarios_afetados} | IF ${k.indice_frequencia.toFixed(1)} | IG ${k.indice_gravidade.toFixed(1)} | duração média ${k.duracao_media.toFixed(1)} | reincidência ${k.taxa_reincidencia.toFixed(1)}%`)
    console.log('  perdidas por classe', r.perdidas_por_classe, '| episódios por classe', r.episodios_por_classe)
    console.log('  disponibilidade (dias corridos-pessoa)', r.disponibilidade_dias, '| suspensão (jornadas)', r.suspensao_jornadas)
    console.log(`  episódios com 0 jornadas (dia fora da escala): ${r.episodios.filter(e => e.jornadas === 0).length} | faltas pendentes de confirmação: ${r.episodios.filter(e => e.confirmada === false).length}`)
  }

  // 3) série dos últimos 6 meses
  console.log('\nSérie mensal:')
  for (const p of calcularSerieMensal(dados, meses, DADOS_DESDE, hoje)) {
    console.log(`  ${p.mes}  taxa ${p.taxa === null ? '—' : p.taxa.toFixed(2) + '%'}  perdidas ${p.jornadas_perdidas}  episódios ${p.episodios}${p.parcial ? '  (parcial)' : ''}`)
  }

  if (maxRel > LIMITE_QUADRO) {
    console.error(`\nFALHA: quadro reconstruído excede ${(LIMITE_QUADRO * 100).toFixed(0)}% — investigar antes de seguir.`)
    process.exit(1)
  }
  console.log('\nOK: quadro dentro do limite.')
}

main().catch(e => { console.error(e); process.exit(1) })
