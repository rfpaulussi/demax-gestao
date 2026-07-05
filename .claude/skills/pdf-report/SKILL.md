---
name: pdf-report
description: Scaffold a PDF report component using @react-pdf/renderer with the project's standard header/footer and CPF masking
---

Invoked with `/pdf-report nome-do-relatorio` — creates a PDF document component following the project's established pattern.

## File location

`components/{modulo}/{nome}-pdf.tsx`

## Template

```tsx
// NÃO adicionar 'use client' — componentes PDF são importados dinamicamente
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:            { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111827' },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#111827' },
  companyName:     { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  companySubtitle: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  title:           { textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginVertical: 14, borderWidth: 1, borderColor: '#111827', paddingVertical: 7, paddingHorizontal: 12 },
  section:         { marginBottom: 14 },
  sectionTitle:    { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#6b7280', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  row:             { flexDirection: 'row', marginBottom: 3 },
  label:           { width: 130, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  value:           { flex: 1, fontSize: 9 },
  footer:          { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

// ─── Documento ────────────────────────────────────────────────────────────────

function {NomeDoc}Document({ data }: { data: {TipoDados} }) {
  const idShort = data.id.substring(0, 8).toUpperCase()

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho padrão DEMAX */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySubtitle}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Registro</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{idShort}</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={s.title}>{TITULO DO DOCUMENTO}</Text>

        {/* I. Dados do Colaborador */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>I. DADOS DO COLABORADOR</Text>
          <View style={s.row}>
            <Text style={s.label}>Nome:</Text>
            <Text style={s.value}>{data.funcionario_nome ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CPF:</Text>
            {/* SEMPRE mascarado — nunca exibir CPF real em PDF */}
            <Text style={s.value}>***.***.***-**</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Posto:</Text>
            <Text style={s.value}>{data.posto_nome ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Secretaria:</Text>
            <Text style={s.value}>{data.secretaria ?? '—'}</Text>
          </View>
        </View>

        {/* Seções adicionais conforme o documento */}

        {/* Assinaturas */}
        <View style={[s.section, { marginTop: 32 }]} wrap={false}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6, marginRight: 12 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 20 }}>{data.funcionario_nome ?? '—'}</Text>
              <Text style={{ fontSize: 7, color: '#6b7280' }}>Colaborador(a)</Text>
            </View>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 20 }}>Responsável</Text>
              <Text style={{ fontSize: 7, color: '#6b7280' }}>Supervisor / Gestão</Text>
            </View>
          </View>
        </View>

        {/* Rodapé fixo */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>Reg. {idShort} · Emitido em {new Date().toLocaleDateString('pt-BR')}</Text>
        </View>

      </Page>
    </Document>
  )
}

// ─── Download ─────────────────────────────────────────────────────────────────
// Esta função é chamada de um botão 'use client' — importar dinamicamente

export async function download{NomeDoc}PDF(data: {TipoDados}): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<{NomeDoc}Document data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nome = (data.funcionario_nome ?? 'relatorio')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const a = document.createElement('a')
  a.href = url
  a.download = `{nome-arquivo}_${nome}_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
```

## Uso no botão de download (componente 'use client')

```tsx
import { download{NomeDoc}PDF } from '@/components/{modulo}/{nome}-pdf'

// Em um botão:
<button
  onClick={() => download{NomeDoc}PDF(item)}
  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 transition"
>
  PDF
</button>
```

## Regras obrigatórias

- [ ] CPF **sempre** `***.***.***-**` — nunca exibir o valor real, nem em metadados do documento
- [ ] Salário ou dados financeiros sensíveis: omitir ou mascarar
- [ ] Importar `@react-pdf/renderer` **dinamicamente** no download: `await import('@react-pdf/renderer')`
- [ ] O componente Document **não** usa `'use client'` — é renderizado server-side pelo renderer
- [ ] Botão de download deve estar em um componente com `'use client'`
- [ ] Cabeçalho DEMAX padrão em todos os documentos
- [ ] Rodapé com `fixed` para aparecer em todas as páginas
