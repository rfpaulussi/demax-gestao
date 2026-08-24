import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { BackButton } from '@/components/ui/back-button'
import { AnaliseGeralClient } from '@/components/relatorios/analise-geral-client'

export default async function AnaliseGeralPage() {
  const userCtx = await getUser()
  if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Análise Geral</h1>
        <p className="text-sm text-gray-400">
          Relatório consolidado em Markdown — atestados, faltas, mudanças de função, coberturas
          insalubres, efetivo x postos e advertências, com prompt de análise já embutido.
        </p>
      </div>

      <AnaliseGeralClient />
    </div>
  )
}
