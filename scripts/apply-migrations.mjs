// Script temporário para aplicar migrations via Supabase Admin API
// Uso: node scripts/apply-migrations.mjs

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const url  = 'https://fwdhnipekbmeqozkpfyh.supabase.co'
const key  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3ZGhuaXBla2JtZXFvemtwZnloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA1ODc4MiwiZXhwIjoyMDk1NjM0NzgyfQ.bxsLPe9ZVwda-uzzbIetRoiWPjVxY90RS0Ca43kHdxc'

const supabase = createClient(url, key)

const sqls = [
  `ALTER TABLE acordos_compensacao ADD COLUMN IF NOT EXISTS subtipo text CHECK (subtipo IN ('evento', 'antecipado'));`,
  `ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS lida_supervisor boolean NOT NULL DEFAULT false;`,
]

for (const sql of sqls) {
  console.log('Executando:', sql.slice(0, 60) + '...')
  const { error } = await supabase.rpc('exec_sql', { sql })
  if (error) {
    // RPC não existe — tenta via query direto
    console.log('RPC falhou:', error.message)
    console.log('Execute manualmente no Supabase Studio (SQL Editor):')
    console.log(sql)
  } else {
    console.log('OK')
  }
}
