import Link from 'next/link'
import { buscarInconsistenciasFerias, type Inconsistencia, type TipoInconsistencia } from '../actions'
import { InconsistenciasExcelButton } from '@/components/ferias/inconsistencias-excel-button'

const TIPO_CONFIG: Record<TipoInconsistencia, { label: string; emoji: string; cor: string; desc: string }> = {
  MULTIPLOS_EM_CURSO: {
    label: 'Múltiplos em Curso',
    emoji: '🔴',
    cor: 'bg-red-100 text-red-700 border border-red-200',
    desc: 'Funcionário com mais de um período com status "Em Curso" ao mesmo tempo — impossível.',
  },
  PA_DUPLICADO: {
    label: 'PA Duplicado',
    emoji: '🟠',
    cor: 'bg-orange-100 text-orange-700 border border-orange-200',
    desc: 'Mesmo número de período aquisitivo registrado mais de uma vez para o mesmo funcionário.',
  },
  PA_CURTO: {
    label: 'PA muito curto',
    emoji: '🟡',
    cor: 'bg-amber-100 text-amber-700 border border-amber-200',
    desc: 'Período aquisitivo com menos de 300 dias — provavelmente as datas de gozo foram usadas no lugar do PA.',
  },
  PA_INVERTIDO: {
    label: 'PA Invertido',
    emoji: '🔵',
    cor: 'bg-blue-100 text-blue-700 border border-blue-200',
    desc: 'A data de início do período aquisitivo é posterior à data de fim.',
  },
}

const ORDEM_SEVERIDADE: TipoInconsistencia[] = ['MULTIPLOS_EM_CURSO', 'PA_DUPLICADO', 'PA_INVERTIDO', 'PA_CURTO']

export default async function InconsistenciasPage() {
  const inconsistencias = await buscarInconsistenciasFerias()

  const porTipo = ORDEM_SEVERIDADE.map(tipo => ({
    tipo,
    cfg: TIPO_CONFIG[tipo],
    itens: inconsistencias.filter(i => i.tipo === tipo),
  })).filter(g => g.itens.length > 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inconsistências de Férias</h1>
          <p className="text-sm text-slate-500">
            Períodos com dados suspeitos que precisam de revisão
          </p>
        </div>
        <div className="flex gap-2">
          {inconsistencias.length > 0 && <InconsistenciasExcelButton dados={inconsistencias} />}
          <Link
            href="/ferias"
            className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            ← Voltar para Férias
          </Link>
        </div>
      </div>

      {inconsistencias.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-10 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-green-800 font-semibold">Nenhuma inconsistência encontrada</p>
          <p className="text-green-700 text-sm mt-1">Todos os períodos de férias estão com dados válidos.</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ORDEM_SEVERIDADE.map(tipo => {
              const cfg   = TIPO_CONFIG[tipo]
              const count = inconsistencias.filter(i => i.tipo === tipo).length
              return (
                <div key={tipo} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="text-2xl font-bold text-slate-900">{count}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{cfg.emoji} {cfg.label}</div>
                </div>
              )
            })}
          </div>

          {/* Grupos por tipo */}
          {porTipo.map(({ tipo, cfg, itens }) => (
            <div key={tipo} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-start gap-3">
                <span className="text-lg shrink-0">{cfg.emoji}</span>
                <div>
                  <h2 className="font-semibold text-slate-900">{cfg.label} <span className="text-slate-400 font-normal">({itens.length})</span></h2>
                  <p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {itens.map((inc, idx) => (
                  <InconsistenciaRow key={idx} inc={inc} cfg={cfg} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function InconsistenciaRow({
  inc,
  cfg,
}: {
  inc: Inconsistencia
  cfg: { label: string; emoji: string; cor: string; desc: string }
}) {
  const searchUrl = `/ferias?busca=${encodeURIComponent(inc.funcionario_nome)}`

  return (
    <div className="px-5 py-3 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-900">{inc.funcionario_nome}</span>
          <span className="text-xs text-slate-400">{inc.funcionario_registro}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cor}`}>
            {cfg.emoji} {cfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{inc.posto_nome} · {inc.secretaria}</p>
        <p className="text-sm text-slate-700 mt-1">{inc.descricao}</p>
      </div>
      <Link
        href={searchUrl}
        className="shrink-0 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
      >
        Ver no sistema
      </Link>
    </div>
  )
}
