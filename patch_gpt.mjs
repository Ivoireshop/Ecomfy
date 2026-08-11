import fs from 'fs';
const files = [
  'supabase/functions/correct-text/index.ts',
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/gpt-5-mini-2025-[0-9\-]+/g, 'google/gemini-1.5-flash');
    fs.writeFileSync(file, content);
  }
}
