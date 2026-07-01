import { listarAcordos, buscarPostosParaAcordo } from './actions'
import { AcordosClient } from '@/components/acordos/acordos-client'

export default async function AcordosPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const agora = new Date()
  const mes = searchParams.mes ? Number(searchParams.mes) : agora.getMonth() + 1
  const ano = searchParams.ano ? Number(searchParams.ano) : agora.getFullYear()

  const [acordos, postos] = await Promise.all([
    listarAcordos({ mes, ano }),
    buscarPostosParaAcordo(),
  ])

  // Anos disponíveis: de 2024 até este ano + 1
  const anoAtual = agora.getFullYear()
  const anos = Array.from({ length: anoAtual - 2023 }, (_, i) => 2024 + i)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Acordos de Compensação</h1>
        <p className="text-sm text-gray-400">Termos de compensação de horas — geração e arquivo</p>
      </div>

      {/* Banner instrutivo */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚖️</span>
          <div>
            <p className="text-sm font-bold text-amber-900">Como funciona o Acordo de Compensação?</p>
            <p className="mt-1 text-sm text-amber-800">
              Quando os funcionários trabalham em eventos fora do horário normal — festas juninas, Dia das Mães,
              Dia dos Pais, sábados ou feriados — esse tempo precisa ser formalizado para evitar pedidos de
              hora extra e ações trabalhistas. O acordo registra a concordância e define como as horas serão devolvidas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
          <div className="rounded-xl bg-white border border-amber-100 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">① Evento</p>
            <p className="text-xs text-gray-600">
              Anote a data em que os funcionários trabalharam além do horário (ex: sábado da Festa Junina).
            </p>
          </div>
          <div className="rounded-xl bg-white border border-amber-100 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">② Compensação</p>
            <p className="text-xs text-gray-600">
              Defina como as horas serão devolvidas — geralmente acrescendo minutos por dia nos dias úteis seguintes.
              Ex: 2h extras = +1h/dia em 2 dias.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-amber-100 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">③ Assinatura</p>
            <p className="text-xs text-gray-600">
              O PDF gerado já traz o texto jurídico completo com campos de assinatura individual para cada funcionário.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-amber-900/10 border border-amber-200 px-4 py-2.5">
          <p className="text-xs font-semibold text-amber-800 mb-0.5">Exemplo de preenchimento:</p>
          <p className="font-mono text-xs text-amber-700">
            &ldquo;…trabalharem no dia <strong>28/06/2026 (Festa Junina)</strong>, com acréscimo de <strong>01:00h</strong> diária nos dias <strong>30/06 e 01/07</strong>, compensando <strong>02 horas</strong> laboradas no evento.&rdquo;
          </p>
        </div>
      </div>

      <AcordosClient acordos={acordos} postos={postos} mes={mes} ano={ano} anos={anos} />
    </div>
  )
}
