import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth/get-user'
import { buscarAchados } from './actions'
import type { Achado, Severidade } from './actions'

const SEVERIDADE_CONFIG: Record<Severidade, { label: string; corTopo: string; corBadge: string }> = {
  alta: { label: 'Alta', corTopo: 'border-t-red-500', corBadge: 'bg-red-100 text-red-700' },
  media: { label: 'Média', corTopo: 'border-t-amber-500', corBadge: 'bg-amber-100 text-amber-700' },
  baixa: { label: 'Baixa', corTopo: 'border-t-gray-400', corBadge: 'bg-gray-100 text-gray-600' },
}

const ORDEM: Severidade[] = ['alta', 'media', 'baixa']

function CounterCard({ label, value, topColor }: { label: string; value: number; topColor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function subtitulo(achado: Achado): string | null {
  if (achado.funcionario_nome) {
    return [achado.posto_nome, achado.secretaria].filter(Boolean).join(' · ') || null
  }
  return achado.secretaria || null
}

function AchadoRow({ achado, cfg }: { achado: Achado; cfg: { label: string; corBadge: string } }) {
  const sub = subtitulo(achado)
  return (
    <div className="flex items-start gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{achado.funcionario_nome ?? achado.posto_nome ?? '—'}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.corBadge}`}>
            {cfg.label}
          </span>
        </div>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        <p className="mt-1 text-sm font-medium text-gray-800">{achado.titulo}</p>
        <p className="text-sm text-gray-600">{achado.descricao}</p>
      </div>
      {achado.link && (
        <Link
          href={achado.link}
          className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          Ver no sistema
        </Link>
      )}
    </div>
  )
}

export default async function RevisorOperacionalPage() {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    redirect('/dashboard')
  }

  const achados = await buscarAchados()
  const porSeveridade = ORDEM.map(sev => ({
    sev,
    cfg: SEVERIDADE_CONFIG[sev],
    itens: achados.filter(a => a.severidade === sev),
  })).filter(g => g.itens.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Revisor Operacional</h1>
        <p className="text-sm text-gray-400">Divergências e inconsistências detectadas automaticamente no sistema</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CounterCard label="Total" value={achados.length} topColor="border-t-gray-400" />
        {ORDEM.map(sev => (
          <CounterCard
            key={sev}
            label={SEVERIDADE_CONFIG[sev].label}
            value={achados.filter(a => a.severidade === sev).length}
            topColor={SEVERIDADE_CONFIG[sev].corTopo}
          />
        ))}
      </div>

      {achados.length === 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-10 text-center">
          <p className="mb-2 text-2xl">✅</p>
          <p className="font-semibold text-green-800">Nenhuma divergência encontrada</p>
          <p className="mt-1 text-sm text-green-700">Todas as checagens rodaram limpas.</p>
        </div>
      ) : (
        porSeveridade.map(({ sev, cfg, itens }) => (
          <div key={sev} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">
                Severidade {cfg.label} <span className="font-normal text-gray-400">({itens.length})</span>
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {itens.map((a, idx) => (
                <AchadoRow key={idx} achado={a} cfg={cfg} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
