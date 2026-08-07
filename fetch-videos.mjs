import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = envFile.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const response = await fetch(`${url}/rest/v1/generated_videos?status=eq.completed&select=id,video_url&order=created_at.desc&limit=3`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
});
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
