export function BadgePcd({ tipo, tipoOutro }: { tipo: string | null; tipoOutro?: string | null }) {
  const detalhe = tipo === 'Outra' && tipoOutro ? `Outra (${tipoOutro})` : tipo
  return (
    <span
      title={detalhe ? `PCD — ${detalhe}` : 'PCD'}
      className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200"
    >
      PCD
    </span>
  )
}
