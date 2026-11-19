import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Tudo que toca banco/privilégio é substituído por mocks: nenhuma rotina real é executada.
// O mock de createAdminClient lança um erro sentinela, o que permite provar DUAS coisas:
//  - requisição NÃO autorizada → 401 e createAdminClient NUNCA é chamado (auth vem antes de tudo);
//  - requisição autorizada → a auth passa e a próxima ação é pedir o cliente privilegiado (que aqui é bloqueado).
const SENTINELA = 'CLIENTE_ADMIN_BLOQUEADO_NO_TESTE'
const criarAdmin = vi.hoisted(() => vi.fn())
const processarRetornos = vi.hoisted(() => vi.fn())
const encerrarCoberturas = vi.hoisted(() => vi.fn())
const calcularKpis = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: criarAdmin }))
vi.mock('@/lib/processar-retornos', () => ({ processarRetornosAtestado: processarRetornos }))
vi.mock('@/app/(admin)/coberturas/actions', () => ({ encerrarCoberturasVencidas: encerrarCoberturas }))
vi.mock('@/lib/dashboard-kpis', () => ({ calcularKPIsAtuais: calcularKpis }))

import { GET as snapshotDiario } from '@/app/api/cron/snapshot-diario/route'
import { GET as limparFotos } from '@/app/api/cron/limpar-fotos-agenda/route'
import { GET as limparGeo } from '@/app/api/cron/limpar-geo-google/route'

const SEGREDO = 'segredo-simulado-de-teste'
const rotas = [
  { nome: 'snapshot-diario', GET: snapshotDiario },
  { nome: 'limpar-fotos-agenda', GET: limparFotos },
  { nome: 'limpar-geo-google', GET: limparGeo },
]

function req(authorization?: string) {
  const headers: Record<string, string> = {}
  if (authorization !== undefined) headers.authorization = authorization
  return new NextRequest('http://localhost/api/cron/teste', { headers })
}

const original = process.env.CRON_SECRET
beforeEach(() => {
  criarAdmin.mockReset().mockImplementation(() => {
    throw new Error(SENTINELA)
  })
  processarRetornos.mockReset()
  encerrarCoberturas.mockReset()
  calcularKpis.mockReset()
})
afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original
})

function nadaPrivilegiadoFoiChamado() {
  expect(criarAdmin).not.toHaveBeenCalled()
  expect(processarRetornos).not.toHaveBeenCalled()
  expect(encerrarCoberturas).not.toHaveBeenCalled()
  expect(calcularKpis).not.toHaveBeenCalled()
}

for (const { nome, GET } of rotas) {
  describe(`${nome}: autenticação`, () => {
    const casosNegados: Array<[string, string | undefined, string | undefined]> = [
      ['segredo ausente + "Bearer undefined"', undefined, 'Bearer undefined'],
      ['segredo ausente + sem cabeçalho', undefined, undefined],
      ['segredo vazio + "Bearer "', '', 'Bearer '],
      ['segredo só com espaços', '   ', 'Bearer    '],
      ['segredo definido + cabeçalho ausente', SEGREDO, undefined],
      ['segredo definido + cabeçalho incorreto', SEGREDO, 'Bearer errado'],
      ['segredo definido + sem prefixo Bearer', SEGREDO, SEGREDO],
    ]
    for (const [descricao, segredo, cabecalho] of casosNegados) {
      it(`401 sem executar nada: ${descricao}`, async () => {
        if (segredo === undefined) delete process.env.CRON_SECRET
        else process.env.CRON_SECRET = segredo
        const res = await GET(req(cabecalho))
        expect(res.status).toBe(401)
        nadaPrivilegiadoFoiChamado()
      })
    }

    it('formato da Vercel "Authorization: Bearer <CRON_SECRET>" passa da autenticação', async () => {
      process.env.CRON_SECRET = SEGREDO
      // A auth passou; a rota segue para o cliente privilegiado, que o mock bloqueia.
      await expect(GET(req(`Bearer ${SEGREDO}`))).rejects.toThrow(SENTINELA)
      expect(criarAdmin).toHaveBeenCalledTimes(1)
      expect(processarRetornos).not.toHaveBeenCalled()
      expect(encerrarCoberturas).not.toHaveBeenCalled()
    })
  })
}
