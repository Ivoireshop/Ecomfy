import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=').replace(/^"|"$/g, '');
  return acc;
}, {});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data: subs, error: err1 } = await supabase.from('push_subscriptions').select('*');
  console.log('Subscriptions:', subs, err1);
}
run();
