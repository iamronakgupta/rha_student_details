/**
 * Google Drive images in <img src> often fail because:
 * - File is not shared as "Anyone with the link" (viewer)
 * - Google returns HTML (sign-in) instead of bytes
 * - Hotlink / referrer checks — use referrerPolicy="no-referrer" on <img>
 *
 * We try several URL shapes; optional proxy via VITE_DRIVE_IMAGE_PROXY (see .env.example).
 */

const THUMB_SZ = 'w1000'

function getDriveProxyBase(): string | undefined {
  const raw = import.meta.env.VITE_DRIVE_IMAGE_PROXY as string | undefined
  if (!raw?.trim()) return undefined
  return raw.trim().replace(/\/$/, '')
}

/** Extract file id from common Drive URL shapes */
export function extractGoogleDriveFileId(url: string): string | null {
  const u = url.trim()
  if (!u) return null

  let m = u.match(/drive\.google\.com\/file\/d\/([^/?#]+)/)
  if (m?.[1]) return m[1]

  m = u.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m?.[1] && /drive\.google\.com/.test(u)) return m[1]

  m = u.match(/drive\.google\.com\/open\?id=([^&]+)/)
  if (m?.[1]) return m[1]

  return null
}

/** Ordered list of src URLs to try for <img> (first working wins) */
export function driveImageSrcCandidates(userUrl: string): string[] {
  const u = userUrl.trim()
  if (!u) return []

  const proxy = getDriveProxyBase()
  const id = extractGoogleDriveFileId(u)

  if (id) {
    const list: string[] = []
    if (proxy) {
      // e.g. https://script.google.com/macros/s/.../exec?action=drive_image&id=
      const sep = proxy.includes('?') ? '&' : '?'
      list.push(`${proxy}${sep}id=${encodeURIComponent(id)}`)
    }
    list.push(`https://drive.google.com/thumbnail?id=${id}&sz=${THUMB_SZ}`)
    list.push(`https://drive.google.com/uc?export=view&id=${id}`)
    list.push(`https://drive.google.com/uc?export=download&id=${id}`)
    list.push(`https://drive.google.com/thumbnail?id=${id}`)
    return list
  }

  // Not a recognized Drive URL — use as-is (external CDN, etc.)
  return [u]
}
