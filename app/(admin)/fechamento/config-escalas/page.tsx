import { createClient } from '@/lib/supabase/server'
import { ConfigEscalasClient } from '@/components/fechamento/config-escalas-client'

const CONTRATO_ID = 'c73a81ae-0104-4c05-b7d6-e6266f6be1b2'

export interface PostoEscala {
  id: string
  nome: string
  secretaria: string | null
  regime: string
}

export default async function ConfigEscalasPage() {
  const supabase = createClient()

  const [{ data: postos }, { data: escalas }] = await Promise.all([
    supabase
      .from('postos')
      .select('id, nome, secretaria')
      .eq('contrato_id', CONTRATO_ID)
      .eq('ativo', true)
      .order('secretaria', { ascending: true })
      .order('nome',       { ascending: true }),
    supabase
      .from('config_escalas_postos')
      .select('posto_id, regime'),
  ])

  const escalaMap = Object.fromEntries(
    (escalas ?? []).map(e => [e.posto_id, e.regime])
  )

  const data: PostoEscala[] = (postos ?? []).map(p => ({
    id:         p.id,
    nome:       p.nome,
    secretaria: p.secretaria ?? null,
    regime:     escalaMap[p.id] ?? '5x2',
  }))

  const secretarias = Array.from(
    new Set(data.map(p => p.secretaria).filter((s): s is string => Boolean(s)))
  ).sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Configuração de Escalas</h1>
        <p className="text-sm text-gray-400">Regime de trabalho por posto</p>
      </div>

      <ConfigEscalasClient postos={data} secretarias={secretarias} />
    </div>
  )
}
