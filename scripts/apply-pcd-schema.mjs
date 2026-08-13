// Script temporário para aplicar a migração PCD via Supabase Admin API.
// Uso: node scripts/apply-pcd-schema.mjs
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://fwdhnipekbmeqozkpfyh.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(url, key)

const sql = readFileSync('supabase/migrations/20260813_add_pcd_funcionarios.sql', 'utf8')

const { error } = await supabase.rpc('exec_sql', { sql })
if (error) {
  console.log('RPC falhou (esperado neste projeto):', error.message)
  console.log('\nExecute manualmente no Supabase Studio → SQL Editor:\n')
  console.log(sql)
} else {
  console.log('OK — migração aplicada.')
}
