// components/auditoria-atestados/tabela-resultado.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx-js-style'
import { cn } from '@/lib/utils'
import { extrairRegistroDeMatricula, extrairCodigoCid, motivoIndicaOcupacional, classificarCid, fimSesmt, LABEL_CATEGORIA_CID, type CategoriaCid } from '@/lib/auditoria-atestados/parse'
import { ModalLancarAtestado } from './modal-lancar-atestado'
import { ModalSolicitarCorrecao } from './modal-solicitar-correcao'
import { rankearCandidatos, consecutivosCobremSesmt } from '@/lib/auditoria-atestados/candidatos'
import type { ResultadoAuditoria, LinhaResultado, CampoDivergente, LinhaSesmt } from '@/lib/auditoria-atestados/tipos'

const LABEL_STATUS: Record<LinhaResultado['status'], string> = {
  confere: 'Confere',
  divergencia: 'Divergência',
  nao_lancado: 'Não lançado no sistema',
  matricula_nao_encontrada: 'Matrícula não encontrada',
  ambiguo: 'Ambíguo',
  sem_sesmt: 'Sem registro no SESMT',
}

function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Último dia afastado segundo o SESMT (mesmo critério do `Fim` do sistema). */
function fimSesmtBr(s: LinhaSesmt): string {
  const fim = fimSesmt(s.diasTexto, s.dataRetorno)
  return fim ? formatarDataBr(fim) : `Em aberto (${s.diasTexto} dias)`
}

function categoriaCidDaLinha(l: Extract<LinhaResultado, { status: 'divergencia' }>): CategoriaCid | null {
  if (!l.camposDivergentes.includes('cid')) return null
  return classificarCid(extrairCodigoCid(l.sesmt.cidTexto), l.sistema.cidCodigo)
}

function registroDaMatricula(matriculaRaw: string): string {
  return extrairRegistroDeMatricula(matriculaRaw) ?? matriculaRaw
}

function CardContador({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={cn('rounded-xl border border-t-4 border-gray-100 bg-white p-4 shadow-sm', cor)}>
      <p className="text-xl font-black tracking-tight text-gray-900">{valor}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function CelulaComparada({ sesmt, sistema, divergente, nota }: { sesmt: string; sistema: string; divergente: boolean; nota?: string }) {
  return (
    <td className={cn('px-3 py-2 text-sm', divergente ? 'bg-red-50' : '')}>
      <div className="text-gray-500">SESMT: {sesmt}</div>
      <div className={cn(divergente ? 'font-semibold text-red-700' : 'text-gray-700')}>Sistema: {sistema}</div>
      {nota && <div className="mt-0.5 text-[11px] font-medium text-red-500">{nota}</div>}
    </td>
  )
}

function LinhaConfereOuDivergencia({ l, onCorrigir, enviado }: { l: Extract<LinhaResultado, { status: 'confere' | 'divergencia' }>; onCorrigir?: () => void; enviado?: boolean }) {
  const divergentes: CampoDivergente[] = l.status === 'divergencia' ? l.camposDivergentes : []
  const categoriaCid = l.status === 'divergencia' ? categoriaCidDaLinha(l) : null
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{registroDaMatricula(l.sesmt.matriculaRaw)}</td>
      <CelulaComparada
        sesmt={formatarDataBr(l.sesmt.dataInicio)}
        sistema={formatarDataBr(l.sistema.dataInicio)}
        divergente={divergentes.includes('data_inicio')}
        nota={l.status === 'divergencia' && l.porProximidade ? 'Pareado por data próxima' : undefined}
      />
      <CelulaComparada
        sesmt={fimSesmtBr(l.sesmt)}
        sistema={formatarDataBr(l.sistema.dataFim)}
        divergente={divergentes.includes('data_fim')}
      />
      <CelulaComparada
        sesmt={l.sesmt.cidTexto}
        sistema={l.sistema.cidCodigo ?? 'Sem CID'}
        divergente={divergentes.includes('cid')}
        nota={categoriaCid && categoriaCid !== 'igual' ? LABEL_CATEGORIA_CID[categoriaCid] : undefined}
      />
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('origem_ocupacional') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.motivo}
      </td>
      <td className="space-y-1 px-3 py-2 text-sm">
        <Link
          href={`/atestados?busca=${encodeURIComponent(l.sesmt.nome)}`}
          target="_blank"
          className="block font-medium text-blue-600 hover:underline"
        >
          Ver no sistema
        </Link>
        {l.status === 'divergencia' && onCorrigir && (
          enviado ? (
            <span className="block text-xs font-medium text-green-600">✓ Enviado p/ aprovação</span>
          ) : (
            <button type="button" onClick={onCorrigir} className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
              Solicitar correção
            </button>
          )
        )}
      </td>
    </tr>
  )
}

function BlocoAmbiguo({ l }: { l: Extract<LinhaResultado, { status: 'ambiguo' }> }) {
  const candidatos = rankearCandidatos(l.sesmt, l.candidatos)
  const cidSesmt = extrairCodigoCid(l.sesmt.cidTexto)
  const unificado = consecutivosCobremSesmt(l.sesmt, l.candidatos)
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-gray-900">{l.sesmt.nome}</span>
        <span className="text-gray-500">Matrícula {registroDaMatricula(l.sesmt.matriculaRaw)}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          SESMT: {formatarDataBr(l.sesmt.dataInicio)} → {fimSesmtBr(l.sesmt)} · CID {cidSesmt ?? 'Sem CID'}
          {motivoIndicaOcupacional(l.sesmt.motivo) ? ' · Ocupacional' : ''}
        </span>
      </div>
      {unificado && (
        <p className="mb-2 rounded bg-green-50 px-3 py-1.5 text-xs text-green-800">
          Os atestados do sistema são consecutivos e cobrem todo o período do SESMT (o SESMT unificou em uma linha). Não é duplicidade — só confira CID e datas.
        </p>
      )}
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
            <th className="px-3 py-1">Atestado no sistema</th>
            <th className="px-3 py-1">Início</th>
            <th className="px-3 py-1">Fim</th>
            <th className="px-3 py-1">CID</th>
            <th className="px-3 py-1">Situação</th>
            <th className="px-3 py-1">Ação</th>
          </tr>
        </thead>
        <tbody>
          {candidatos.map((c, i) => (
            <tr key={c.atestado.id} className={cn('border-t border-gray-100 text-sm', c.maisProvavel ? 'bg-green-50' : '')}>
              <td className="px-3 py-2 text-gray-600">#{i + 1}</td>
              <td className="px-3 py-2 text-gray-700">
                {formatarDataBr(c.atestado.dataInicio)}
                <div className={cn('text-xs', c.diferencaInicioDias === 0 ? 'text-green-700' : 'text-gray-400')}>
                  {c.diferencaInicioDias === 0 ? 'igual ao SESMT' : `${c.diferencaInicioDias}d de diferença`}
                </div>
              </td>
              <td className="px-3 py-2 text-gray-700">
                {formatarDataBr(c.atestado.dataFim)}
                {c.diferencaFimDias !== null && (
                  <div className={cn('text-xs', c.diferencaFimDias === 0 ? 'text-green-700' : 'text-gray-400')}>
                    {c.diferencaFimDias === 0 ? 'igual ao SESMT' : `${c.diferencaFimDias}d de diferença`}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-gray-700">
                {c.atestado.cidCodigo ?? 'Sem CID'}
                {c.cid !== 'igual' && <div className="text-xs text-red-500">{LABEL_CATEGORIA_CID[c.cid]}</div>}
              </td>
              <td className="space-y-1 px-3 py-2">
                {c.maisProvavel && <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Mais provável</span>}
                {c.sobrepoeCom.length > 0 && (
                  <span className="block text-xs font-medium text-red-600">
                    ⚠ Sobrepõe {c.sobrepoeCom.length === 1 ? 'outro atestado' : `${c.sobrepoeCom.length} atestados`} — possível duplicidade
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <Link href={`/atestados?busca=${encodeURIComponent(l.sesmt.nome)}`} target="_blank" className="text-xs font-medium text-blue-600 hover:underline">
                  Ver no sistema
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function detalheCid(l: Extract<LinhaResultado, { status: 'divergencia' }>): string {
  const cat = categoriaCidDaLinha(l)
  return cat && cat !== 'igual' ? ` (CID: ${LABEL_CATEGORIA_CID[cat]})` : ''
}

function exportarExcel(resultado: ResultadoAuditoria) {
  const header = [
    'Status', 'Funcionário', 'Matrícula',
    'Início SESMT', 'Início Sistema',
    'Fim SESMT (último dia)', 'Fim Sistema',
    'CID SESMT', 'CID Sistema',
    'Motivo SESMT', 'Origem ocupacional Sistema',
    'Detalhe',
  ]

  const linhas: (string | number)[][] = resultado.linhas.map(l => {
    const status = LABEL_STATUS[l.status]
    switch (l.status) {
      case 'confere':
      case 'divergencia':
        return [
          status, l.sesmt.nome, registroDaMatricula(l.sesmt.matriculaRaw),
          formatarDataBr(l.sesmt.dataInicio), formatarDataBr(l.sistema.dataInicio),
          fimSesmtBr(l.sesmt), formatarDataBr(l.sistema.dataFim),
          l.sesmt.cidTexto, l.sistema.cidCodigo ?? 'Sem CID',
          l.sesmt.motivo, l.sistema.origemOcupacional ?? '—',
          l.status === 'divergencia'
            ? `Campos divergentes: ${l.camposDivergentes.join(', ')}${detalheCid(l)}${l.porProximidade ? ' — pareado por data próxima' : ''}`
            : '',
        ]
      case 'nao_lancado':
      case 'matricula_nao_encontrada':
        return [
          status, l.sesmt.nome, registroDaMatricula(l.sesmt.matriculaRaw),
          formatarDataBr(l.sesmt.dataInicio), '—',
          fimSesmtBr(l.sesmt), '—',
          l.sesmt.cidTexto, '—',
          l.sesmt.motivo, '—',
          '',
        ]
      case 'ambiguo':
        return [
          status, l.sesmt.nome, registroDaMatricula(l.sesmt.matriculaRaw),
          formatarDataBr(l.sesmt.dataInicio), '—',
          fimSesmtBr(l.sesmt), '—',
          l.sesmt.cidTexto, '—',
          l.sesmt.motivo, '—',
          `${l.candidatos.length} atestados candidatos (duplicidade a corrigir): ${l.candidatos.map(c => `${formatarDataBr(c.dataInicio)}→${formatarDataBr(c.dataFim)} ${c.cidCodigo ?? 'Sem CID'}`).join(' | ')}`,
        ]
      case 'sem_sesmt':
        return [
          status, l.sistema.funcionarioNome, l.sistema.registro,
          '—', formatarDataBr(l.sistema.dataInicio),
          '—', formatarDataBr(l.sistema.dataFim),
          '—', l.sistema.cidCodigo ?? 'Sem CID',
          '—', l.sistema.origemOcupacional ?? '—',
          '',
        ]
    }
  })

  const ws = XLSX.utils.aoa_to_sheet([header, ...linhas])
  ws['!cols'] = header.map((_, i) => ({ wch: i === 11 ? 50 : i === 1 ? 30 : 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Auditoria SESMT')
  const hoje = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `auditoria_sesmt_atestados_${hoje}.xlsx`)
}

export function TabelaResultado({ resultado }: { resultado: ResultadoAuditoria }) {
  const { linhas, contadores, cids } = resultado
  const [modalIndex, setModalIndex] = useState<number | null>(null)
  const [lancados, setLancados] = useState<Set<number>>(new Set())
  const [filtroDiv, setFiltroDiv] = useState<'todas' | 'datas' | Exclude<CategoriaCid, 'igual'>>('todas')
  const [corrigirId, setCorrigirId] = useState<string | null>(null)
  const [corrigidos, setCorrigidos] = useState<Set<string>>(new Set())

  const divergencias = linhas.filter((l): l is Extract<LinhaResultado, { status: 'divergencia' }> => l.status === 'divergencia')
  const divergenciasFiltradas = divergencias.filter(l => {
    if (filtroDiv === 'todas') return true
    const cat = categoriaCidDaLinha(l)
    return filtroDiv === 'datas' ? cat === null : cat === filtroDiv
  })
  const linhaCorrecao = corrigirId ? divergencias.find(l => l.sistema.id === corrigirId) ?? null : null
  const conferem = linhas.filter((l): l is Extract<LinhaResultado, { status: 'confere' }> => l.status === 'confere')
  const naoLancados = linhas.filter((l): l is Extract<LinhaResultado, { status: 'nao_lancado' | 'matricula_nao_encontrada' }> =>
    l.status === 'nao_lancado' || l.status === 'matricula_nao_encontrada',
  )
  const ambiguos = linhas.filter((l): l is Extract<LinhaResultado, { status: 'ambiguo' }> => l.status === 'ambiguo')
  const semSesmt = linhas.filter((l): l is Extract<LinhaResultado, { status: 'sem_sesmt' }> => l.status === 'sem_sesmt')
  const linhaModal = modalIndex !== null ? naoLancados[modalIndex] : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <CardContador label="Conferem" valor={contadores.confere} cor="border-t-green-500" />
          <CardContador label="Divergências" valor={contadores.divergencia} cor="border-t-red-500" />
          <CardContador label="Não lançados" valor={contadores.naoLancado + contadores.matriculaNaoEncontrada} cor="border-t-amber-500" />
          <CardContador label="Ambíguos / Sem SESMT" valor={contadores.ambiguo + contadores.semSesmt} cor="border-t-indigo-500" />
        </div>
        <button
          type="button"
          onClick={() => exportarExcel(resultado)}
          className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
        >
          Baixar Excel
        </button>
      </div>

      {resultado.janela && (
        <p className="text-xs text-gray-400">
          Período coberto pela planilha: {formatarDataBr(resultado.janela.inicio)} a {formatarDataBr(resultado.janela.fim)}. Atestados do sistema fora dele não entram em &quot;Sem SESMT&quot;.
        </p>
      )}

      {divergencias.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">⚠️ Divergências ({divergenciasFiltradas.length}{divergenciasFiltradas.length !== divergencias.length ? ` de ${divergencias.length}` : ''})</h2>
            <p className="text-xs text-gray-400">Cada célula mostra SESMT em cima, Sistema embaixo — em vermelho quando diferem. Fim = último dia afastado nos dois lados.</p>
            <select
              value={filtroDiv}
              onChange={e => setFiltroDiv(e.target.value as typeof filtroDiv)}
              className="mt-2 rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="todas">Todas ({divergencias.length})</option>
              <option value="datas">Só datas / origem</option>
              <option value="sistema_sem_cid">CID: sistema sem CID</option>
              <option value="subcodigo">CID: subcódigo diferente</option>
              <option value="cid_diferente">CID: diferente</option>
              <option value="sesmt_sem_cid">CID: SESMT sem CID</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Fim</th>
                  <th className="px-3 py-2">CID</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {divergenciasFiltradas.map((l, i) => (
                  <LinhaConfereOuDivergencia key={i} l={l} onCorrigir={() => setCorrigirId(l.sistema.id)} enviado={corrigidos.has(l.sistema.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {naoLancados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">❌ Não lançados no sistema ({naoLancados.length})</h2>
            <p className="text-xs text-gray-400">&quot;Solicitar&quot; envia o atestado pré-preenchido para Aprovações — nada é gravado até o admin aprovar</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Fim</th>
                  <th className="px-3 py-2">CID</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {naoLancados.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{registroDaMatricula(l.sesmt.matriculaRaw)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sesmt.dataInicio)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{fimSesmtBr(l.sesmt)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.cidTexto}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.motivo}</td>
                    <td className="px-3 py-2 text-sm">
                      {lancados.has(i) ? (
                        <span className="font-medium text-green-600">✓ Enviado p/ aprovação</span>
                      ) : l.status === 'nao_lancado' ? (
                        <button
                          type="button"
                          onClick={() => setModalIndex(i)}
                          className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                        >
                          Solicitar
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400" title="Matrícula não encontrada no sistema — confira se é a matrícula correta">
                          Matrícula não encontrada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {linhaCorrecao && (
        <ModalSolicitarCorrecao
          key={linhaCorrecao.sistema.id}
          linha={linhaCorrecao}
          cids={cids}
          open
          onClose={() => setCorrigirId(null)}
          onEnviado={() => setCorrigidos(prev => new Set(prev).add(linhaCorrecao.sistema.id))}
        />
      )}

      {linhaModal?.status === 'nao_lancado' && (
        <ModalLancarAtestado
          linha={linhaModal}
          cids={cids}
          open={modalIndex !== null}
          onClose={() => setModalIndex(null)}
          onLancado={() => {
            if (modalIndex !== null) setLancados(prev => new Set(prev).add(modalIndex))
          }}
        />
      )}

      {ambiguos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">🔀 Ambíguos ({ambiguos.length})</h2>
            <p className="text-xs text-amber-800">
              O período do SESMT cobre mais de um atestado do sistema. Atestado duplicado ou sobreposto não é permitido: confira
              qual é o correto e corrija ou exclua o outro em Atestados.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {ambiguos.map((l, i) => (
              <BlocoAmbiguo key={i} l={l} />
            ))}
          </div>
        </div>
      )}

      {semSesmt.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">ℹ️ Sem registro no SESMT ({semSesmt.length})</h2>
            <p className="text-xs text-gray-400">Atestados lançados no sistema, dentro do período da planilha, que o SESMT não listou</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Período no sistema</th>
                  <th className="px-3 py-2">CID</th>
                </tr>
              </thead>
              <tbody>
                {semSesmt.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-sm text-gray-700">{l.sistema.funcionarioNome}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.registro}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sistema.dataInicio)} → {formatarDataBr(l.sistema.dataFim)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.cidCodigo ?? 'Sem CID'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {conferem.length > 0 && (
        <details className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <summary className="cursor-pointer border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">
            ✅ Conferem ({conferem.length}) — clique para expandir
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Fim</th>
                  <th className="px-3 py-2">CID</th>
                </tr>
              </thead>
              <tbody>
                {conferem.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{registroDaMatricula(l.sesmt.matriculaRaw)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sistema.dataInicio)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sistema.dataFim)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {l.sistema.cidCodigo ?? '—'}
                      {extrairCodigoCid(l.sesmt.cidTexto) && extrairCodigoCid(l.sesmt.cidTexto) !== l.sistema.cidCodigo && (
                        <span className="ml-1 text-xs text-gray-400">(SESMT: {extrairCodigoCid(l.sesmt.cidTexto)})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
