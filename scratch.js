import fs from "fs";

const envStr = fs.readFileSync(".env", "utf-8");
const env = {};
envStr.split(/\r?\n/).forEach(line => {
  const match = line.trim().match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim();
  }
});

async function test() {
  const url = env.VITE_SUPABASE_URL + "/rest/v1/orders?select=*,order_items(*),order_deliveries(*,driver:delivery_company_members(*),provider:delivery_providers(*))&limit=1";
  const res = await fetch(url, {
    headers: {
      apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}
test();
