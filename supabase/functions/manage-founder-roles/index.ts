import { serveCors } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleRequest } from "./handler.ts";

serveCors("app", (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  return handleRequest(req, supabase);
});
