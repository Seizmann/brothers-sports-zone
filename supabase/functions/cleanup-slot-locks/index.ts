import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase function environment variables.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async () => {
  const { data, error } = await supabase.rpc("cleanup_expired_slot_locks");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ removed: data });
});
