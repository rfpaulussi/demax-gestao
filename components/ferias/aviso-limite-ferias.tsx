// Aviso fixo exibido a admin, coordenador e supervisor ao abrir as telas de férias.

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR')
}

export function AvisoLimiteFerias({ ultimaListagem }: { ultimaListagem: string | null }) {
  const ultima = ultimaListagem ? new Date(ultimaListagem + 'T00:00:00') : null
  let proxima: Date | null = null
  let atrasada = false
  if (ultima) {
    proxima = new Date(ultima)
    proxima.setMonth(proxima.getMonth() + 2)
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    atrasada = hoje > proxima
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${atrasada ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      <p>
        <strong>Data limite = fim do período aquisitivo + 10 meses.</strong> É um critério interno, mais cedo que o
        prazo legal de 12 meses, para dar margem de programação das férias.
      </p>
      <p className="mt-1 text-xs">
        {ultima && proxima ? (
          <>
            Última listagem do RH: <strong>{formatDate(ultima)}</strong> · nova listagem a pedir ao RH até{' '}
            <strong>{formatDate(proxima)}</strong>
            {atrasada && ' — já passou do prazo, solicite uma listagem atualizada.'}
          </>
        ) : (
          'Nenhuma listagem do RH carregada ainda. Solicite uma ao RH a cada 2 meses.'
        )}
      </p>
    </div>
  )
}
