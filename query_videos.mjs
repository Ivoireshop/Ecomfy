import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envRaw = fs.readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(envRaw.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
  const i = l.indexOf('=')
  return [l.slice(0, i), l.slice(i + 1)]
}))

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase
    .from('generated_videos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  console.log(JSON.stringify(data, null, 2))
}
run()
