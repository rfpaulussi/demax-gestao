import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// Termos da Geocoding API do Google: lat/lng e endereço devolvidos só podem ficar em cache por até 30 dias.
// Apaga as sugestões vencidas (geo_google_*). O place_id e o hash do endereço ficam; o ponto oficial nunca é tocado.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as unknown as { from: (t: string) => any }
  const { data, error } = await db
    .from('postos')
    .update({
      geo_google_lat: null,
      geo_google_lng: null,
      geo_google_endereco: null,
      geo_google_tipo: null,
      geo_google_parcial: null,
      geo_google_em: null,
      geo_google_expira_em: null,
    })
    .lt('geo_google_expira_em', new Date().toISOString())
    .select('id')
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, expiradas: (data ?? []).length })
}
