/**
 * Filename slugifier for media uploads.
 *
 * Historic uploads landed as "Belgian Malinois", " Chinese Crested" and
 * "Havanese-1.Havanese" — raw spaces, leading whitespace, no extension. Those
 * URLs make crawlers truncate at the space and refetch junk variants, which is
 * what filled Search Console with 404s. Everything now goes through here.
 */

const REAL_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i

const EXT_FOR_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export function slugifyBase(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Returns a lowercase, hyphenated, extension-bearing filename.
 * Also strips Payload's duplicate artefact where the base name is repeated as a
 * fake extension ("Cane Corso-2.Cane Corso").
 */
export function slugifyFilename(filename: string, mimeType?: string): string {
  const trimmed = (filename || '').trim()
  if (!trimmed) return 'file'

  let base = trimmed
  let ext = ''

  const real = trimmed.match(REAL_EXT)
  if (real) {
    ext = real[0].slice(1).toLowerCase()
    base = trimmed.slice(0, -real[0].length)
  } else {
    const dotted = trimmed.match(/^(.*?)(-\d+)?\.(.+)$/)
    if (dotted && slugifyBase(dotted[3]) === slugifyBase(dotted[1])) {
      base = dotted[1] + (dotted[2] ?? '')
    }
  }

  if (ext === 'jpeg') ext = 'jpg'
  if (!ext && mimeType) ext = EXT_FOR_MIME[mimeType] ?? ''

  const slug = slugifyBase(base) || 'file'
  return ext ? `${slug}.${ext}` : slug
}
