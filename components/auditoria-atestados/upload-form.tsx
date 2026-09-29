// components/auditoria-atestados/upload-form.tsx
'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { auditarSesmt } from '@/app/(admin)/auditoria-atestados/actions'
import { parsePlanilhaSesmt, type ResultadoParsePlanilha } from '@/lib/auditoria-atestados/planilha'
import { TabelaResultado } from './tabela-resultado'
import type { ResultadoAuditoria } from '@/lib/auditoria-atestados/tipos'

function parseArquivoSesmt(file: File): Promise<ResultadoParsePlanilha> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) {
          resolve({ linhas: [], linhasIgnoradas: 0, erro: 'Planilha vazia ou sem abas.' })
          return
        }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        resolve(parsePlanilhaSesmt(raw))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function UploadForm() {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoAuditoria | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [linhasIgnoradas, setLinhasIgnoradas] = useState(0)

  async function onFile(file: File) {
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setNomeArquivo(file.name)
    setLinhasIgnoradas(0)
    try {
      const { linhas, linhasIgnoradas: ignoradas, erro: erroParse } = await parseArquivoSesmt(file)
      setLinhasIgnoradas(ignoradas)
      if (erroParse) { setErro(erroParse); return }
      if (linhas.length === 0) { setErro('Nenhuma linha válida encontrada na planilha.'); return }

      const res = await auditarSesmt(linhas)
      if ('erro' in res) { setErro(res.erro); return }
      setResultado(res)
    } catch {
      setErro('Falha ao ler o arquivo. Confirme que é um .xlsx válido.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">
          Planilha do SESMT (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx"
          onChange={e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onFile(f)
          }}
          className="text-sm"
        />
        {nomeArquivo && <p className="mt-2 text-xs text-gray-400">Arquivo: {nomeArquivo}</p>}
        {carregando && <p className="mt-2 text-xs text-gray-500">Comparando...</p>}
        {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
      </div>

      {linhasIgnoradas > 0 && (
        <p className="text-xs text-gray-400">{linhasIgnoradas} linha(s) da planilha ignorada(s) por matrícula ausente ou data inválida.</p>
      )}

      {resultado && <TabelaResultado resultado={resultado} />}
    </div>
  )
}
