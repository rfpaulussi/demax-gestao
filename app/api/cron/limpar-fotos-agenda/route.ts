import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const BUCKET = 'agenda-checkins'
const RETENCAO_DIAS = 90

// Retenção das fotos de check-in da agenda: apaga do Storage e limpa foto_path após 90 dias.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as unknown as { from: (t: string) => any }
  const limite = new Date(Date.now() - RETENCAO_DIAS * 86_400_000).toISOString()

  const { data, error } = await db
    .from('agenda_checkins')
    .select('id, foto_path')
    .not('foto_path', 'is', null)
    .lt('created_at', limite)
    .limit(500)
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 })

  const itens = (data ?? []) as { id: string; foto_path: string }[]
  if (itens.length === 0) return NextResponse.json({ ok: true, apagadas: 0 })

  const { error: rmErr } = await admin.storage.from(BUCKET).remove(itens.map(i => i.foto_path))
  if (rmErr) return NextResponse.json({ ok: false, erro: rmErr.message }, { status: 500 })

  const { error: upErr } = await db
    .from('agenda_checkins')
    .update({ foto_path: null })
    .in('id', itens.map(i => i.id))
  if (upErr) return NextResponse.json({ ok: false, erro: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, apagadas: itens.length })
}
