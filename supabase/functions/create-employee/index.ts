import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedRoles = new Set(['owner', 'administrator', 'shift_lead', 'cashier', 'inventory'])

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: caller, error: callerError } = await adminClient
      .from('profiles')
      .select('id, full_name, role, permissions, active, must_change_password')
      .eq('id', userData.user.id)
      .single()

    const canManage = caller?.active && !caller?.must_change_password &&
      (['owner', 'administrator'].includes(caller.role) || (caller.permissions || []).includes('employees.manage'))
    if (callerError || !canManage) return json({ error: 'Keine Berechtigung zum Erstellen von Mitarbeiterkonten.' }, 403)

    const payload = await request.json()
    const username = String(payload.username || '').trim().toLowerCase()
    const fullName = String(payload.full_name || '').trim()
    const role = String(payload.role || 'cashier')
    const password = String(payload.start_password || '')
    const authEmail = `${username}@afterhours.local`
    const ingameNumber = String(payload.ingame_number ?? payload.email ?? '').trim()
    const active = payload.active !== false
    const permissions = Array.isArray(payload.permissions) ? payload.permissions.map(String) : []

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ error: 'Ungültiger Benutzername.' }, 400)
    if (!fullName) return json({ error: 'Der vollständige Name fehlt.' }, 400)
    if (!allowedRoles.has(role)) return json({ error: 'Ungültige Rolle.' }, 400)
    if (['owner', 'administrator'].includes(role) && caller.role !== 'owner') return json({ error: 'Nur ein Inhaber darf Inhaber- oder Administratorkonten erstellen.' }, 403)
    if (password.length < 10) return json({ error: 'Das Startpasswort muss mindestens 10 Zeichen enthalten.' }, 400)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
      app_metadata: { role },
    })
    if (createError || !created.user) return json({ error: createError?.message || 'Benutzer konnte nicht erstellt werden.' }, 400)

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: created.user.id,
      username,
      email: ingameNumber,
      full_name: fullName,
      role,
      permissions,
      active,
      must_change_password: true,
    })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: profileError.message }, 400)
    }

    await adminClient.from('audit_logs').insert({
      employee_id: caller.id,
      employee_name: caller.full_name,
      action: 'employee.created',
      entity_type: 'profile',
      entity_id: created.user.id,
      entity_name: fullName,
      details: `Mitarbeiterkonto ${username} wurde erstellt.`,
      metadata: { role, active },
    })

    return json({ id: created.user.id, username, email: ingameNumber, full_name: fullName, role, active }, 201)
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
