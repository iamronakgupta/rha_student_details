import type { Student, StudentCreateInput, StudentUpdateInput } from '../types/student'

type CreateResponse = { success: true; id: number } | { success: false; error?: string }
type UpdateResponse = { success: true } | { success: false; error?: string }

function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_STUDENT_API_BASE_URL as string | undefined
  if (!base) {
    throw new Error(
      'Missing VITE_STUDENT_API_BASE_URL. Add it to .env.local (see .env.example).',
    )
  }
  return base.replace(/\/$/, '')
}

function getApiKey(): string | undefined {
  const key = import.meta.env.VITE_STUDENT_API_KEY as string | undefined
  return key?.trim() ? key.trim() : undefined
}

function buildUrl(action: string, params?: Record<string, string>): string {
  const url = new URL(getApiBaseUrl())
  url.searchParams.set('action', action)

  const apiKey = getApiKey()
  if (apiKey) url.searchParams.set('api_key', apiKey)

  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return url.toString()
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON response (status ${res.status}): ${text.slice(0, 300)}`)
  }
}

export async function listStudentsByName(searchTerm: string): Promise<Student[]> {
  const url = buildUrl('list', { name: searchTerm })
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`List failed (HTTP ${res.status})`)
  const data = await parseJson<unknown>(res)
  if (!Array.isArray(data)) throw new Error('List response is not an array')
  return data as Student[]
}

export async function createStudent(input: StudentCreateInput): Promise<number> {
  const url = buildUrl('create')
  const res = await fetch(url, {
    method: 'POST',
    // Avoid CORS preflight on Google Apps Script by using a "simple request" content-type.
    // Apps Script can still read JSON via e.postData.contents.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Create failed (HTTP ${res.status})`)
  const data = await parseJson<CreateResponse>(res)
  if (data && (data as { success: boolean }).success === true) return (data as { id: number }).id
  throw new Error('Create failed')
}

export async function updateStudent(
  id: number,
  patch: StudentUpdateInput,
): Promise<void> {
  const url = buildUrl('update', { id: String(id) })
  const res = await fetch(url, {
    method: 'POST',
    // Avoid CORS preflight on Google Apps Script by using a "simple request" content-type.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Update failed (HTTP ${res.status})`)
  const data = await parseJson<UpdateResponse>(res)
  if (data && (data as { success: boolean }).success === true) return
  throw new Error('Update failed')
}

/** Max size for profile image upload (5MB) */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

type UploadResponse = { success: true; url: string } | { success: false; error?: string }

export type UploadProfileImageOptions = {
  /** Student id (string in JSON for Apps Script). Omit when creating a new student before save. */
  studentId?: number
}

/**
 * Upload a profile image via Apps Script; script creates a file in Google Drive
 * and returns a direct image URL. Requires your script to handle action=upload_image.
 */
export async function uploadProfileImage(
  file: File,
  options?: UploadProfileImageOptions,
): Promise<string> {
  if (!IMAGE_MIME.includes(file.type as (typeof IMAGE_MIME)[number])) {
    throw new Error('Please choose a JPEG, PNG, GIF, or WebP image.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be under 5MB.')
  }
  const base64 = await fileToBase64(file)
  const url = buildUrl('upload_image')
  const payload: Record<string, string> = {
    base64,
    name: file.name || 'profile.jpg',
    mimeType: file.type || 'image/jpeg',
  }
  if (options?.studentId != null) {
    payload.id = String(options.studentId)
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`)
  const data = await parseJson<UploadResponse>(res)
  if (data && (data as { success: boolean }).success === true) {
    return (data as { url: string }).url
  }
  throw new Error((data as { error?: string })?.error || 'Upload failed')
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64 ?? '')
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

