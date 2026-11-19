// app/(admin)/relatorios/absenteismo/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarraFiltros } from '@/components/absenteismo/barra-filtros'
import { VisaoExecutivaView } from '@/components/absenteismo/visao-executiva'
import { BackButton } from '@/components/ui/back-button'
import { MESES_PT } from '@/lib/absenteismo/constantes'
import { carregarVisao } from '@/lib/absenteismo/carregar-visao'
import { hojeBrasilia } from '@/lib/absenteismo/hoje'
import { anosDisponiveis, lerParametros } from '@/lib/absenteismo/parametros'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AbsenteismoPage({
  searchParams,
}: {
  searchParams: { [chave: string]: string | string[] | undefined }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') redirect('/dashboard')

  const hoje = hojeBrasilia()
  const params = lerParametros(searchParams, hoje)
  const visao = await carregarVisao(createClient(), params.filtros, params.ano, params.mes, hoje)

  return (
    <div className="space-y-5">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Absenteísmo</h1>
          <p className="text-sm text-gray-400">
            Ausências não programadas (faltas e atestados) — {MESES_PT[params.mes]} {params.ano}
          </p>
        </div>
        <Link href="/relatorios/absenteismo/legado" className="text-xs font-medium text-gray-400 underline hover:text-gray-700">
          Relatório antigo (tabelas e exportação)
        </Link>
      </div>

      <BarraFiltros params={params} opcoes={visao.opcoes} anos={anosDisponiveis(hoje)} />
      <VisaoExecutivaView visao={visao} params={params} />
    </div>
  )
}
