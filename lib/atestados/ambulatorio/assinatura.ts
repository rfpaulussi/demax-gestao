/** O `type` do arquivo vem do navegador; aqui confere os primeiros bytes para não anexar qualquer coisa disfarçada. */
export function assinaturaConfere(tipo: string, bytes: Uint8Array): boolean {
  const comeca = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  switch (tipo) {
    case 'image/jpeg':
      return comeca(0xff, 0xd8, 0xff)
    case 'image/png':
      return comeca(0x89, 0x50, 0x4e, 0x47)
    case 'image/webp':
      // "RIFF" .... "WEBP"
      return comeca(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    case 'application/pdf':
      return comeca(0x25, 0x50, 0x44, 0x46) // "%PDF"
    default:
      return false
  }
}
