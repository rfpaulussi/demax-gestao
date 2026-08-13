'use server'

import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { compararListagem } from '@/lib/conferencia-rh/comparar'
import type { LinhaRH, FuncionarioSistema, ResultadoComparacao } from '@/lib/conferencia-rh/tipos'
import { isAdminOrCoord, type Role } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

export async function compararConferenciaRH(linhasRH: LinhaRH[]): Promise<ResultadoComparacao | { erro: string }> {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' }
  if (!isAdminOrCoord(auth.perfil.role as Role)) return { erro: 'Sem permissão' }

  const supabase = createClient()

  type FuncRaw = {
    id: string
    registro: string | null
    nome: string
    status: string | null
    funcoes: { nome: string } | null
    postos: { id: string; config_supervisores_postos: { ativo: boolean | null; perfis: { nome: string | null } | null }[] } | null
  }

  let funcsRaw: FuncRaw[]
  let codigosRaw: unknown[] | null
  let errCodigos: { message: string } | null

  try {
    ;[funcsRaw, { data: codigosRaw, error: errCodigos }] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from('funcionarios')
          .select(`
            id, registro, nome, status,
            funcoes!funcao_id ( nome ),
            postos!posto_id (
              id,
              config_supervisores_postos ( ativo, perfis!supervisor_id ( nome ) )
            )
          `)
          .neq('status', 'desligado')
          .range(from, to) as unknown as PromiseLike<{ data: FuncRaw[] | null; error: { message: string } | null }>,
      ),
      (supabase as unknown as AnyQ).from('config_codigos_rh').select('codigo, apelido, supervisor_id'),
    ])
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { erro: `Erro ao buscar funcionários: ${msg}` }
  }

  if (errCodigos) return { erro: `Erro ao buscar configuração de códigos: ${errCodigos.message}` }

  const funcionariosSistema: FuncionarioSistema[] = funcsRaw.map(f => {
    const configAtiva = f.postos?.config_supervisores_postos?.find(c => c.ativo)
    return {
      id: f.id,
      registro: f.registro,
      nome: f.nome,
      funcao: f.funcoes?.nome ?? null,
      afastado: f.status === 'afastado' || f.status === 'atestado',
      supervisorNome: configAtiva?.perfis?.nome ?? null,
    }
  })

  type CodigoRow = { codigo: number; apelido: string; supervisor_id: string | null }
  const codigoParaApelido = new Map<number, string>()
  for (const c of ((codigosRaw ?? []) as unknown as CodigoRow[])) codigoParaApelido.set(c.codigo, c.apelido)

  return compararListagem(linhasRH, funcionariosSistema, codigoParaApelido)
}

export async function salvarConfigCodigoRH(codigo: number, supervisorId: string | null): Promise<{ ok: boolean; erro?: string }> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { ok: false, erro: 'Sem permissão' }

  const supabase = createClient()
  const { error } = await (supabase as unknown as AnyQ)
    .from('config_codigos_rh')
    .update({ supervisor_id: supervisorId, updated_at: new Date().toISOString() })
    .eq('codigo', codigo)

  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}
