# Nouvelle Puntos · v0.1

Segundo sistema independiente para Nouvelle. **No modifica ni depende del repositorio actual de sellos**.

## Reglas implementadas
- 1 punto por cada $100 MXN efectivamente pagados.
- Cada punto vale $5 MXN (recompensa equivalente a 5%).
- Puntos con decimales para mantener el 5% exacto.
- Canje máximo del 25% del valor del servicio.
- La parte pagada con puntos no genera nuevos puntos.
- Vigencia: 12 meses desde la última compra que genere puntos.
- Sin límite máximo de acumulación.
- Historial de movimientos y ajustes.

## Archivos
- `index.html` — tarjeta pública de la clienta.
- `admin.html` — panel administrativo.
- `styles.css` — diseño con la paleta oficial Nouvelle.
- `config.js` — configuración y reglas.
- `supabase_schema.sql` — base de datos para un proyecto NUEVO de Supabase.

## Probar sin tocar nada
El proyecto viene con `DEMO_MODE: true`. Abre `index.html` y usa el folio `N-0247`. En `admin.html` pulsa **Entrar al demo**.

Los datos demo se guardan en `localStorage`, solamente en el navegador donde hagas la prueba.

## Publicarlo como segunda página en GitHub Pages
1. Crea un repositorio NUEVO, por ejemplo `nouvelle-puntos`.
2. Sube el contenido de esta carpeta al nuevo repositorio.
3. En GitHub: Settings → Pages → Deploy from a branch → `main` / root.
4. La nueva URL quedaría parecida a `https://TU-USUARIO.github.io/nouvelle-puntos/`.
5. La página anterior `nouvelle-loyalty` permanece intacta.

## Convertirlo en sistema real multi-dispositivo
1. Crea un proyecto NUEVO de Supabase (no reutilices el de sellos si quieres aislamiento total).
2. Abre SQL Editor y ejecuta `supabase_schema.sql`.
3. En Supabase Authentication crea la cuenta de administración.
4. Copia el UUID del usuario y agrégalo a `public.admin_users` con el INSERT indicado al final del SQL.
5. En `config.js` pega la URL y la Publishable/Anon Key del nuevo proyecto.
6. Cambia `DEMO_MODE` a `false`.
7. Pon `PUBLIC_BASE_URL` con la URL de GitHub Pages de este nuevo repositorio.

## Seguridad
La Publishable/Anon Key puede estar en el navegador siempre que las políticas/RPC estén correctamente configuradas. Las tablas están cerradas por RLS; la tarjeta pública obtiene datos mediante funciones de lectura limitada y las operaciones de compra/canje requieren un usuario de Supabase marcado como administrador.

## Siguiente mejora sugerida
- Logo oficial transparente.
- Catálogo de servicios y exclusiones de canje.
- Envío automático del enlace por WhatsApp.
- Aviso de puntos por vencer.
- Exportación de reportes.
