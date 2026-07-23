/**
 * Öffentliche Frontend-Konfiguration.
 * Der Publishable Key darf im Browser verwendet werden, wenn RLS korrekt eingerichtet ist.
 * NIEMALS den service_role key hier eintragen.
 */
window.AFTER_HOURS_CONFIG = {
  supabaseUrl: 'https://fvtpnmjepvqnnssftyqn.supabase.co',
  supabasePublishableKey: 'sb_publishable_tcaYdJe4Ez9cnarclK4_Kw_G-f0nLHa',
  demoMode: true,
  currency: 'USD',
  locale: 'de-DE'
};
