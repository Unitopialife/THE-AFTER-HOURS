/**
 * Öffentliche Frontend-Konfiguration.
 * Der Publishable Key darf im Browser verwendet werden, wenn RLS korrekt eingerichtet ist.
 * NIEMALS den service_role key hier eintragen.
 */
window.AFTER_HOURS_CONFIG = {
  supabaseUrl: '',
  supabasePublishableKey: '',
  demoMode: true,
  currency: 'USD',
  locale: 'de-DE'
};
