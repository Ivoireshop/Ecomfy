import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
supabase.from("generated_videos").select("id, video_url, status, created_at").eq("status", "completed").order("created_at", { ascending: false }).limit(3).then(r => console.log(JSON.stringify(r.data, null, 2)));
