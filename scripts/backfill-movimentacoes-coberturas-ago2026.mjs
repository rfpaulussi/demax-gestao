// Backfill: reconstrói em `movimentacoes` (tipo='cobertura', campo_alterado='posto_id') as
// mudanças de posto_id que `registrarCobertura`/`encerrarCobertura` fizeram direto na tabela
// `funcionarios` em agosto/2026, sem log — motivo do descompasso entre fechamento e a aba
// Movimentações. Cobre só o mês de agosto/2026 (mesStart/mesEnd usados por calcularFechamento).
// Uso: node scripts/backfill-movimentacoes-coberturas-ago2026.mjs [--apply]
// Sem --apply roda em modo dry-run (só imprime o que seria inserido).

import { createClient } from '@supabase/supabase-js'

const url = 'https://fwdhnipekbmeqozkpfyh.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY não definida'); process.exit(1) }

const supabase = createClient(url, key)

const MES_INICIO = '2026-08-01'
const MES_FIM    = '2026-08-31'
const APPLY = process.argv.includes('--apply')

function dentroDoMes(dataStr) {
  return !!dataStr && dataStr >= MES_INICIO && dataStr <= MES_FIM
}

async function jaExiste(funcionarioId, dataStr, valorDepois) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .eq('tipo', 'cobertura')
    .eq('campo_alterado', 'posto_id')
    .eq('valor_depois', valorDepois)
    .gte('created_at', `${dataStr}T00:00:00`)
    .lte('created_at', `${dataStr}T23:59:59`)
    .maybeSingle()
  if (error) throw error
  return !!data
}

async function main() {
  const { data: coberturas, error } = await supabase
    .from('coberturas_temporarias')
    .select('id, funcionario_id, posto_origem_id, posto_destino_id, data_inicio, data_retorno_real, supervisor_origem_id')
    .lte('data_inicio', MES_FIM)
    .or(`data_retorno_real.is.null,data_retorno_real.gte.${MES_INICIO}`)

  if (error) throw error

  const inserts = []

  for (const c of coberturas ?? []) {
    if (c.posto_origem_id === c.posto_destino_id) continue // sem mudança real de posto
    if (dentroDoMes(c.data_inicio)) {
      inserts.push({
        funcionario_id: c.funcionario_id,
        tipo: 'cobertura',
        campo_alterado: 'posto_id',
        valor_antes: c.posto_origem_id,
        valor_depois: c.posto_destino_id,
        executado_por: c.supervisor_origem_id,
        created_at: `${c.data_inicio}T09:00:00-03:00`,
        _dataStr: c.data_inicio,
      })
    }
    if (dentroDoMes(c.data_retorno_real)) {
      inserts.push({
        funcionario_id: c.funcionario_id,
        tipo: 'cobertura',
        campo_alterado: 'posto_id',
        valor_antes: c.posto_destino_id,
        valor_depois: c.posto_origem_id,
        executado_por: null,
        created_at: `${c.data_retorno_real}T18:00:00-03:00`,
        _dataStr: c.data_retorno_real,
      })
    }
  }

  console.log(`Coberturas encontradas: ${coberturas?.length ?? 0}`)
  console.log(`Movimentações candidatas a inserir: ${inserts.length}`)

  let inseridos = 0, pulados = 0
  for (const ins of inserts) {
    const existe = await jaExiste(ins.funcionario_id, ins._dataStr, ins.valor_depois)
    if (existe) { pulados++; continue }

    const row = {
      funcionario_id: ins.funcionario_id,
      tipo: ins.tipo,
      campo_alterado: ins.campo_alterado,
      valor_antes: ins.valor_antes,
      valor_depois: ins.valor_depois,
      executado_por: ins.executado_por,
      created_at: ins.created_at,
    }

    if (!APPLY) {
      console.log('[dry-run] inseriria:', row)
      inseridos++
      continue
    }

    const { error: errInsert } = await supabase.from('movimentacoes').insert(row)
    if (errInsert) {
      console.error('Falha ao inserir', row, errInsert.message)
    } else {
      inseridos++
    }
  }

  console.log(`\n${APPLY ? 'Inseridos' : '[dry-run] Seriam inseridos'}: ${inseridos} | Já existiam (pulados): ${pulados}`)
  if (!APPLY) console.log('Rode com --apply pra gravar de verdade.')
}

main().catch(err => { console.error(err); process.exit(1) })
