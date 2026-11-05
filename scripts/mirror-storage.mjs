// Copie les buckets et fichiers Storage d'un projet Supabase vers un autre.
// Appelé par scripts/mirror-prod-to-dev.ps1 (les clés arrivent par variables d'environnement,
// jamais sur disque). Lecture seule sur la source, écriture sur la cible.
import { createClient } from '@supabase/supabase-js'
import { appendFileSync, writeFileSync } from 'node:fs'

const { SRC_URL, SRC_KEY, DST_URL, DST_KEY, FAIL_LOG = 'storage-failures.log' } = process.env
if (!SRC_URL || !SRC_KEY || !DST_URL || !DST_KEY) throw new Error('Variables SRC_/DST_ manquantes')
if (SRC_URL === DST_URL) throw new Error('Source et cible identiques, abandon')

const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } })
const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } })
writeFileSync(FAIL_LOG, '')

async function walk(client, bucket, prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    if (!data.length) break
    for (const it of data) {
      const path = prefix ? `${prefix}/${it.name}` : it.name
      if (it.id === null) out.push(...(await walk(client, bucket, path)))
      else out.push({ path, size: it.metadata?.size, mime: it.metadata?.mimetype, cache: it.metadata?.cacheControl })
    }
    if (data.length < 1000) break
  }
  return out
}

async function pool(items, n, fn) {
  let i = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

const { data: buckets, error: bErr } = await src.storage.listBuckets()
if (bErr) throw bErr
let copied = 0, skipped = 0, failed = 0

for (const b of buckets) {
  const opts = {
    public: b.public,
    fileSizeLimit: b.file_size_limit ?? undefined,
    allowedMimeTypes: b.allowed_mime_types ?? undefined,
  }
  const { error: cErr } = await dst.storage.createBucket(b.id, opts)
  if (cErr && !/already exists|duplicate/i.test(cErr.message)) throw new Error(`createBucket ${b.id}: ${cErr.message}`)
  if (cErr) await dst.storage.updateBucket(b.id, opts)

  const files = await walk(src, b.id)
  const existing = new Map((await walk(dst, b.id)).map((f) => [f.path, f.size]))
  console.log(`[${b.id}] ${files.length} fichiers (public=${b.public})`)

  // Miroir exact : supprimer du dev les fichiers qui n'existent plus dans la source
  const srcPaths = new Set(files.map((f) => f.path))
  const extra = [...existing.keys()].filter((p) => !srcPaths.has(p))
  for (let i = 0; i < extra.length; i += 100) {
    const { error: rErr } = await dst.storage.from(b.id).remove(extra.slice(i, i + 100))
    if (rErr) appendFileSync(FAIL_LOG, `${b.id}\tprune: ${rErr.message}\n`)
  }
  if (extra.length) console.log(`[${b.id}] ${extra.length} fichiers absents de la source supprimés du dev`)

  await pool(files, 5, async (f) => {
    if (existing.get(f.path) === f.size && f.size !== undefined) return void skipped++
    try {
      const { data: blob, error: dErr } = await src.storage.from(b.id).download(f.path)
      if (dErr) throw dErr
      const maxAge = /(\d+)/.exec(f.cache ?? '')?.[1] ?? '3600'
      const { error: uErr } = await dst.storage
        .from(b.id)
        .upload(f.path, blob, { contentType: f.mime, upsert: true, cacheControl: maxAge })
      if (uErr) throw uErr
      copied++
    } catch (e) {
      failed++
      appendFileSync(FAIL_LOG, `${b.id}/${f.path}\t${e.message ?? e}\n`)
    }
  })
}

console.log(`Storage : ${copied} copiés, ${skipped} déjà identiques, ${failed} échecs (voir ${FAIL_LOG})`)
process.exit(failed ? 2 : 0)
