import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Props {
  href: string
  label?: string
}

export function BackButton({ href, label = 'Voltar' }: Props) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}
