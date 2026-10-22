const LADO_MAXIMO = 1600
const QUALIDADE_JPEG = 0.85

/**
 * Reduz a foto para caber no limite de ~4,5 MB da Vercel: lado maior 1600 px, JPEG.
 * Respeita a rotação da câmera. PDF segue como está.
 */
export async function prepararArquivo(arquivo: File): Promise<File> {
  if (arquivo.type === 'application/pdf') return arquivo

  let imagem: ImageBitmap
  try {
    imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Não consegui abrir essa imagem. Use uma foto em JPG ou PNG.')
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(imagem.width * escala)
  canvas.height = Math.round(imagem.height * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a foto.')
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height)
  imagem.close()

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG))
  if (!blob) throw new Error('Não foi possível preparar a foto.')
  return new File([blob], 'atestado.jpg', { type: 'image/jpeg' })
}
