import fs from 'fs';
const files = [
  'supabase/functions/_shared/openrouter-image.ts',
  'supabase/functions/_shared/openrouter-chat.ts',
  'supabase/functions/generate-ad-visual/index.ts',
  'supabase/functions/generate-video/index.ts',
  'supabase/functions/generate-feature-image/index.ts',
  'supabase/functions/generate-ai-image/index.ts'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/google\/gemini-[0-9\.]+-flash-image-preview/g, 'google/gemini-1.5-flash');
    content = content.replace(/google\/gemini-[0-9\.]+-flash-image/g, 'google/gemini-1.5-flash');
    content = content.replace(/google\/gemini-[0-9\.]+-pro-image-preview/g, 'google/gemini-1.5-flash');
    content = content.replace(/google\/gemini-[0-9\.]+-flash-lite/g, 'google/gemini-1.5-flash');
    content = content.replace(/google\/gemini-[0-9\.]+-flash/g, 'google/gemini-1.5-flash');
    content = content.replace(/google\/gemini-[0-9\.]+-pro/g, 'google/gemini-1.5-pro');
    fs.writeFileSync(file, content);
  }
}
