'use client'

import { useRef, useState, useTransition } from 'react'
import * as XLSX from 'xlsx-js-style'
import { buscarFuncionarios, type ResultadoBusca } from '@/lib/setores/actions'
import { extrairNomes } from '@/lib/setores/nomes'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-50 text-green-700 ring-green-200' },
  atestado: { label: 'Atestado', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  afastado: { label: 'Afastado', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias: { label: 'Férias', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  rescisao_indireta: { label: 'Rescisão indireta', className: 'bg-red-50 text-red-700 ring-red-200' },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200' },
}

function StatusBadge({ status }: { status: string | null }) {
  const info = (status && STATUS_BADGE[status]) || { label: status ?? '—', className: 'bg-gray-100 text-gray-500 ring-gray-200' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${info.className}`}>
      {info.label}
    </span>
  )
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function BuscaClient({ slug, titulo }: { slug: string; titulo: string }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function buscar(nomesTexto: string) {
    const nomes = extrairNomes(nomesTexto)
    if (nomes.length === 0) {
      setErro('Cole ao menos um nome.')
      return
    }
    setErro(null)
    startTransition(async () => {
      try {
        const res = await buscarFuncionarios(slug, nomes)
        setResultados(res)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao buscar.')
      }
    })
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const linhas = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 })
    const nomes = linhas
      .map((linha) => String(linha?.[0] ?? '').trim())
      .filter((n) => n.length > 0)
    const novoTexto = nomes.join('\n')
    setTexto(novoTexto)
    if (fileInputRef.current) fileInputRef.current.value = ''
    buscar(novoTexto)
  }

  const resumo = resultados
    ? {
        total: resultados.length,
        encontrados: resultados.filter((r) => r.encontrados.length > 0).length,
        naoEncontrados: resultados.filter((r) => r.encontrados.length === 0).length,
        desligados: resultados.filter((r) => r.encontrados.some((v) => v.status === 'desligado')).length,
      }
    : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-lg font-bold text-slate-900">{titulo} — consulta de efetivo</h1>
      <p className="mt-1 text-sm text-slate-500">
        Cole um ou mais nomes (um por linha) ou envie uma planilha. Mostra posto, supervisor e status de cada um.
      </p>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        placeholder={'ALESSANDRA SALES\nAMANDA GONCALVES\n...'}
        className="mt-4 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-slate-900 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => buscar(texto)}
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? 'Buscando...' : 'Buscar'}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Enviar planilha (Excel)
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onArquivo} />
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      {resumo && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border-t-4 border-slate-400 bg-white p-3 shadow-sm">
            <p className="text-xl font-black text-slate-900">{resumo.total}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">Buscados</p>
          </div>
          <div className="rounded-lg border-t-4 border-green-500 bg-white p-3 shadow-sm">
            <p className="text-xl font-black text-slate-900">{resumo.encontrados}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">Encontrados</p>
          </div>
          <div className="rounded-lg border-t-4 border-red-500 bg-white p-3 shadow-sm">
            <p className="text-xl font-black text-slate-900">{resumo.naoEncontrados}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">Não encontrados</p>
          </div>
          <div className="rounded-lg border-t-4 border-gray-400 bg-white p-3 shadow-sm">
            <p className="text-xl font-black text-slate-900">{resumo.desligados}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">Com desligamento</p>
          </div>
        </div>
      )}

      {resultados && (
        <div className="mt-6 space-y-3">
          {resultados.map((r) => (
            <div key={r.nomeBuscado} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{r.nomeBuscado}</p>
                {r.encontrados.length > 1 && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    {r.encontrados.length} vínculos
                  </span>
                )}
              </div>

              {r.encontrados.length === 0 && (
                <p className="mt-2 text-sm text-red-600">Não encontrado no efetivo.</p>
              )}

              <div className="mt-2 divide-y divide-slate-100">
                {r.encontrados.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                    <StatusBadge status={v.status} />
                    <span className="text-slate-700">{v.funcao ?? '—'}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-700">
                      {v.posto ?? '—'}
                      {v.secretaria ? ` (${v.secretaria})` : ''}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-700">Supervisor: {v.supervisor ?? '—'}</span>
                    {v.status === 'desligado' && (
                      <span className="w-full text-xs text-gray-500">
                        Desligado em {formatarData(v.dataDesligamento)}
                        {v.motivoDesligamento ? ` — ${v.motivoDesligamento}` : ''}
                      </span>
                    )}
                    {(v.status === 'afastado' || v.status === 'atestado') && v.motivoAfastamento && (
                      <span className="w-full text-xs text-gray-500">Motivo: {v.motivoAfastamento}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
