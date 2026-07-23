import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    const anonKey = publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Nicht angemeldet.' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Ungültige Sitzung.' }, 401)

    const payload = await request.json()
    const password = String(payload.password || '')
    if (password.length < 10) return json({ error: 'Das Passwort muss mindestens 10 Zeichen enthalten.' }, 400)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, full_name, active, must_change_password')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile) return json({ error: 'Mitarbeiterkonto nicht gefunden.' }, 404)
    if (!profile.active) return json({ error: 'Dieses Mitarbeiterkonto ist deaktiviert.' }, 403)

    const { error: authError } = await adminClient.auth.admin.updateUserById(userData.user.id, { password })
    if (authError) return json({ error: authError.message }, 400)

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', userData.user.id)
    if (updateError) return json({ error: updateError.message }, 400)

    await adminClient.from('audit_logs').insert({
      employee_id: profile.id,
      employee_name: profile.full_name,
      action: profile.must_change_password ? 'employee.first_password_set' : 'employee.password_changed',
      entity_type: 'profile',
      entity_id: profile.id,
      entity_name: profile.full_name,
      details: profile.must_change_password ? 'Startpasswort wurde ersetzt.' : 'Passwort wurde geändert.',
    })

    return json({ ok: true })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Interner Serverfehler.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}
