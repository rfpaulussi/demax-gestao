/** Reduz a foto no aparelho (JPEG, lado maior 1280 px) para caber no limite de upload. */
export const LIMITE_FOTO_BYTES = 600_000

export async function comprimirImagem(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const escala = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * escala)
  const h = Math.round(bmp.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()

  for (const q of [0.72, 0.6, 0.5, 0.4]) {
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', q))
    if (blob && blob.size <= LIMITE_FOTO_BYTES) return blob
  }
  throw new Error('Foto muito grande. Tente tirar de novo com menos zoom.')
}
