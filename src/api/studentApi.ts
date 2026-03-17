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

