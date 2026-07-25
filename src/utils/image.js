/**
 * Redimensionne une image côté client avant envoi : max 900 px, JPEG qualité 0.82.
 * Garde les uploads légers (~100-300 Ko) sans dépendance serveur.
 */
export function resizeImage(file, maxDim = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('Conversion de l\'image échouée')),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image illisible'))
    }
    img.src = url
  })
}
