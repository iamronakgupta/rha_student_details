import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createStudent, listStudentsByName, updateStudent, uploadProfileImage } from './api/studentApi'
import type { Student, StudentCreateInput, StudentUpdateInput } from './types/student'

type Mode = 'view' | 'edit' | 'create'
type MobilePane = 'list' | 'details'

const EMPTY_CREATE: StudentCreateInput = {
  name: '',
  guardian: '',
  age: 0,
  school: '',
  academy_class: '',
  school_class: '',
  shoe_size: '',
  tee_size: '',
  comment: '',
  profile_image_url: '',
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeStudent(raw: Student): Student {
  return {
    id: asNumber(raw.id),
    name: asString(raw.name),
    guardian: asString(raw.guardian),
    age: asNumber(raw.age),
    school: asString(raw.school),
    academy_class: asString(raw.academy_class),
    school_class: asString(raw.school_class),
    shoe_size: asString(raw.shoe_size),
    tee_size: asString(raw.tee_size),
    comment: asString(raw.comment),
    profile_image_url: asString((raw as { profile_image_url?: string }).profile_image_url),
  }
}

function getInitials(name: string): string {
  const n = name.trim()
  if (!n) return '?'
  const parts = n.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return n.slice(0, 2).toUpperCase()
}

function normalizeProfileImageUrl(url: string): string {
  const u = url.trim()
  if (!u) return ''

  // If someone pastes a normal Drive file URL like:
  // https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing
  // convert it to a direct image link that works in <img src="...">
  const fileMatch = u.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (fileMatch?.[1]) {
    const id = fileMatch[1]
    return `https://drive.google.com/thumbnail?id=${id}`
  }

  const openMatch = u.match(/drive\.google\.com\/open\?id=([^&]+)/)
  if (openMatch?.[1]) {
    const id = openMatch[1]
    return `https://drive.google.com/thumbnail?id=${id}`
  }

  return u
}

function Avatar({
  name,
  imageUrl,
}: {
  name: string
  imageUrl?: string
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const initials = getInitials(name)
  const hasImage = !!imageUrl && !!imageUrl.trim()
  if (!hasImage || failed) {
    return <span className="avatarInitials">{initials}</span>
  }

  const src = normalizeProfileImageUrl(imageUrl)
  console.log('src', src)
  return (
    <>
      <img src={src} alt="" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      {!loaded ? <span className="avatarInitials">{initials}</span> : null}
    </>
  )
}

function diffUpdate(original: Student, edited: StudentCreateInput): StudentUpdateInput {
  const patch: StudentUpdateInput = {}
  if (edited.name !== original.name) patch.name = edited.name
  if (edited.guardian !== original.guardian) patch.guardian = edited.guardian
  if (edited.age !== original.age) patch.age = edited.age
  if (edited.school !== original.school) patch.school = edited.school
  if (edited.academy_class !== original.academy_class) patch.academy_class = edited.academy_class
  if (edited.school_class !== original.school_class) patch.school_class = edited.school_class
  if (edited.shoe_size !== original.shoe_size) patch.shoe_size = edited.shoe_size
  if (edited.tee_size !== original.tee_size) patch.tee_size = edited.tee_size
  if (edited.comment !== original.comment) patch.comment = edited.comment
  const editedImg = (edited as { profile_image_url?: string }).profile_image_url
  const origImg = (original as { profile_image_url?: string }).profile_image_url
  if (editedImg !== origImg) (patch as { profile_image_url?: string }).profile_image_url = editedImg ?? ''
  return patch
}

function App() {
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [mode, setMode] = useState<Mode>('view')
  const [draft, setDraft] = useState<StudentCreateInput>(EMPTY_CREATE)
  const [mobilePane, setMobilePane] = useState<MobilePane>('list')

  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => (selectedId == null ? null : students.find((s) => s.id === selectedId) ?? null),
    [students, selectedId],
  )

  useEffect(() => {
    // initial list: empty name gives all results in most scripts; if not, user can search
    void (async () => {
      setLoadingList(true)
      setError(null)
      try {
        const list = await listStudentsByName('')
        setStudents(list.map(normalizeStudent))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load students')
      } finally {
        setLoadingList(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (mode === 'create') {
      setDraft(EMPTY_CREATE)
      return
    }
    if (selected && (mode === 'edit' || mode === 'view')) {
      const { id: _id, ...rest } = selected
      setDraft(rest)
    }
  }, [mode, selected])

  useEffect(() => {
    // On mobile, if user selects or creates, jump to details pane.
    if (mode === 'create') setMobilePane('details')
  }, [mode])

  function clearMessages() {
    setError(null)
    setNotice(null)
  }

  async function refreshList(nextSelectedId?: number) {
    setLoadingList(true)
    setError(null)
    try {
      const list = await listStudentsByName(query.trim())
      const normalized = list.map(normalizeStudent)
      setStudents(normalized)

      if (nextSelectedId != null) {
        setSelectedId(nextSelectedId)
      } else if (selectedId != null) {
        const stillThere = normalized.some((s) => s.id === selectedId)
        if (!stillThere) setSelectedId(normalized[0]?.id ?? null)
      } else {
        setSelectedId(normalized[0]?.id ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load students')
    } finally {
      setLoadingList(false)
    }
  }

  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    await refreshList()
  }

  async function onSave() {
    clearMessages()
    setSaving(true)
    try {
      if (mode === 'create') {
        if (!draft.name.trim()) {
          setError('Name is required')
          return
        }
        const newId = await createStudent({
          ...draft,
          name: draft.name.trim(),
        })
        setNotice('Student created')
        setMode('view')
        await refreshList(newId)
        return
      }

      if (!selected) {
        setError('No student selected')
        return
      }

      const patch = diffUpdate(selected, draft)
      if (Object.keys(patch).length === 0) {
        setNotice('No changes to save')
        setMode('view')
        return
      }

      await updateStudent(selected.id, patch)
      setNotice('Saved')
      setMode('view')
      await refreshList(selected.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function onCancelEdit() {
    clearMessages()
    setMode('view')
  }

  async function onProfileImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    clearMessages()
    setUploadingImage(true)
    try {
      const url = await uploadProfileImage(file)
      setDraft((d) => ({ ...d, profile_image_url: url }))
      setNotice('Photo uploaded. Click Save to keep it.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandText">
            <div className="brandTitle">RHA Students</div>
            <div className="brandSub">List, view, and edit student details</div>
          </div>
        </div>

        <div className="topbarActions">
          <div className="mobileTabs" role="tablist" aria-label="Pane selector">
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'list'}
              className={`tab ${mobilePane === 'list' ? 'isActive' : ''}`}
              onClick={() => setMobilePane('list')}
            >
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'details'}
              className={`tab ${mobilePane === 'details' ? 'isActive' : ''}`}
              onClick={() => setMobilePane('details')}
              disabled={mode !== 'create' && !selected}
            >
              Details
            </button>
          </div>
          <button
            className="btn btnPrimary"
            type="button"
            onClick={() => {
              clearMessages()
              setSelectedId(null)
              setMode('create')
              setMobilePane('details')
            }}
          >
            New student
          </button>
        </div>
      </header>

      <div className={`content ${mobilePane === 'list' ? 'showList' : 'showDetails'}`}>
        <aside className="panel panelLeft" aria-hidden={mobilePane !== 'list'}>
          <form className="search" onSubmit={onSearchSubmit}>
            <label className="label" htmlFor="searchName">
              Search by name
            </label>
            <div className="searchRow">
              <input
                id="searchName"
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. ron"
              />
              <button className="btn" type="submit" disabled={loadingList}>
                {loadingList ? 'Searching…' : 'Search'}
              </button>
            </div>
          </form>

          <div className="metaRow">
            <div className="meta">
              {loadingList ? 'Loading…' : `${students.length} student${students.length === 1 ? '' : 's'}`}
            </div>
            <button className="btn btnGhost" type="button" onClick={() => void refreshList()}>
              Refresh
            </button>
          </div>

          <div className="list" role="list">
            {students.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`listItem ${selectedId === s.id ? 'isActive' : ''}`}
                onClick={() => {
                  clearMessages()
                  setSelectedId(s.id)
                  setMode('edit')
                  setMobilePane('details')
                }}
              >
                <div className="listItemInner">
                  <div className="avatar avatarSm">
                    <Avatar name={s.name} imageUrl={s.profile_image_url} />
                  </div>
                  <div className="listItemText">
                    <div className="listTitle">{s.name || '(no name)'}</div>
                    <div className="listSub">
                  <span className="pill">#{s.id}</span>
                  <span className="muted">{s.academy_class || '—'}</span>
                  <span className="dot" aria-hidden="true" />
                  <span className="muted">{s.school || '—'}</span>
                </div>
                  </div>
                </div>
              </button>
            ))}
            {!loadingList && students.length === 0 ? (
              <div className="empty">
                No results. Try another search or create a new student.
              </div>
            ) : null}
          </div>
        </aside>

        <main className="panel panelRight" aria-hidden={mobilePane !== 'details'}>
          <div className="panelHeader">
            <div>
              <div className="panelTitle">
                {mode === 'create'
                  ? 'Create student'
                  : selected
                    ? selected.name || '(no name)'
                    : 'Select a student'}
              </div>
              <div className="panelSub">
                {mode === 'create'
                  ? 'Fill the fields then Save'
                  : selected
                    ? `ID #${selected.id}`
                    : 'Use the list on the left'}
              </div>
            </div>

            <div className="panelActions">
              {selected ? (
                <button className="btn btnGhost backBtn" type="button" onClick={() => setMobilePane('list')}>
                  Back
                </button>
              ) : null}
              {mode === 'view' && selected ? (
                <button className="btn" type="button" onClick={() => setMode('edit')}>
                  Edit
                </button>
              ) : null}

              {mode === 'edit' || mode === 'create' ? (
                <>
                  <button className="btn btnGhost" type="button" onClick={onCancelEdit} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn btnPrimary" type="button" onClick={() => void onSave()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {error ? <div className="toast toastError" role="alert">{error}</div> : null}
          {notice ? <div className="toast toastOk" role="status">{notice}</div> : null}

          {mode !== 'create' && !selected ? (
            <div className="empty big">
              Select a student to view details, or click <b>New student</b>.
            </div>
          ) : (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault()
                if (mode === 'edit' || mode === 'create') void onSave()
              }}
            >
              <div className="profileSection">
                <div className="avatar avatarLg">
                  <Avatar name={draft.name} imageUrl={draft.profile_image_url} />
                </div>
                <div className="profileImageField">
                  <label className="label" htmlFor="profile_image_url">
                    Profile image (Google Drive or URL)
                  </label>
                  <div className="profileImageRow">
                    <input
                      id="profile_image_url"
                      className="input"
                      type="url"
                      placeholder="Paste URL or upload below"
                      value={draft.profile_image_url ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, profile_image_url: e.target.value }))}
                      readOnly={mode === 'view'}
                    />
                    {(mode === 'edit' || mode === 'create') && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          aria-label="Upload photo"
                          className="hiddenFileInput"
                          onChange={onProfileImageSelect}
                          disabled={uploadingImage}
                        />
                        <button
                          type="button"
                          className="btn"
                          disabled={uploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadingImage ? 'Uploading…' : 'Upload photo'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid">
                <div className="field">
                  <label className="label" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    className="input"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="guardian">
                    Guardian
                  </label>
                  <input
                    id="guardian"
                    className="input"
                    value={draft.guardian}
                    onChange={(e) => setDraft((d) => ({ ...d, guardian: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="age">
                    Age
                  </label>
                  <input
                    id="age"
                    className="input"
                    type="number"
                    inputMode="numeric"
                    value={draft.age}
                    onChange={(e) => setDraft((d) => ({ ...d, age: asNumber(e.target.value) }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="academy_class">
                    Academy class
                  </label>
                  <input
                    id="academy_class"
                    className="input"
                    value={draft.academy_class}
                    onChange={(e) => setDraft((d) => ({ ...d, academy_class: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="school">
                    School
                  </label>
                  <input
                    id="school"
                    className="input"
                    value={draft.school}
                    onChange={(e) => setDraft((d) => ({ ...d, school: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="school_class">
                    School class
                  </label>
                  <input
                    id="school_class"
                    className="input"
                    value={draft.school_class}
                    onChange={(e) => setDraft((d) => ({ ...d, school_class: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="shoe_size">
                    Shoe size
                  </label>
                  <input
                    id="shoe_size"
                    className="input"
                    value={draft.shoe_size}
                    onChange={(e) => setDraft((d) => ({ ...d, shoe_size: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="tee_size">
                    Tee size
                  </label>
                  <input
                    id="tee_size"
                    className="input"
                    value={draft.tee_size}
                    onChange={(e) => setDraft((d) => ({ ...d, tee_size: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>

                <div className="field fieldFull">
                  <label className="label" htmlFor="comment">
                    Comment
                  </label>
                  <textarea
                    id="comment"
                    className="textarea"
                    rows={5}
                    value={draft.comment}
                    onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
                    readOnly={mode === 'view'}
                  />
                </div>
              </div>

              {mode === 'view' ? (
                <div className="hint">
                  Click <b>Edit</b> to update details.
                </div>
              ) : (
                <div className="hint">
                  Tip: press <b>Enter</b> to save (or click Save).
                </div>
              )}
            </form>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
