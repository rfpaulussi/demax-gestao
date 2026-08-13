// Script one-off: marca pcd=true / pcd_tipo=<tipo> nos 68 funcionários da planilha
// "ATIVOS MOGI 10-08-2026_PCD.xlsx", casando por funcionarios.registro = CODIGO.
// Uso: node --env-file=.env.local scripts/import-pcd.mjs
import { createClient } from '@supabase/supabase-js'

const url = 'https://fwdhnipekbmeqozkpfyh.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, key)

// [registro, tipo] — extraído de ATIVOS MOGI 10-08-2026_PCD.xlsx, aba LISTAGEM
const PARES = [
  ['100834', 'Visual'],
  ['100713', 'Visual'],
  ['102689', 'Visual'],
  ['104386', 'Visual'],
  ['103870', 'Visual'],
  ['99551', 'Visual'],
  ['100543', 'Visual'],
  ['91993', 'Visual'],
  ['109087', 'Visual'],
  ['108583', 'Visual'],
  ['99766', 'Visual'],
  ['99119', 'Visual'],
  ['98596', 'Visual'],
  ['97910', 'Visual'],
  ['98282', 'Visual'],
  ['100987', 'Visual'],
  ['97431', 'Intelectual'],
  ['97441', 'Intelectual'],
  ['97374', 'Intelectual'],
  ['106568', 'Intelectual'],
  ['97432', 'Intelectual'],
  ['106449', 'Intelectual'],
  ['103878', 'Intelectual'],
  ['98978', 'Intelectual'],
  ['108877', 'Intelectual'],
  ['103179', 'Física'],
  ['97907', 'Física'],
  ['103742', 'Física'],
  ['103680', 'Física'],
  ['97468', 'Física'],
  ['103665', 'Física'],
  ['97905', 'Física'],
  ['98580', 'Física'],
  ['97909', 'Física'],
  ['97646', 'Física'],
  ['98281', 'Física'],
  ['104915', 'Física'],
  ['99888', 'Física'],
  ['79247', 'Física'],
  ['97555', 'Física'],
  ['100268', 'Física'],
  ['104071', 'Física'],
  ['105074', 'Física'],
  ['100053', 'Física'],
  ['105783', 'Física'],
  ['104021', 'Física'],
  ['109135', 'Física'],
  ['100061', 'Física'],
  ['104686', 'Física'],
  ['103170', 'Física'],
  ['97553', 'Física'],
  ['97693', 'Auditiva'],
  ['104326', 'Auditiva'],
  ['107900', 'Auditiva'],
  ['103037', 'Auditiva'],
  ['98533', 'Auditiva'],
  ['103287', 'Auditiva'],
  ['102968', 'Auditiva'],
  ['107462', 'Auditiva'],
  ['100511', 'Auditiva'],
  ['98280', 'Auditiva'],
  ['97491', 'Auditiva'],
  ['105045', 'Auditiva'],
  ['85381', 'Auditiva'],
  ['97380', 'Auditiva'],
  ['104292', 'Auditiva'],
  ['103854', 'Auditiva'],
  ['99926', 'Auditiva'],
]

const registros = PARES.map(([r]) => r)
const { data: antes, error: erroSelect } = await supabase
  .from('funcionarios')
  .select('id, registro, nome, status')
  .in('registro', registros)

if (erroSelect) { console.error('Erro ao buscar:', erroSelect.message); process.exit(1) }

const encontrados = new Set(antes.map(f => f.registro))
const naoEncontrados = registros.filter(r => !encontrados.has(r))
if (naoEncontrados.length > 0) {
  console.warn('ATENÇÃO — registros sem match no banco (não atualizados):', naoEncontrados)
}

let ok = 0, falhas = 0
for (const [registro, tipo] of PARES) {
  const alvo = antes.find(f => f.registro === registro)
  if (!alvo) continue
  const { error } = await supabase
    .from('funcionarios')
    .update({ pcd: true, pcd_tipo: tipo, pcd_tipo_outro: null })
    .eq('id', alvo.id)
  if (error) {
    console.error(`FALHA registro=${registro} nome=${alvo.nome}:`, error.message)
    falhas++
  } else {
    ok++
  }
}

console.log(`Concluído: ${ok} atualizados, ${falhas} falhas, ${naoEncontrados.length} sem match.`)
