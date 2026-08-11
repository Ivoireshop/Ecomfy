import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), order_deliveries(*, driver:delivery_company_members(*), provider:delivery_providers(*))")
    .limit(1);
    
  if (error) {
    console.error("Error:", error.message, error.details, error.hint);
  } else {
    console.log("Success:", data.length);
  }
}

test();
