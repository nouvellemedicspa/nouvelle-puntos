// Configuración del nuevo sistema Nouvelle Puntos.
// IMPORTANTE: este proyecto es independiente del sistema actual de sellos.
window.NOUVELLE_CONFIG = {
  // Deja DEMO_MODE en true para probar la página sin tocar ninguna base de datos.
  DEMO_MODE: true,

  // Cuando creen un NUEVO proyecto de Supabase para Nouvelle Puntos,
  // pega aquí la URL y la Publishable/Anon Key y cambia DEMO_MODE a false.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Reglas del programa
  POINTS_PER_100: 1,
  POINT_VALUE_MXN: 5,
  MAX_REDEMPTION_PERCENT: 25,
  EXPIRY_MONTHS: 12,

  // URL base cuando publiques el NUEVO repositorio en GitHub Pages.
  // Ejemplo: https://usuario.github.io/nouvelle-puntos/
  PUBLIC_BASE_URL: ""
};
