const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
supabase.from("generated_videos").select("id, video_url, status").order("created_at", { ascending: false }).limit(5).then(r => console.log(JSON.stringify(r.data, null, 2)));
