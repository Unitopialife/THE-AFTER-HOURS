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

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Ungültige Sitzung.' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: caller } = await adminClient.from('profiles').select('id,full_name,role,permissions,active,must_change_password').eq('id', userData.user.id).single()
    const canManage = caller?.active && !caller?.must_change_password && (['owner','administrator'].includes(caller.role) || (caller.permissions || []).includes('employees.manage'))
    if (!canManage) return json({ error: 'Keine Berechtigung zum Bearbeiten von Mitarbeiterkonten.' }, 403)

    const payload = await request.json()
    const id = String(payload.id || '')
    const fullName = String(payload.full_name || '').trim()
    const email = String(payload.email || '').trim().toLowerCase()
    const role = String(payload.role || 'cashier')
    const active = payload.active !== false
    const permissions = Array.isArray(payload.permissions) ? payload.permissions.map(String) : []

    if (!id || !fullName || !allowedRoles.has(role)) return json({ error: 'Ungültige Mitarbeiterdaten.' }, 400)
    if (['owner', 'administrator'].includes(role) && caller.role !== 'owner') return json({ error: 'Nur ein Inhaber darf Inhaber- oder Administratorrollen vergeben.' }, 403)
    if (id === caller.id && !active) return json({ error: 'Das eigene Konto kann nicht deaktiviert werden.' }, 400)

    const { data: target, error: targetError } = await adminClient.from('profiles').select('role,email').eq('id', id).single()
    if (targetError) return json({ error: 'Mitarbeiterkonto nicht gefunden.' }, 404)
    if (target.role === 'owner' && caller.role !== 'owner') return json({ error: 'Nur ein Inhaber darf ein Inhaberkonto ändern.' }, 403)

    const contactEmail = email || target.email
    const { error: profileError } = await adminClient.from('profiles').update({ full_name: fullName, email: contactEmail, role, permissions, active }).eq('id', id)
    if (profileError) return json({ error: profileError.message }, 400)

    const authUpdate: Record<string, unknown> = { app_metadata: { role } }
    const { error: authError } = await adminClient.auth.admin.updateUserById(id, authUpdate)
    if (authError) return json({ error: authError.message }, 400)

    await adminClient.from('audit_logs').insert({
      employee_id: caller.id,
      employee_name: caller.full_name,
      action: active ? 'employee.updated' : 'employee.deactivated',
      entity_type: 'profile',
      entity_id: id,
      entity_name: fullName,
      details: `Mitarbeiterkonto wurde ${active ? 'bearbeitet' : 'deaktiviert'}.`,
      metadata: { role, active },
    })

    return json({ id, full_name: fullName, email: contactEmail, role, active })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Interner Serverfehler.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
}
