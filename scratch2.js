require("dotenv").config({ path: ".env" });
async function test() {
  const url = process.env.VITE_SUPABASE_URL + "/rest/v1/orders?select=*,order_items(*),order_deliveries(*,driver:delivery_company_members(*),provider:delivery_providers(*))&limit=1";
  const res = await fetch(url, {
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
    }
  });
  const data = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", data);
}
test();
