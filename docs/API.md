# TravelWrap API

> Documento generado automáticamente a partir de `docs/openapi.yaml` con `npm run docs`. No editar a mano: los cambios se perderían. Para modificar la documentación, edita el contrato OpenAPI.

API REST para la gestión de viajes grupales, gastos y tareas.

- **Versión:** 1.0.0
- **URL base:** `http://localhost:3000/api` (Servidor local de desarrollo)
- **Formato:** JSON (`application/json`), salvo donde se indique
- **Errores:** cuerpo `{ "error": { "codigo": "...", "mensaje": "..." } }`

## Resumen de endpoints

| Método | Ruta | Descripción | Acceso |
| --- | --- | --- | --- |
| GET | [`/health`](#get-health) | Comprueba el estado del servidor | Público |
| POST | [`/auth/registro`](#post-authregistro) | Registra un usuario con email y contraseña | Público |
| POST | [`/auth/reenviar-confirmacion`](#post-authreenviar-confirmacion) | Reenvía el correo de confirmación de la cuenta | Público |
| POST | [`/auth/login`](#post-authlogin) | Inicia sesión con email y contraseña | Público |
| POST | [`/auth/refresh`](#post-authrefresh) | Renueva la sesión con el refresh token | Público |
| POST | [`/auth/logout`](#post-authlogout) | Cierra la sesión actual | Token de sesión |
| GET | [`/auth/google`](#get-authgoogle) | Inicia el login con Google (OAuth 2.0 + PKCE) | Público |
| GET | [`/auth/google/callback`](#get-authgooglecallback) | Recibe la respuesta de Google y completa el login | Cookie tw_oauth |
| GET | [`/viajes`](#get-viajes) | Lista los viajes del usuario | Token de sesión |
| POST | [`/viajes`](#post-viajes) | Crea un viaje | Token de sesión |
| GET | [`/viajes/{viajeId}`](#get-viajesviajeid) | Obtiene el detalle de un viaje | Token de sesión |
| PATCH | [`/viajes/{viajeId}`](#patch-viajesviajeid) | Edita los datos de un viaje | Token de sesión |
| DELETE | [`/viajes/{viajeId}`](#delete-viajesviajeid) | Elimina un viaje archivado, solo para ti | Token de sesión |
| POST | [`/viajes/{viajeId}/finalizar`](#post-viajesviajeidfinalizar) | Finaliza un viaje sin archivarlo | Token de sesión |
| POST | [`/viajes/{viajeId}/archivar`](#post-viajesviajeidarchivar) | Archiva un viaje, solo para ti | Token de sesión |
| POST | [`/viajes/{viajeId}/desarchivar`](#post-viajesviajeiddesarchivar) | Desarchiva un viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/abandonar`](#post-viajesviajeidabandonar) | Abandona el viaje | Token de sesión |
| PUT | [`/viajes/{viajeId}/portada`](#put-viajesviajeidportada) | Sube o cambia la foto de portada del viaje | Token de sesión |
| DELETE | [`/viajes/{viajeId}/portada`](#delete-viajesviajeidportada) | Quita la foto de portada del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/mensajes`](#get-viajesviajeidmensajes) | Historial del chat del viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/mensajes`](#post-viajesviajeidmensajes) | Envía un mensaje al chat del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/invitacion`](#get-viajesviajeidinvitacion) | Obtiene el enlace de invitación de un viaje | Token de sesión |
| POST | [`/invitaciones/{token}/unirse`](#post-invitacionestokenunirse) | Une al usuario autenticado al viaje del enlace de invitación | Token de sesión |
| GET | [`/viajes/{viajeId}/votaciones`](#get-viajesviajeidvotaciones) | Lista las votaciones de un viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/votaciones`](#post-viajesviajeidvotaciones) | Crea una votación | Token de sesión |
| GET | [`/viajes/{viajeId}/votaciones/{votacionId}`](#get-viajesviajeidvotacionesvotacionid) | Obtiene una votación con su recuento | Token de sesión |
| POST | [`/viajes/{viajeId}/votaciones/{votacionId}/opciones`](#post-viajesviajeidvotacionesvotacionidopciones) | Propone una opción nueva | Token de sesión |
| PUT | [`/viajes/{viajeId}/votaciones/{votacionId}/voto`](#put-viajesviajeidvotacionesvotacionidvoto) | Vota o cambia el voto | Token de sesión |
| DELETE | [`/viajes/{viajeId}/votaciones/{votacionId}/voto`](#delete-viajesviajeidvotacionesvotacionidvoto) | Retira el voto | Token de sesión |
| POST | [`/viajes/{viajeId}/votaciones/{votacionId}/cerrar`](#post-viajesviajeidvotacionesvotacionidcerrar) | Cierra una votación | Token de sesión |
| GET | [`/direcciones`](#get-direcciones) | Busca una dirección y devuelve sus coordenadas | Token de sesión |
| GET | [`/viajes/{viajeId}/actividades`](#get-viajesviajeidactividades) | Lista las actividades del itinerario de un viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/actividades`](#post-viajesviajeidactividades) | Crea una actividad del itinerario | Token de sesión |
| PUT | [`/viajes/{viajeId}/actividades/orden`](#put-viajesviajeidactividadesorden) | Guarda el orden de las actividades de un día | Token de sesión |
| GET | [`/viajes/{viajeId}/actividades/{actividadId}/foto/url`](#get-viajesviajeidactividadesactividadidfotourl) | Enlace temporal para ver la foto del documento escaneado | Token de sesión |
| PATCH | [`/viajes/{viajeId}/actividades/{actividadId}`](#patch-viajesviajeidactividadesactividadid) | Modifica una actividad del itinerario | Token de sesión |
| DELETE | [`/viajes/{viajeId}/actividades/{actividadId}`](#delete-viajesviajeidactividadesactividadid) | Elimina una actividad del itinerario | Token de sesión |
| GET | [`/viajes/{viajeId}/playlist`](#get-viajesviajeidplaylist) | Devuelve la playlist compartida del viaje | Token de sesión |
| PUT | [`/viajes/{viajeId}/playlist`](#put-viajesviajeidplaylist) | Enlaza o cambia la playlist del viaje | Token de sesión |
| DELETE | [`/viajes/{viajeId}/playlist`](#delete-viajesviajeidplaylist) | Quita la playlist del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/gastos`](#get-viajesviajeidgastos) | Lista el historial de gastos del viaje con el total | Token de sesión |
| POST | [`/viajes/{viajeId}/gastos`](#post-viajesviajeidgastos) | Registra un gasto compartido | Token de sesión |
| GET | [`/viajes/{viajeId}/gastos/balance`](#get-viajesviajeidgastosbalance) | Saldo de cada miembro del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/gastos/liquidacion`](#get-viajesviajeidgastosliquidacion) | Transferencias para saldar las cuentas del viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/gastos/saldadas`](#post-viajesviajeidgastossaldadas) | Marca como saldada la deuda que un miembro tiene con quien usa la app | Token de sesión |
| DELETE | [`/viajes/{viajeId}/gastos/saldadas/{deudorId}`](#delete-viajesviajeidgastossaldadasdeudorid) | Deshace la marca de saldado de una deuda | Token de sesión |
| POST | [`/viajes/{viajeId}/gastos/escaneo`](#post-viajesviajeidgastosescaneo) | Detecta si una foto es un gasto, una actividad u otro documento, y devuelve sus datos | Token de sesión |
| GET | [`/viajes/{viajeId}/gastos/{gastoId}/foto/url`](#get-viajesviajeidgastosgastoidfotourl) | Enlace temporal para ver la foto del ticket | Token de sesión |
| GET | [`/viajes/{viajeId}/gastos/{gastoId}`](#get-viajesviajeidgastosgastoid) | Detalle de un gasto con la parte de cada miembro | Token de sesión |
| PATCH | [`/viajes/{viajeId}/gastos/{gastoId}`](#patch-viajesviajeidgastosgastoid) | Edita un gasto y recalcula su reparto | Token de sesión |
| DELETE | [`/viajes/{viajeId}/gastos/{gastoId}`](#delete-viajesviajeidgastosgastoid) | Borra un gasto y sus repartos | Token de sesión |
| GET | [`/viajes/{viajeId}/documentos`](#get-viajesviajeiddocumentos) | Lista los documentos de la cartera del viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/documentos`](#post-viajesviajeiddocumentos) | Sube un documento a la cartera del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/tareas`](#get-viajesviajeidtareas) | Lista las tareas del viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/tareas`](#post-viajesviajeidtareas) | Añade una tarea a la lista del viaje | Token de sesión |
| PATCH | [`/viajes/{viajeId}/tareas/{tareaId}`](#patch-viajesviajeidtareastareaid) | Edita o marca una tarea | Token de sesión |
| DELETE | [`/viajes/{viajeId}/tareas/{tareaId}`](#delete-viajesviajeidtareastareaid) | Borra una tarea de la lista del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/sello`](#get-viajesviajeidsello) | Consulta el sello que el usuario ha elegido para el viaje | Token de sesión |
| PUT | [`/viajes/{viajeId}/sello`](#put-viajesviajeidsello) | Elige o cambia el sello del viaje | Token de sesión |
| DELETE | [`/viajes/{viajeId}/sello`](#delete-viajesviajeidsello) | Quita el sello del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/puntos-de-interes`](#get-viajesviajeidpuntos-de-interes) | Lista los puntos de interés de un viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/puntos-de-interes`](#post-viajesviajeidpuntos-de-interes) | Añade un punto de interés al mapa del viaje | Token de sesión |
| DELETE | [`/viajes/{viajeId}/puntos-de-interes/{puntoId}`](#delete-viajesviajeidpuntos-de-interespuntoid) | Borra un punto de interés del mapa del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/fotos`](#get-viajesviajeidfotos) | Lista las fotos y los vídeos de la galería del viaje | Token de sesión |
| POST | [`/viajes/{viajeId}/fotos`](#post-viajesviajeidfotos) | Sube una foto o un vídeo a la galería del viaje | Token de sesión |
| DELETE | [`/viajes/{viajeId}/fotos/{fotoId}`](#delete-viajesviajeidfotosfotoid) | Borra una foto o un vídeo de la galería del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/resumen`](#get-viajesviajeidresumen) | Resumen «Fin de viaje» (Wrap) del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/ruta`](#get-viajesviajeidruta) | Calcula la ruta a pie del día entre las actividades con ubicación | Token de sesión |
| POST | [`/viajes/{viajeId}/documentos/texto`](#post-viajesviajeiddocumentostexto) | Guarda en la cartera el resumen en texto de un documento escaneado | Token de sesión |
| DELETE | [`/viajes/{viajeId}/documentos/{documentoId}`](#delete-viajesviajeiddocumentosdocumentoid) | Elimina un documento de la cartera del viaje | Token de sesión |
| GET | [`/viajes/{viajeId}/documentos/{documentoId}/url`](#get-viajesviajeiddocumentosdocumentoidurl) | Obtiene un enlace temporal para abrir o descargar un documento | Token de sesión |
| PATCH | [`/perfil`](#patch-perfil) | Cambia el nombre del perfil | Token de sesión |
| DELETE | [`/perfil`](#delete-perfil) | Elimina la cuenta | Token de sesión |
| PUT | [`/perfil/avatar`](#put-perfilavatar) | Cambia la foto del perfil | Token de sesión |
| DELETE | [`/perfil/avatar`](#delete-perfilavatar) | Quita la foto del perfil | Token de sesión |
| GET | [`/perfil/sellos`](#get-perfilsellos) | Lista los sellos del usuario (pasaporte de viajes) | Token de sesión |
| PATCH | [`/perfil/sellos/{selloId}`](#patch-perfilsellosselloid) | Cambia el diseño de un sello propio | Token de sesión |
| DELETE | [`/perfil/sellos/{selloId}`](#delete-perfilsellosselloid) | Quita un sello propio | Token de sesión |
| GET | [`/notificaciones/clave-publica`](#get-notificacionesclave-publica) | Obtiene la clave pública para las notificaciones push | Token de sesión |
| POST | [`/notificaciones/suscripciones`](#post-notificacionessuscripciones) | Activa las notificaciones push de este dispositivo | Token de sesión |
| DELETE | [`/notificaciones/suscripciones`](#delete-notificacionessuscripciones) | Desactiva las notificaciones push de este dispositivo | Token de sesión |

## General

### GET /health

**Comprueba el estado del servidor**

**Acceso:** Público (no requiere sesión)

**Respuestas**

**200** — Servidor operativo

## Autenticación

### POST /auth/registro

**Registra un usuario con email y contraseña**

Crea la cuenta en Supabase Auth guardando el nombre. El proyecto exige confirmar el email, así que lo normal es que
la respuesta sea `201` con `confirmacion_pendiente: true` (sin tokens): el usuario recibe un correo y, una vez confirmado,
inicia sesión con `POST /auth/login`, momento en el que se crea su fila en `perfiles`.
Si el proyecto no exigiera confirmar el email, la respuesta incluye ya la sesión (`token` y `refresh_token`) y el perfil queda creado.
Si el email ya tiene cuenta confirmada, responde 409. Si la cuenta existe pero no está confirmada, se reenvía el correo de confirmación.

**Acceso:** Público (no requiere sesión)

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `nombre` | string | Sí | Nombre visible. Se guarda en perfiles.nombre | `Daniel` |
| `email` | string (email) | Sí |  | `daniel@travelwrap.app` |
| `password` | string (password) | Sí |  | `MiContraseña123` |

**Respuestas**

**201** — Cuenta creada. Pendiente de confirmar el email, o con sesión iniciada si no se exige confirmación

Cuerpo (`application/json`):

Una de estas variantes:

- **RegistroPendiente**

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `usuario` | Usuario | No |  |  |
| `usuario.id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `usuario.nombre` | string \| null | No | perfiles.nombre. Con Google se toma del nombre de la cuenta la primera vez. Nulo si el usuario aún no tiene perfil | `Daniel` |
| `usuario.email` | string (email) | No | perfiles.email, o el email de Supabase Auth si no hay perfil | `daniel@travelwrap.app` |
| `usuario.avatar_url` | string \| null | No | perfiles.avatar_url. Con Google, la foto de la cuenta | `null` |
| `usuario.creado_en` | string (date-time) | No | perfiles.creado_en, o la fecha de alta en Supabase Auth si no hay perfil | `2026-10-07T18:00:00Z` |
| `confirmacion_pendiente` | enum (true) | No | El usuario debe confirmar su email antes de poder iniciar sesión |  |

- **LoginResponse**

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `usuario` | Usuario | No |  |  |
| `usuario.id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `usuario.nombre` | string \| null | No | perfiles.nombre. Con Google se toma del nombre de la cuenta la primera vez. Nulo si el usuario aún no tiene perfil | `Daniel` |
| `usuario.email` | string (email) | No | perfiles.email, o el email de Supabase Auth si no hay perfil | `daniel@travelwrap.app` |
| `usuario.avatar_url` | string \| null | No | perfiles.avatar_url. Con Google, la foto de la cuenta | `null` |
| `usuario.creado_en` | string (date-time) | No | perfiles.creado_en, o la fecha de alta en Supabase Auth si no hay perfil | `2026-10-07T18:00:00Z` |
| `token` | string | No | JWT de acceso | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `refresh_token` | string | No | Token para renovar la sesión | `v1.MRjcyF2bXh0...` |

**400** — Datos inválidos (nombre vacío o de más de 100 caracteres, email mal formado o contraseña de menos de 8 caracteres)

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El nombre es obligatorio y tiene un máximo de 100 caracteres |
| `datos_invalidos` | El email no es válido |
| `datos_invalidos` | La contraseña debe tener al menos 8 caracteres |

**409** — Ya existe una cuenta con ese email

| Código de error | Mensaje |
| --- | --- |
| `email_en_uso` | Ya existe una cuenta con ese email |

**429** — Demasiados intentos; Supabase limita el envío de correos de confirmación

| Código de error | Mensaje |
| --- | --- |
| `demasiados_intentos` | Demasiados intentos, inténtalo más tarde |

**500** — Error interno del servidor

**502** — Error al comunicarse con el servicio de autenticación

### POST /auth/reenviar-confirmacion

**Reenvía el correo de confirmación de la cuenta**

Para usuarios registrados que aún no han confirmado su email (el login responde 401 `email_no_confirmado`).
Por seguridad responde siempre `202` con el mismo mensaje, exista o no una cuenta pendiente con ese email,
para no revelar qué emails están registrados.

**Acceso:** Público (no requiere sesión)

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `email` | string (email) | Sí |  | `daniel@travelwrap.app` |

**Respuestas**

**202** — Solicitud aceptada. Si hay una cuenta pendiente de confirmar con ese email, recibirá un correo nuevo

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `mensaje` | string | No |  | `Si existe una cuenta pendiente de confirmar con ese email, recibirás un correo de confirmación` |

**400** — Email con formato inválido

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El email no es válido |

**429** — Se han pedido demasiados correos seguidos

| Código de error | Mensaje |
| --- | --- |
| `demasiados_intentos` | Espera un momento antes de volver a pedir el correo |

**500** — Error interno del servidor

**502** — Error al comunicarse con el servicio de autenticación

### POST /auth/login

**Inicia sesión con email y contraseña**

Autentica al usuario mediante Supabase Auth y devuelve el usuario, el token de acceso (JWT) y el refresh token. El token se envía en el resto de peticiones con la cabecera Authorization Bearer.

**Acceso:** Público (no requiere sesión)

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `email` | string (email) | Sí |  | `daniel@travelwrap.app` |
| `password` | string (password) | Sí |  | `MiContraseña123` |

**Respuestas**

**200** — Sesión iniciada correctamente

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `usuario` | Usuario | No |  |  |
| `usuario.id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `usuario.nombre` | string \| null | No | perfiles.nombre. Con Google se toma del nombre de la cuenta la primera vez. Nulo si el usuario aún no tiene perfil | `Daniel` |
| `usuario.email` | string (email) | No | perfiles.email, o el email de Supabase Auth si no hay perfil | `daniel@travelwrap.app` |
| `usuario.avatar_url` | string \| null | No | perfiles.avatar_url. Con Google, la foto de la cuenta | `null` |
| `usuario.creado_en` | string (date-time) | No | perfiles.creado_en, o la fecha de alta en Supabase Auth si no hay perfil | `2026-10-07T18:00:00Z` |
| `token` | string | No | JWT de acceso | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `refresh_token` | string | No | Token para renovar la sesión | `v1.MRjcyF2bXh0...` |

**400** — Datos de entrada inválidos (email con formato incorrecto o contraseña vacía)

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El email no es válido |

**401** — Credenciales incorrectas o email sin confirmar

| Código de error | Mensaje |
| --- | --- |
| `credenciales_invalidas` | Email o contraseña incorrectos |
| `email_no_confirmado` | El email no está confirmado |

**500** — Error interno del servidor

**502** — Error al comunicarse con el servicio de autenticación

### POST /auth/refresh

**Renueva la sesión con el refresh token**

Intercambia un refresh token válido por un nuevo token de acceso y un nuevo refresh token mediante Supabase Auth. Permite mantener la sesión iniciada al volver a abrir la aplicación.

**Acceso:** Público (no requiere sesión)

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `refresh_token` | string | Sí |  | `v1.MRjcyF2bXh0...` |

**Respuestas**

**200** — Sesión renovada correctamente

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `token` | string | No | Nuevo JWT de acceso | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `refresh_token` | string | No | Nuevo refresh token (el anterior deja de ser válido) | `v1.Xk29aPq7...` |

**400** — Falta el refresh_token

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El refresh_token es obligatorio |

**401** — El refresh token ha caducado, ya se ha usado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

**502** — Error al comunicarse con el servicio de autenticación

### POST /auth/logout

**Cierra la sesión actual**

Invalida en Supabase Auth la sesión del dispositivo que hace la petición (alcance `local`): el refresh token deja de servir
y Supabase rechaza el token de acceso. Las sesiones abiertas en otros dispositivos no se tocan.
La PWA llama a este endpoint al confirmar «Cerrar sesión» y, aunque falle, borra siempre la sesión guardada en el navegador.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Respuestas**

**204** — Sesión cerrada. Sin contenido

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

**502** — Error al comunicarse con el servicio de autenticación

| Código de error | Mensaje |
| --- | --- |
| `error_autenticacion` | No se ha podido cerrar la sesión |

### GET /auth/google

**Inicia el login con Google (OAuth 2.0 + PKCE)**

Punto de entrada del botón «Continuar con Google». La PWA navega a esta URL (no es una llamada fetch).
El backend genera el flujo PKCE de Supabase Auth, guarda el verificador en la cookie `tw_oauth`
y redirige a Supabase, que a su vez redirige a la pantalla de consentimiento de Google.
Cuando el usuario acepta, Supabase vuelve a `GET /auth/google/callback`.

**Acceso:** Público (no requiere sesión)

**Respuestas**

**302** — Redirección. Si el flujo se ha podido iniciar, `Location` apunta a
`{SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=...&code_challenge=...&code_challenge_method=s256`
y se envía la cookie `tw_oauth`. Si no, redirige a la PWA con `#error=google`.


| Cabecera | Descripción | Ejemplo |
| --- | --- | --- |
| `Location` | URL de autorización de Supabase, o `{FRONTEND_URL}/auth/callback#error=google` si falla | `https://gbnivsmutqlnqvcrmcvj.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fgoogle%2Fcallback&code_challenge=jpsA5IMF546ZtE29jcPPiDoEWJOAtBkNUOoeGzozmAM&code_challenge_method=s256` |
| `Set-Cookie` | Cookie con el estado PKCE del flujo, codificado en base64url. HttpOnly, SameSite=Lax, Path=/api/auth/google, caduca en 10 minutos | `tw_oauth=eyJzYi1...; Max-Age=600; Path=/api/auth/google; HttpOnly; SameSite=Lax` |

### GET /auth/google/callback

**Recibe la respuesta de Google y completa el login**

URL de vuelta configurada en Supabase (Authentication → URL Configuration → Redirect URLs).
El backend canjea el `code` por la sesión usando el verificador PKCE de la cookie `tw_oauth`, borra la cookie
y, si es el primer acceso del usuario, crea su fila en `perfiles` con el nombre, el email y la foto de Google.
Si ya existía una cuenta con el mismo email verificado, Supabase la vincula al mismo usuario.

El resultado se entrega a la PWA redirigiendo a `{FRONTEND_URL}/auth/callback` con un fragmento (`#`),
que el navegador no envía a ningún servidor:
- Éxito: `#sesion=<base64url de un JSON con el formato de LoginResponse>`
- Usuario cancela en Google: `#error=google_cancelado`
- Cualquier otro fallo (falta la cookie o el código, código inválido o caducado): `#error=google`

**Acceso:** Requiere cookie `tw_oauth`: Estado PKCE del login con Google, creado por GET /auth/google

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `code` | query | No | string | Código de autorización de un solo uso que envía Supabase si el usuario acepta |  |
| `error` | query | No | string | Presente si el usuario cancela o Google rechaza el acceso | `access_denied` |
| `error_description` | query | No | string | Descripción del error enviada por Supabase |  |

**Respuestas**

**302** — Redirección a la PWA con el resultado en el fragmento de la URL. Siempre borra la cookie `tw_oauth`

| Cabecera | Descripción | Ejemplo |
| --- | --- | --- |
| `Location` | `{FRONTEND_URL}/auth/callback#sesion=...`, `#error=google_cancelado` o `#error=google` |  |

## Viajes

### GET /viajes

**Lista los viajes del usuario**

Devuelve los viajes de los que el usuario es miembro activo, del más reciente al más antiguo, con sus miembros.
No incluye los que el usuario ha eliminado (para él ya no existen). Por defecto tampoco los que ha archivado:
se piden con `archivados=true`. El archivado es personal (MEJ-12), no cambia lo que ven los demás miembros.
La PWA los reparte en «Mis viajes»: los activos con destino (tarjeta azul), los activos sin destino
(`pendiente_destino: true`, tarjeta verde) y los finalizados no archivados (viajes anteriores).
Los archivados se piden aparte, para «Viajes archivados».

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `estado` | query | No | enum (activo, finalizado) | Devuelve solo los viajes en ese estado |  |
| `archivados` | query | No | boolean | Por defecto (`false`) devuelve solo los viajes que el usuario no ha archivado. Con `true`, solo los que<br>ha archivado |  |

**Respuestas**

**200** — Viajes del usuario (lista vacía si no tiene ninguno)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `viajes` | array<any> | No |  |  |

**400** — El filtro `estado` o `archivados` no es válido (`estado=archivado` ya no existe)

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El estado debe ser activo o finalizado |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se han podido obtener los viajes |

### POST /viajes

**Crea un viaje**

Crea un viaje activo y añade al usuario como miembro con rol `creador`, en una sola operación.
El nombre y el presupuesto son obligatorios. Las fechas y el destino son opcionales.
Si no se indica destino (`null`, ausente o cadena vacía) el viaje queda **pendiente de destino**
(`pendiente_destino: true`): hasta que el creador fije el destino por votación, solo se podrá votar e invitar.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `nombre` | string \| null | No | Opcional. Sin nombre (ausente, null o vacío), el viaje se llama como su destino y el año de sus fechas («Roma 2027», «Praga 2027-2028» si cruza de año). Sin destino lleva uno temporal («Viaje sin destino 2027») que pasa a ser el del destino cuando se fija por votación. Mientras nadie escriba otro nombre, se vuelve a generar al cambiar el destino o las fechas | `Verano 2027` |
| `presupuesto` | number | Sí | Presupuesto estimado del viaje en su moneda (EUR). Se puede cambiar después | `850` |
| `destino` | string \| null | No | Si es null, está ausente o es una cadena vacía, el viaje queda pendiente de decidir el destino por votación | `Roma` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No | No puede ser anterior a fecha_inicio | `2027-07-08` |

**Respuestas**

**201** — Viaje creado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |

**400** — Datos inválidos

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El nombre debe ser un texto de 100 caracteres como máximo |
| `datos_invalidos` | El presupuesto es obligatorio y debe ser un número entre 0 y 9999999999 |
| `datos_invalidos` | La fecha de fin no puede ser anterior a la de inicio |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido crear el viaje |

### GET /viajes/{viajeId}

**Obtiene el detalle de un viaje**

Devuelve el viaje con su rol para el usuario y sus miembros activos. Solo lo pueden pedir los miembros del viaje.
La PWA usa `pendiente_destino` para decidir qué mostrar al entrar: la votación del destino o el panel del viaje.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Detalle del viaje

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
| `archivado` | boolean | No | true si el usuario que hace la petición ha archivado el viaje. Es personal, los demás miembros lo ven por separado | `false` |
| `miembros` | array<MiembroViaje> | No | Miembros activos del viaje |  |
| `miembros[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `miembros[].nombre` | string \| null | No |  | `Daniel` |
| `miembros[].avatar_url` | string \| null | No |  | `null` |
| `miembros[].rol` | enum (creador, miembro) | No |  | `creador` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido obtener el viaje |

### PATCH /viajes/{viajeId}

**Edita los datos de un viaje**

Cambia el nombre, las fechas, el presupuesto o el destino de un viaje activo (PB-10).
Solo lo puede hacer el creador del viaje. Se envían únicamente los campos que cambian (al menos uno);
los que no se envían se quedan como estaban y los campos desconocidos se ignoran.
Un viaje finalizado es de solo lectura y no se puede editar.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `nombre` | string | No |  | `Roma 2027 (puente de mayo)` |
| `presupuesto` | number | No |  | `950` |
| `destino` | string | No | Se puede cambiar, pero no dejar vacío (no admite null ni cadena vacía) | `Roma` |
| `fecha_inicio` | string (date) \| null | No | null para quitar la fecha | `2027-05-11` |
| `fecha_fin` | string (date) \| null | No | null para quitar la fecha. No puede ser anterior a fecha_inicio (la enviada o la ya guardada) | `2027-05-15` |

**Respuestas**

**200** — Viaje actualizado, con el mismo formato que el detalle

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
| `archivado` | boolean | No | true si el usuario que hace la petición ha archivado el viaje. Es personal, los demás miembros lo ven por separado | `false` |
| `miembros` | array<MiembroViaje> | No | Miembros activos del viaje |  |
| `miembros[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `miembros[].nombre` | string \| null | No |  | `Daniel` |
| `miembros[].avatar_url` | string \| null | No |  | `null` |
| `miembros[].rol` | enum (creador, miembro) | No |  | `creador` |

**400** — El identificador del viaje no es un UUID o los datos no son válidos

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |
| `datos_invalidos` | Indica al menos un dato del viaje que cambiar |
| `datos_invalidos` | El destino no puede quedar vacío |
| `datos_invalidos` | La fecha de fin no puede ser anterior a la de inicio |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**403** — El usuario es miembro del viaje pero no su creador

| Código de error | Mensaje |
| --- | --- |
| `no_creador` | Solo el creador del viaje puede hacerlo |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado y ya no se puede modificar

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido modificar el viaje |

### DELETE /viajes/{viajeId}

**Elimina un viaje archivado, solo para ti**

Elimina el viaje **solo para quien lo pide** (MEJ-12): deja de aparecerle en su cuenta (el detalle responde 404)
y no se puede recuperar desde la app, pero los demás miembros lo siguen viendo igual. Lo puede hacer
cualquier miembro, y solo con un viaje que tenga archivado: la PWA lo ofrece desde «Viajes archivados».
Cuando lo han eliminado todos los miembros que siguen en el viaje, el último lo borra de verdad: se borran sus
documentos y fotos de Supabase Storage y después el viaje con todo lo asociado (miembros, votaciones,
actividades, gastos...), en cascada. Los sellos de cada usuario se conservan. La respuesta es la misma en
ambos casos y no incluye rutas de archivos. Si falla el borrado definitivo, no cambia nada y se puede repetir.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**204** — Viaje eliminado (sin cuerpo)

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o ya lo ha eliminado (las políticas RLS no permiten distinguir los casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El usuario no tiene archivado el viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_archivado` | Solo se pueden eliminar viajes archivados |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido eliminar el viaje |

### POST /viajes/{viajeId}/finalizar

**Finaliza un viaje sin archivarlo**

Pasa el viaje de `activo` a `finalizado` y guarda el momento del cierre en `finalizado_en` (MEJ-12).
Un viaje finalizado es de solo lectura: no se puede editar ni añadir contenido (gastos, tareas...).
Aparece en «Viajes anteriores» de «Mis viajes» y ya no vuelve a estar activo. Después cada miembro puede
archivarlo para sí mismo con `/archivar`.
Solo lo puede hacer el creador del viaje. No se puede deshacer.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Viaje finalizado, con el mismo formato que el detalle

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
| `archivado` | boolean | No | true si el usuario que hace la petición ha archivado el viaje. Es personal, los demás miembros lo ven por separado | `false` |
| `miembros` | array<MiembroViaje> | No | Miembros activos del viaje |  |
| `miembros[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `miembros[].nombre` | string \| null | No |  | `Daniel` |
| `miembros[].avatar_url` | string \| null | No |  | `null` |
| `miembros[].rol` | enum (creador, miembro) | No |  | `creador` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**403** — El usuario es miembro del viaje pero no su creador

| Código de error | Mensaje |
| --- | --- |
| `no_creador` | Solo el creador del viaje puede hacerlo |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje ya estaba finalizado

| Código de error | Mensaje |
| --- | --- |
| `viaje_finalizado` | El viaje ya está finalizado |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido finalizar el viaje |

### POST /viajes/{viajeId}/archivar

**Archiva un viaje, solo para ti**

Archiva el viaje **solo para quien lo pide** (MEJ-12): sale de sus «Viajes anteriores» y aparece en sus
«Viajes archivados» (`archivado: true` en la respuesta). No cambia el estado del viaje, que sigue
`finalizado`, ni lo que ven los demás miembros. Lo puede hacer cualquier miembro y solo con un viaje
finalizado (`/finalizar`).

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Viaje archivado, con el mismo formato que el detalle

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
| `archivado` | boolean | No | true si el usuario que hace la petición ha archivado el viaje. Es personal, los demás miembros lo ven por separado | `false` |
| `miembros` | array<MiembroViaje> | No | Miembros activos del viaje |  |
| `miembros[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `miembros[].nombre` | string \| null | No |  | `Daniel` |
| `miembros[].avatar_url` | string \| null | No |  | `null` |
| `miembros[].rol` | enum (creador, miembro) | No |  | `creador` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o ya lo ha eliminado (las políticas RLS no permiten distinguir los casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje no está finalizado (`viaje_no_finalizado`) o el usuario ya lo tenía archivado (`viaje_archivado`)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_finalizado` | Solo se pueden archivar viajes finalizados |
| `viaje_archivado` | El viaje ya está archivado |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido archivar el viaje |

### POST /viajes/{viajeId}/desarchivar

**Desarchiva un viaje**

Desarchiva el viaje **solo para quien lo pide** (MEJ-12): sale de sus «Viajes archivados» y vuelve a sus
«Viajes anteriores» (`archivado: false` en la respuesta). No cambia el estado del viaje, que sigue
`finalizado` y de solo lectura: nunca vuelve a «En curso». Lo puede hacer cualquier miembro.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Viaje desarchivado, con el mismo formato que el detalle

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
| `archivado` | boolean | No | true si el usuario que hace la petición ha archivado el viaje. Es personal, los demás miembros lo ven por separado | `false` |
| `miembros` | array<MiembroViaje> | No | Miembros activos del viaje |  |
| `miembros[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `miembros[].nombre` | string \| null | No |  | `Daniel` |
| `miembros[].avatar_url` | string \| null | No |  | `null` |
| `miembros[].rol` | enum (creador, miembro) | No |  | `creador` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o ya lo ha eliminado (las políticas RLS no permiten distinguir los casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El usuario no tiene archivado el viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_archivado` | El viaje no está archivado |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido desarchivar el viaje |

### POST /viajes/{viajeId}/abandonar

**Abandona el viaje**

Deja el viaje **para quien lo pide**: deja de ser miembro, pero sus gastos y repartos se conservan (en el balance
aparece como «Antiguo miembro»). Solo puede hacerlo un miembro que no es el creador, con el viaje activo y con su
saldo a cero (lo que ha pagado menos lo que le toca de cada gasto). El creador tiene «Finalizar viaje».
Tras salir se avisa por el socket de votaciones (`motivo: miembros`) para que las votaciones abiertas se actualicen.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**204** — Viaje abandonado (sin cuerpo)

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**403** — El usuario es el creador del viaje, que no puede abandonarlo (tiene «Finalizar viaje»)

| Código de error | Mensaje |
| --- | --- |
| `es_creador` | El creador no puede abandonar el viaje: puede finalizarlo |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir los casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — Dos casos. Con el viaje finalizado (`viaje_no_activo`). Con el saldo del usuario distinto de 0
(`saldo_pendiente`), con su saldo en el mensaje.


| Código de error | Mensaje |
| --- | --- |
| `saldo_pendiente` | Solo puedes abandonar el viaje con el saldo a cero. Tu saldo es de 12.50 € |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido abandonar el viaje |

### PUT /viajes/{viajeId}/portada

**Sube o cambia la foto de portada del viaje**

Sube una foto JPEG o PNG de 5 MB como máximo como portada del viaje. El archivo se guarda en el bucket privado
`portadas` de Supabase Storage, en la carpeta del viaje y con un nombre aleatorio, y su ruta queda en
`viajes.portada_ruta`. Si el viaje ya tenía portada, la nueva la sustituye y el archivo anterior se borra.
Si no se puede registrar, el archivo subido se borra del bucket.

El tipo se reconoce por el contenido del archivo, no por su extensión ni por el tipo que indica el navegador.
La puede cambiar cualquier miembro del viaje (no solo el creador) y solo con el viaje activo. Devuelve el viaje con `portada_url`, una URL
firmada de 1 hora que pueden usar los miembros.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`multipart/form-data`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `archivo` | string (binary) | Sí | JPEG o PNG de 5 MB (5.000.000 bytes) como máximo. Un solo archivo por petición |  |

**Respuestas**

**200** — Portada guardada. Devuelve el viaje actualizado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
| `archivado` | boolean | No | true si el usuario que hace la petición ha archivado el viaje. Es personal, los demás miembros lo ven por separado | `false` |
| `miembros` | array<MiembroViaje> | No | Miembros activos del viaje |  |
| `miembros[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `miembros[].nombre` | string \| null | No |  | `Daniel` |
| `miembros[].avatar_url` | string \| null | No |  | `null` |
| `miembros[].rol` | enum (creador, miembro) | No |  | `creador` |

**400** — Falta el archivo o llega más de uno, el archivo no es un JPEG o PNG, ocupa más de 5 MB o el identificador
del viaje no es un UUID


| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Adjunta la foto de portada en el campo «archivo» |
| `tipo_no_permitido` | La portada tiene que ser una imagen JPEG o PNG |
| `archivo_demasiado_grande` | La portada no puede ocupar más de 5 MB |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase (al subir el archivo o al registrarlo)

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido guardar la portada |

### DELETE /viajes/{viajeId}/portada

**Quita la foto de portada del viaje**

Quita la portada del viaje y borra su archivo del bucket `portadas`. El viaje vuelve a verse con su aspecto de
siempre. Si no tenía portada, no cambia nada. La puede quitar cualquier miembro del viaje y solo con el viaje activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Portada quitada. Devuelve el viaje actualizado, con `portada_url` a null

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Verano 2027` |
| `destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha_inicio` | string (date) \| null | No |  | `2027-07-01` |
| `fecha_fin` | string (date) \| null | No |  | `2027-07-08` |
| `moneda` | string | No |  | `EUR` |
| `presupuesto` | number | No |  | `850` |
| `estado` | enum (activo, finalizado) | No | activo: se puede editar. finalizado: solo lectura y definitivo, no vuelve a activo. Archivar y eliminar<br>son personales y no cambian el estado (ver `archivado` en ViajeDelUsuario) | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `portada_url` | string (uri) \| null | No | URL firmada (dura 1 hora) de la foto de portada del viaje, para los miembros. Null si no tiene portada.<br>La ruta del archivo en Storage no sale del servidor | `null` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
| `archivado` | boolean | No | true si el usuario que hace la petición ha archivado el viaje. Es personal, los demás miembros lo ven por separado | `false` |
| `miembros` | array<MiembroViaje> | No | Miembros activos del viaje |  |
| `miembros[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `miembros[].nombre` | string \| null | No |  | `Daniel` |
| `miembros[].avatar_url` | string \| null | No |  | `null` |
| `miembros[].rol` | enum (creador, miembro) | No |  | `creador` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido quitar la portada |

## Chat

### GET /viajes/{viajeId}/mensajes

**Historial del chat del viaje**

Devuelve hasta 50 mensajes del viaje en orden cronológico (del más antiguo al más reciente), con el nombre y el avatar
de quien los escribió. Sin `antes` devuelve los más recientes; con `antes` (fecha ISO) devuelve los 50 anteriores a esa
fecha, para cargar más historial. Lo pueden leer los miembros del viaje, también en viajes finalizados.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `antes` | query | No | string (date-time) | Fecha ISO. Solo se devuelven los mensajes creados antes de ella | `2026-05-12T10:00:00Z` |

**Respuestas**

**200** — Mensajes del viaje (lista vacía si no hay ninguno)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `mensajes` | array<Mensaje> | No |  |  |
| `mensajes[].id` | string (uuid) | No |  |  |
| `mensajes[].texto` | string | No |  | `¿A qué hora quedamos?` |
| `mensajes[].creado_en` | string (date-time) | No |  |  |
| `mensajes[].autor` | object | No |  |  |
| `mensajes[].autor.usuario_id` | string (uuid) | No |  |  |
| `mensajes[].autor.nombre` | string \| null | No | Nombre del autor (null si ya abandonó el viaje) |  |
| `mensajes[].autor.avatar_url` | string \| null | No |  |  |

**400** — El identificador del viaje o la fecha de `antes` no son válidos

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La fecha de antes no es válida |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_mensaje` | No se han podido obtener los mensajes |

### POST /viajes/{viajeId}/mensajes

**Envía un mensaje al chat del viaje**

Guarda un mensaje del usuario en el chat del viaje. El texto se recorta de espacios sobrantes y tiene que tener entre
1 y 1000 caracteres. Solo con el viaje activo. Después se avisa a los miembros conectados por el namespace `/chat`
con el evento `mensaje` (ver [TIEMPO_REAL.md](TIEMPO_REAL.md)).

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `texto` | string | Sí | Texto del mensaje. Se recortan los espacios de los extremos | `¿A qué hora quedamos?` |

**Respuestas**

**201** — Mensaje guardado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  |  |
| `texto` | string | No |  | `¿A qué hora quedamos?` |
| `creado_en` | string (date-time) | No |  |  |
| `autor` | object | No |  |  |
| `autor.usuario_id` | string (uuid) | No |  |  |
| `autor.nombre` | string \| null | No | Nombre del autor (null si ya abandonó el viaje) |  |
| `autor.avatar_url` | string \| null | No |  |  |

**400** — El texto está vacío o tiene más de 1000 caracteres

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El mensaje debe tener entre 1 y 1000 caracteres |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje no está activo (está finalizado)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_mensaje` | No se ha podido enviar el mensaje |

## Invitaciones

### GET /viajes/{viajeId}/invitacion

**Obtiene el enlace de invitación de un viaje**

Devuelve el enlace permanente para unirse al viaje (RF10). Cada viaje tiene un único token (`viajes.token_invitacion`),
que se genera al crear el viaje y no caduca. Puede pedirlo cualquier miembro activo del viaje.
El código QR se genera en el cliente a partir de `enlace`.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Enlace de invitación del viaje

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `token` | string | No | viajes.token_invitacion | `3f2b8c1d9e7a4f60b5d2c8a1e9f04b37` |
| `enlace` | string (uri) | No | URL completa a compartir, `{FRONTEND_URL}/unirse/{token}`. El QR se genera en el cliente a partir de ella | `http://localhost:5173/unirse/3f2b8c1d9e7a4f60b5d2c8a1e9f04b37` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_invitacion` | No se ha podido obtener el enlace de invitación |

### POST /invitaciones/{token}/unirse

**Une al usuario autenticado al viaje del enlace de invitación**

Registra al usuario de la sesión como miembro del viaje al que pertenece el token (RF11). Es la llamada que hace la PWA
cuando el usuario abre el enlace o escanea el QR, una vez ha iniciado sesión.
- Si el usuario ya era miembro, no cambia nada y responde 200 con `ya_era_miembro: true`.
- Si había abandonado el viaje, se reactiva su pertenencia.
- Si el usuario aún no tenía fila en `perfiles`, se crea con los datos de su cuenta.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `token` | path | Sí | string | Token de invitación del viaje (32 caracteres hexadecimales) | `3f2b8c1d9e7a4f60b5d2c8a1e9f04b37` |

**Respuestas**

**200** — El usuario es miembro del viaje

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `viaje` | object | No |  |  |
| `viaje.id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `viaje.nombre` | string | No |  | `Roma 2025` |
| `viaje.destino` | string \| null | No | Null mientras el destino está pendiente de decidir por votación | `Roma, Italia` |
| `viaje.imagen_portada_url` | string \| null | No |  | `null` |
| `miembro` | object | No |  |  |
| `miembro.rol` | enum (creador, miembro) | No |  | `miembro` |
| `miembro.unido_en` | string (date-time) | No |  | `2026-10-11T16:30:00Z` |
| `ya_era_miembro` | boolean | No | true si el usuario ya pertenecía al viaje antes de esta llamada | `false` |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El token no corresponde a ningún viaje o no tiene el formato esperado

| Código de error | Mensaje |
| --- | --- |
| `invitacion_no_encontrada` | El enlace de invitación no es válido |

**409** — El viaje está finalizado y ya no admite nuevos miembros

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje ya no admite nuevos miembros |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_invitacion` | No se ha podido completar la unión al viaje |

## Votaciones

### GET /viajes/{viajeId}/votaciones

**Lista las votaciones de un viaje**

Devuelve las votaciones del viaje, de la más reciente a la más antigua, cada una con sus opciones,
el recuento de votos, quién ha votado cada opción y el voto del usuario (`mi_voto`).
Solo lo pueden pedir los miembros del viaje. Se pueden filtrar por estado y por tipo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `estado` | query | No | enum (abierta, cerrada) | Solo las votaciones abiertas o solo las cerradas |  |
| `tipo` | query | No | enum (fecha, destino, presupuesto, actividad, otro) | Solo las votaciones de este tipo | `fecha` |

**Respuestas**

**200** — Votaciones del viaje

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `votaciones` | array<Votacion> | No |  |  |
| `votaciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-000000000010` |
| `votaciones[].titulo` | string | No |  | `¿Qué fin de semana salimos?` |
| `votaciones[].descripcion` | string \| null | No |  | `null` |
| `votaciones[].tipo` | enum (fecha, destino, presupuesto, actividad, otro) | No |  | `fecha` |
| `votaciones[].estado` | enum (abierta, cerrada) | No |  | `abierta` |
| `votaciones[].opcion_ganadora_id` | string (uuid) \| null | No | Opción ganadora, que se guarda al cerrar la votación (null mientras está abierta) | `null` |
| `votaciones[].creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `votaciones[].creado_en` | string (date-time) | No |  | `2026-10-20T10:00:00Z` |
| `votaciones[].cerrada_en` | string (date-time) \| null | No |  | `null` |
| `votaciones[].opciones` | array<OpcionVotacion> | No | Opciones en su orden, con el recuento |  |
| `votaciones[].opciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `votaciones[].opciones[].texto` | string | No |  | `Viernes 14` |
| `votaciones[].opciones[].valor_fecha` | string (date) \| null | No |  | `2027-05-14` |
| `votaciones[].opciones[].orden` | integer | No | Posición en la lista; las propuestas nuevas van al final | `0` |
| `votaciones[].opciones[].votos` | integer | No |  | `2` |
| `votaciones[].opciones[].votantes` | array<string (uuid)> | No | Identificadores de los usuarios que han votado esta opción | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc"]` |
| `votaciones[].total_votos` | integer | No |  | `3` |
| `votaciones[].total_miembros` | integer | No | Miembros activos del viaje, es decir, cuántos pueden votar | `4` |
| `votaciones[].todos_han_votado` | boolean | No | true si ya han votado todos los miembros activos. Solo entonces el creador puede cerrarla (RF9) | `false` |
| `votaciones[].mi_voto` | string (uuid) \| null | No | Opción que ha votado el usuario que hace la petición, o null si no ha votado | `6f1c2d3e-0000-4000-8000-0000000000a1` |

**400** — El identificador no es un UUID o un filtro no es válido

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El estado debe ser abierta o cerrada |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_votacion` | No se han podido obtener las votaciones |

### POST /viajes/{viajeId}/votaciones

**Crea una votación**

Crea una votación del viaje y, si se envían, sus opciones iniciales (hasta 20, sin repetir), en una sola operación.
Las opciones son opcionales: se puede crear sin ninguna y que los miembros las propongan después.
La puede crear cualquier miembro mientras el viaje está activo.
No se pueden crear votaciones de destino: la del destino se abre sola al crear un viaje sin destino.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `titulo` | string | Sí |  | `¿Qué fin de semana salimos?` |
| `descripcion` | string \| null | No |  | `null` |
| `tipo` | enum (fecha, presupuesto, actividad, otro) | No | Las de destino no se crean a mano | `fecha` |
| `opciones` | array<NuevaOpcionRequest> | No | Opciones iniciales (opcionales), en el orden en que se mostrarán. No se pueden repetir |  |
| `opciones[].texto` | string | Sí | Se guarda sin espacios a los lados | `Viernes 14` |
| `opciones[].valor_fecha` | string (date) \| null | No | Fecha que representa la opción, en las votaciones de fechas (opcional) | `2027-05-14` |

**Respuestas**

**201** — Votación creada, con el mismo formato que el detalle

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-000000000010` |
| `titulo` | string | No |  | `¿Qué fin de semana salimos?` |
| `descripcion` | string \| null | No |  | `null` |
| `tipo` | enum (fecha, destino, presupuesto, actividad, otro) | No |  | `fecha` |
| `estado` | enum (abierta, cerrada) | No |  | `abierta` |
| `opcion_ganadora_id` | string (uuid) \| null | No | Opción ganadora, que se guarda al cerrar la votación (null mientras está abierta) | `null` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-20T10:00:00Z` |
| `cerrada_en` | string (date-time) \| null | No |  | `null` |
| `opciones` | array<OpcionVotacion> | No | Opciones en su orden, con el recuento |  |
| `opciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `opciones[].texto` | string | No |  | `Viernes 14` |
| `opciones[].valor_fecha` | string (date) \| null | No |  | `2027-05-14` |
| `opciones[].orden` | integer | No | Posición en la lista; las propuestas nuevas van al final | `0` |
| `opciones[].votos` | integer | No |  | `2` |
| `opciones[].votantes` | array<string (uuid)> | No | Identificadores de los usuarios que han votado esta opción | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc"]` |
| `total_votos` | integer | No |  | `3` |
| `total_miembros` | integer | No | Miembros activos del viaje, es decir, cuántos pueden votar | `4` |
| `todos_han_votado` | boolean | No | true si ya han votado todos los miembros activos. Solo entonces el creador puede cerrarla (RF9) | `false` |
| `mi_voto` | string (uuid) \| null | No | Opción que ha votado el usuario que hace la petición, o null si no ha votado | `6f1c2d3e-0000-4000-8000-0000000000a1` |

**400** — Faltan datos, no son válidos o hay opciones repetidas

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Las opciones no se pueden repetir |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_votacion` | No se ha podido crear la votación |

### GET /viajes/{viajeId}/votaciones/{votacionId}

**Obtiene una votación con su recuento**

Devuelve la votación con sus opciones, el recuento, quién ha votado cada opción y el voto del usuario.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `votacionId` | path | Sí | string (uuid) | Identificador de la votación | `6f1c2d3e-0000-4000-8000-000000000010` |

**Respuestas**

**200** — Detalle de la votación

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-000000000010` |
| `titulo` | string | No |  | `¿Qué fin de semana salimos?` |
| `descripcion` | string \| null | No |  | `null` |
| `tipo` | enum (fecha, destino, presupuesto, actividad, otro) | No |  | `fecha` |
| `estado` | enum (abierta, cerrada) | No |  | `abierta` |
| `opcion_ganadora_id` | string (uuid) \| null | No | Opción ganadora, que se guarda al cerrar la votación (null mientras está abierta) | `null` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-20T10:00:00Z` |
| `cerrada_en` | string (date-time) \| null | No |  | `null` |
| `opciones` | array<OpcionVotacion> | No | Opciones en su orden, con el recuento |  |
| `opciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `opciones[].texto` | string | No |  | `Viernes 14` |
| `opciones[].valor_fecha` | string (date) \| null | No |  | `2027-05-14` |
| `opciones[].orden` | integer | No | Posición en la lista; las propuestas nuevas van al final | `0` |
| `opciones[].votos` | integer | No |  | `2` |
| `opciones[].votantes` | array<string (uuid)> | No | Identificadores de los usuarios que han votado esta opción | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc"]` |
| `total_votos` | integer | No |  | `3` |
| `total_miembros` | integer | No | Miembros activos del viaje, es decir, cuántos pueden votar | `4` |
| `todos_han_votado` | boolean | No | true si ya han votado todos los miembros activos. Solo entonces el creador puede cerrarla (RF9) | `false` |
| `mi_voto` | string (uuid) \| null | No | Opción que ha votado el usuario que hace la petición, o null si no ha votado | `6f1c2d3e-0000-4000-8000-0000000000a1` |

**400** — El identificador del viaje o de la votación no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje o de la votación no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o la votación no es de ese viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `votacion_no_encontrada` | La votación no existe en este viaje |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_votacion` | No se ha podido obtener la votación |

### POST /viajes/{viajeId}/votaciones/{votacionId}/opciones

**Propone una opción nueva**

Añade una opción al final de la votación. En la de destino, cada opción es un destino propuesto.
Cualquier miembro puede proponerla mientras la votación está abierta y el viaje activo.
No se puede repetir una opción de la misma votación (sin distinguir mayúsculas ni espacios).

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `votacionId` | path | Sí | string (uuid) | Identificador de la votación | `6f1c2d3e-0000-4000-8000-000000000010` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `texto` | string | Sí | Se guarda sin espacios a los lados | `Viernes 14` |
| `valor_fecha` | string (date) \| null | No | Fecha que representa la opción, en las votaciones de fechas (opcional) | `2027-05-14` |

**Respuestas**

**201** — Votación con la opción añadida y el recuento actualizado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-000000000010` |
| `titulo` | string | No |  | `¿Qué fin de semana salimos?` |
| `descripcion` | string \| null | No |  | `null` |
| `tipo` | enum (fecha, destino, presupuesto, actividad, otro) | No |  | `fecha` |
| `estado` | enum (abierta, cerrada) | No |  | `abierta` |
| `opcion_ganadora_id` | string (uuid) \| null | No | Opción ganadora, que se guarda al cerrar la votación (null mientras está abierta) | `null` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-20T10:00:00Z` |
| `cerrada_en` | string (date-time) \| null | No |  | `null` |
| `opciones` | array<OpcionVotacion> | No | Opciones en su orden, con el recuento |  |
| `opciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `opciones[].texto` | string | No |  | `Viernes 14` |
| `opciones[].valor_fecha` | string (date) \| null | No |  | `2027-05-14` |
| `opciones[].orden` | integer | No | Posición en la lista; las propuestas nuevas van al final | `0` |
| `opciones[].votos` | integer | No |  | `2` |
| `opciones[].votantes` | array<string (uuid)> | No | Identificadores de los usuarios que han votado esta opción | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc"]` |
| `total_votos` | integer | No |  | `3` |
| `total_miembros` | integer | No | Miembros activos del viaje, es decir, cuántos pueden votar | `4` |
| `todos_han_votado` | boolean | No | true si ya han votado todos los miembros activos. Solo entonces el creador puede cerrarla (RF9) | `false` |
| `mi_voto` | string (uuid) \| null | No | Opción que ha votado el usuario que hace la petición, o null si no ha votado | `6f1c2d3e-0000-4000-8000-0000000000a1` |

**400** — El identificador del viaje o de la votación no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje o de la votación no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o la votación no es de ese viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `votacion_no_encontrada` | La votación no existe en este viaje |

**409** — La opción ya existe, el viaje no está activo o la votación está cerrada

| Código de error | Mensaje |
| --- | --- |
| `opcion_duplicada` | Esa opción ya está en la votación |
| `votacion_cerrada` | La votación ya está cerrada |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_votacion` | No se ha podido añadir la opción |

### PUT /viajes/{viajeId}/votaciones/{votacionId}/voto

**Vota o cambia el voto**

Guarda el voto del usuario en la opción indicada. Si ya había votado, lo cambia (un voto por persona).
Solo mientras la votación está abierta y el viaje activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `votacionId` | path | Sí | string (uuid) | Identificador de la votación | `6f1c2d3e-0000-4000-8000-000000000010` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `opcion_id` | string (uuid) | Sí | Opción que vota el usuario. Tiene que ser de esta votación | `6f1c2d3e-0000-4000-8000-0000000000a1` |

**Respuestas**

**200** — Votación con el recuento actualizado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-000000000010` |
| `titulo` | string | No |  | `¿Qué fin de semana salimos?` |
| `descripcion` | string \| null | No |  | `null` |
| `tipo` | enum (fecha, destino, presupuesto, actividad, otro) | No |  | `fecha` |
| `estado` | enum (abierta, cerrada) | No |  | `abierta` |
| `opcion_ganadora_id` | string (uuid) \| null | No | Opción ganadora, que se guarda al cerrar la votación (null mientras está abierta) | `null` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-20T10:00:00Z` |
| `cerrada_en` | string (date-time) \| null | No |  | `null` |
| `opciones` | array<OpcionVotacion> | No | Opciones en su orden, con el recuento |  |
| `opciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `opciones[].texto` | string | No |  | `Viernes 14` |
| `opciones[].valor_fecha` | string (date) \| null | No |  | `2027-05-14` |
| `opciones[].orden` | integer | No | Posición en la lista; las propuestas nuevas van al final | `0` |
| `opciones[].votos` | integer | No |  | `2` |
| `opciones[].votantes` | array<string (uuid)> | No | Identificadores de los usuarios que han votado esta opción | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc"]` |
| `total_votos` | integer | No |  | `3` |
| `total_miembros` | integer | No | Miembros activos del viaje, es decir, cuántos pueden votar | `4` |
| `todos_han_votado` | boolean | No | true si ya han votado todos los miembros activos. Solo entonces el creador puede cerrarla (RF9) | `false` |
| `mi_voto` | string (uuid) \| null | No | Opción que ha votado el usuario que hace la petición, o null si no ha votado | `6f1c2d3e-0000-4000-8000-0000000000a1` |

**400** — Identificadores mal formados, falta la opción o la opción no es de esta votación

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Indica la opción que votas (opcion_id) |
| `opcion_no_valida` | La opción no es de esta votación |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o la votación no es de ese viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `votacion_no_encontrada` | La votación no existe en este viaje |

**409** — El viaje no está activo o la votación ya está cerrada

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |
| `votacion_cerrada` | La votación ya está cerrada |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_votacion` | No se ha podido guardar el voto |

### DELETE /viajes/{viajeId}/votaciones/{votacionId}/voto

**Retira el voto**

Borra el voto del usuario en la votación. Si no había votado, no cambia nada. Solo mientras la votación está abierta.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `votacionId` | path | Sí | string (uuid) | Identificador de la votación | `6f1c2d3e-0000-4000-8000-000000000010` |

**Respuestas**

**200** — Votación con el recuento actualizado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-000000000010` |
| `titulo` | string | No |  | `¿Qué fin de semana salimos?` |
| `descripcion` | string \| null | No |  | `null` |
| `tipo` | enum (fecha, destino, presupuesto, actividad, otro) | No |  | `fecha` |
| `estado` | enum (abierta, cerrada) | No |  | `abierta` |
| `opcion_ganadora_id` | string (uuid) \| null | No | Opción ganadora, que se guarda al cerrar la votación (null mientras está abierta) | `null` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-20T10:00:00Z` |
| `cerrada_en` | string (date-time) \| null | No |  | `null` |
| `opciones` | array<OpcionVotacion> | No | Opciones en su orden, con el recuento |  |
| `opciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `opciones[].texto` | string | No |  | `Viernes 14` |
| `opciones[].valor_fecha` | string (date) \| null | No |  | `2027-05-14` |
| `opciones[].orden` | integer | No | Posición en la lista; las propuestas nuevas van al final | `0` |
| `opciones[].votos` | integer | No |  | `2` |
| `opciones[].votantes` | array<string (uuid)> | No | Identificadores de los usuarios que han votado esta opción | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc"]` |
| `total_votos` | integer | No |  | `3` |
| `total_miembros` | integer | No | Miembros activos del viaje, es decir, cuántos pueden votar | `4` |
| `todos_han_votado` | boolean | No | true si ya han votado todos los miembros activos. Solo entonces el creador puede cerrarla (RF9) | `false` |
| `mi_voto` | string (uuid) \| null | No | Opción que ha votado el usuario que hace la petición, o null si no ha votado | `6f1c2d3e-0000-4000-8000-0000000000a1` |

**400** — El identificador del viaje o de la votación no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje o de la votación no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o la votación no es de ese viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `votacion_no_encontrada` | La votación no existe en este viaje |

**409** — El viaje no está activo o la votación ya está cerrada

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |
| `votacion_cerrada` | La votación ya está cerrada |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_votacion` | No se ha podido retirar el voto |

### POST /viajes/{viajeId}/votaciones/{votacionId}/cerrar

**Cierra una votación**

Cierra la votación y guarda la opción ganadora: la más votada o, si hay empate, una de las empatadas elegida al azar
(la PWA avisa del empate antes de confirmar). Ya no se puede votar ni proponer opciones.
En la votación de destino guarda además el destino ganador en el viaje, en la misma operación: el viaje deja de estar
pendiente de destino.
Solo se puede cerrar cuando han votado todos los miembros activos del viaje (RF9): `todos_han_votado` lo indica.
Solo lo puede hacer el creador del viaje, con el viaje activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `votacionId` | path | Sí | string (uuid) | Identificador de la votación | `6f1c2d3e-0000-4000-8000-000000000010` |

**Respuestas**

**200** — Votación cerrada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `votacion` | Votacion | No |  |  |
| `votacion.id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-000000000010` |
| `votacion.titulo` | string | No |  | `¿Qué fin de semana salimos?` |
| `votacion.descripcion` | string \| null | No |  | `null` |
| `votacion.tipo` | enum (fecha, destino, presupuesto, actividad, otro) | No |  | `fecha` |
| `votacion.estado` | enum (abierta, cerrada) | No |  | `abierta` |
| `votacion.opcion_ganadora_id` | string (uuid) \| null | No | Opción ganadora, que se guarda al cerrar la votación (null mientras está abierta) | `null` |
| `votacion.creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `votacion.creado_en` | string (date-time) | No |  | `2026-10-20T10:00:00Z` |
| `votacion.cerrada_en` | string (date-time) \| null | No |  | `null` |
| `votacion.opciones` | array<OpcionVotacion> | No | Opciones en su orden, con el recuento |  |
| `votacion.opciones[].id` | string (uuid) | No |  | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `votacion.opciones[].texto` | string | No |  | `Viernes 14` |
| `votacion.opciones[].valor_fecha` | string (date) \| null | No |  | `2027-05-14` |
| `votacion.opciones[].orden` | integer | No | Posición en la lista; las propuestas nuevas van al final | `0` |
| `votacion.opciones[].votos` | integer | No |  | `2` |
| `votacion.opciones[].votantes` | array<string (uuid)> | No | Identificadores de los usuarios que han votado esta opción | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc"]` |
| `votacion.total_votos` | integer | No |  | `3` |
| `votacion.total_miembros` | integer | No | Miembros activos del viaje, es decir, cuántos pueden votar | `4` |
| `votacion.todos_han_votado` | boolean | No | true si ya han votado todos los miembros activos. Solo entonces el creador puede cerrarla (RF9) | `false` |
| `votacion.mi_voto` | string (uuid) \| null | No | Opción que ha votado el usuario que hace la petición, o null si no ha votado | `6f1c2d3e-0000-4000-8000-0000000000a1` |
| `hubo_empate` | boolean | No | true si varias opciones empataron con más votos y la ganadora se eligió al azar | `false` |
| `destino` | string \| null | No | Destino guardado en el viaje (solo al cerrar la votación de destino) | `null` |

**400** — El identificador del viaje o de la votación no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje o de la votación no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**403** — El usuario es miembro del viaje pero no su creador

| Código de error | Mensaje |
| --- | --- |
| `no_creador` | Solo el creador del viaje puede cerrar las votaciones |

**404** — El viaje no existe, el usuario no es miembro o la votación no es de ese viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `votacion_no_encontrada` | La votación no existe en este viaje |

**409** — La votación ya está cerrada, el viaje no está activo o todavía no han votado todos los miembros

| Código de error | Mensaje |
| --- | --- |
| `votacion_cerrada` | La votación ya está cerrada |
| `faltan_votos` | La votación solo se puede cerrar cuando hayan votado todos los miembros |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_votacion` | No se ha podido cerrar la votación |

## Direcciones

### GET /direcciones

**Busca una dirección y devuelve sus coordenadas**

Busca el texto en OpenStreetMap (Nominatim) y devuelve hasta 5 lugares con su nombre (corto, título y detalle), coordenadas e identificador,
para que el usuario elija uno al añadir o editar una actividad. Hace falta sesión.
La búsqueda solo se lanza cuando el usuario la pide (no al teclear). Para respetar la política de uso de
OpenStreetMap las llamadas salen de una en una, a razón de una por segundo; un mismo usuario no puede lanzar
dos búsquedas en menos de un segundo y las búsquedas repetidas se sirven de una caché de 10 minutos.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `q` | query | Sí | string | Texto a buscar, de 3 a 200 caracteres | `Colosseo, Roma` |

**Respuestas**

**200** — Lugares encontrados (lista vacía si no hay resultados)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `direcciones` | array<Direccion> | No |  |  |
| `direcciones[].nombre` | string | No | Nombre corto para guardar como ubicación de la actividad (lugar y localidad). Se acorta con … si pasa de 200 caracteres | `Colosseo, Roma` |
| `direcciones[].titulo` | string | No | Nombre del lugar, o calle y número si no tiene nombre propio. Es la línea principal de cada resultado | `Colosseo` |
| `direcciones[].detalle` | string \| null | No | Localidad (o región) y país, para distinguir resultados parecidos. Es la línea secundaria de cada resultado | `Roma, Italia` |
| `direcciones[].latitud` | number | No | Latitud con 6 decimales | `41.890214` |
| `direcciones[].longitud` | number | No | Longitud con 6 decimales | `12.492231` |
| `direcciones[].lugar_externo_id` | string \| null | No | Identificador en OpenStreetMap (tipo/número); null si no lo trae | `way/24146600` |

**400** — Falta el texto de búsqueda o no tiene entre 3 y 200 caracteres

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La búsqueda debe tener entre 3 y 200 caracteres |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**429** — El usuario busca demasiado rápido o hay demasiadas búsquedas en cola

| Código de error | Mensaje |
| --- | --- |
| `demasiadas_busquedas` | Espera un segundo entre una búsqueda y otra |
| `servicio_ocupado` | Hay muchas búsquedas en este momento. Inténtalo de nuevo en unos segundos |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — OpenStreetMap no responde, tarda demasiado o devuelve un error

| Código de error | Mensaje |
| --- | --- |
| `error_geocodificacion` | No se ha podido buscar la dirección |

## Actividades

### GET /viajes/{viajeId}/actividades

**Lista las actividades del itinerario de un viaje**

Devuelve las actividades del viaje ordenadas por día. Dentro de cada día van primero las que tienen hora, por su
hora de inicio (las que empiezan a la misma hora, por su posición `orden`). Las que no tienen hora van al final
del día, por su posición, salvo las que el usuario ha colocado entre las demás con PUT /viajes/{viajeId}/actividades/orden,
que aparecen en el lugar donde las puso. Con `fecha` solo devuelve las de ese día.
Solo lo pueden pedir los miembros del viaje, y también funciona con un viaje finalizado (solo lectura).

Cada actividad incluye `latitud`, `longitud` (números con 6 decimales) y `lugar_externo_id` cuando se eligió su
dirección con GET /direcciones; si no, los tres valen `null`. Con ellas el Itinerario dibuja un marcador por
actividad en el mapa del día; las actividades sin coordenadas no tienen marcador.

No hay notificaciones en tiempo real (WebSocket): para recargar la agenda y el mapa basta con volver a pedir
este listado después de crear, modificar o eliminar una actividad. Siempre refleja el estado actual.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `fecha` | query | No | string (date) | Solo las actividades de este día (AAAA-MM-DD) | `2027-05-12` |

**Respuestas**

**200** — Actividades del viaje (lista vacía si no tiene ninguna)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `actividades` | array<Actividad> | No |  |  |
| `actividades[].tiene_foto` | boolean | No | Si el gasto o la actividad tiene la foto del ticket o documento escaneado. La imagen se pide con GET .../foto/url |  |
| `actividades[].id` | string (uuid) | No |  | `8a1b2c3d-0000-4000-8000-000000000020` |
| `actividades[].viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `actividades[].titulo` | string | No |  | `Visita al Coliseo` |
| `actividades[].descripcion` | string \| null | No |  | `null` |
| `actividades[].fecha` | string (date) | No |  | `2027-05-12` |
| `actividades[].hora_inicio` | string \| null | No | Hora de inicio (HH:MM:SS) | `10:00:00` |
| `actividades[].hora_fin` | string \| null | No | Hora de fin (HH:MM:SS) | `null` |
| `actividades[].orden` | integer | No | Posición dentro del día. La actividad nueva va al final. Un valor negativo (-1 es la primera posición del día,<br>-2 la segunda, etc.) indica una actividad sin hora que el usuario ha colocado entre las demás; el servidor lo<br>asigna al reordenar y no hace falta enviarlo al crear o modificar. | `0` |
| `actividades[].ubicacion_nombre` | string \| null | No |  | `Piazza del Colosseo` |
| `actividades[].latitud` | number \| null | No | Latitud del lugar (null si no se eligió una dirección del buscador) | `41.890214` |
| `actividades[].longitud` | number \| null | No | Longitud del lugar (null si no se eligió una dirección del buscador) | `12.492231` |
| `actividades[].lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap | `way/24146600` |
| `actividades[].categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |
| `actividades[].creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `actividades[].creado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |
| `actividades[].actualizado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |

**400** — El identificador del viaje no es un UUID o la fecha no es válida

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La fecha debe tener el formato AAAA-MM-DD |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_actividad` | No se han podido obtener las actividades |

### POST /viajes/{viajeId}/actividades

**Crea una actividad del itinerario**

Añade una actividad al itinerario del viaje, en el día indicado y al final de las que ya tenga ese día.
La puede crear cualquier miembro mientras el viaje está activo. La ubicación es un texto libre; si se eligió
una dirección con GET /direcciones se envían también sus coordenadas (`latitud` y `longitud`, juntas o ninguna)
y su `lugar_externo_id`.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `foto_ruta` | string \| null | No | Ruta de la foto del ticket o documento escaneado (la devuelve POST /gastos/escaneo). Solo se acepta si es de este viaje |  |
| `titulo` | string | Sí | Nombre de la actividad | `Visita al Coliseo` |
| `fecha` | string (date) | Sí | Día de la actividad (AAAA-MM-DD) | `2027-05-12` |
| `hora_inicio` | string \| null | No | Hora de inicio (HH:MM). Opcional | `10:00` |
| `hora_fin` | string \| null | No | Hora de fin (HH:MM). Opcional; necesita hora de inicio y no puede ser anterior a ella | `12:00` |
| `ubicacion_nombre` | string \| null | No | Lugar o dirección, como texto libre. Opcional | `Piazza del Colosseo` |
| `latitud` | number \| null | No | Latitud del lugar elegido en el buscador. Se envía junto con la longitud o ninguna de las dos. Se guarda con 6 decimales | `41.890214` |
| `longitud` | number \| null | No | Longitud del lugar elegido en el buscador. Se envía junto con la latitud o ninguna de las dos. Se guarda con 6 decimales | `12.492231` |
| `lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap (tipo/número), el que devuelve GET /direcciones. Opcional | `way/24146600` |
| `categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No | Tipo de actividad, para mostrar su icono. Opcional | `cultura` |

**Respuestas**

**201** — Actividad creada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `tiene_foto` | boolean | No | Si el gasto o la actividad tiene la foto del ticket o documento escaneado. La imagen se pide con GET .../foto/url |  |
| `id` | string (uuid) | No |  | `8a1b2c3d-0000-4000-8000-000000000020` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `titulo` | string | No |  | `Visita al Coliseo` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha` | string (date) | No |  | `2027-05-12` |
| `hora_inicio` | string \| null | No | Hora de inicio (HH:MM:SS) | `10:00:00` |
| `hora_fin` | string \| null | No | Hora de fin (HH:MM:SS) | `null` |
| `orden` | integer | No | Posición dentro del día. La actividad nueva va al final. Un valor negativo (-1 es la primera posición del día,<br>-2 la segunda, etc.) indica una actividad sin hora que el usuario ha colocado entre las demás; el servidor lo<br>asigna al reordenar y no hace falta enviarlo al crear o modificar. | `0` |
| `ubicacion_nombre` | string \| null | No |  | `Piazza del Colosseo` |
| `latitud` | number \| null | No | Latitud del lugar (null si no se eligió una dirección del buscador) | `41.890214` |
| `longitud` | number \| null | No | Longitud del lugar (null si no se eligió una dirección del buscador) | `12.492231` |
| `lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap | `way/24146600` |
| `categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |
| `actualizado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |

**400** — Faltan datos, no son válidos o el identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La fecha es obligatoria y debe tener el formato AAAA-MM-DD |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_actividad` | No se ha podido crear la actividad |

### PUT /viajes/{viajeId}/actividades/orden

**Guarda el orden de las actividades de un día**

Recibe todas las actividades de un día en el orden que ha elegido el usuario y guarda las posiciones. Permite
colocar las actividades sin hora donde se quiera (también entre las que tienen hora) y reordenar entre sí las que
empiezan a la misma hora. Las actividades con hora siguen ordenadas por su hora: si el nuevo orden las desordena,
se rechaza con 400.

La lista tiene que contener exactamente las actividades que tiene ahora el día, sin repetir ninguna. Si otro
miembro ha añadido o eliminado alguna mientras tanto, responde 409 y hay que volver a pedir el listado.

Solo la pueden usar los miembros del viaje mientras está activo. Devuelve las actividades del día en su nuevo
orden, con la posición (`orden`) que ha guardado el servidor para cada una.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `fecha` | string (date) | Sí | Día cuyas actividades se reordenan (AAAA-MM-DD) | `2027-05-12` |
| `actividades` | array<string (uuid)> | Sí | Identificadores de todas las actividades de ese día, en el nuevo orden y sin repetir |  |

**Respuestas**

**200** — Orden guardado; actividades del día en su nuevo orden

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `actividades` | array<Actividad> | No |  |  |
| `actividades[].tiene_foto` | boolean | No | Si el gasto o la actividad tiene la foto del ticket o documento escaneado. La imagen se pide con GET .../foto/url |  |
| `actividades[].id` | string (uuid) | No |  | `8a1b2c3d-0000-4000-8000-000000000020` |
| `actividades[].viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `actividades[].titulo` | string | No |  | `Visita al Coliseo` |
| `actividades[].descripcion` | string \| null | No |  | `null` |
| `actividades[].fecha` | string (date) | No |  | `2027-05-12` |
| `actividades[].hora_inicio` | string \| null | No | Hora de inicio (HH:MM:SS) | `10:00:00` |
| `actividades[].hora_fin` | string \| null | No | Hora de fin (HH:MM:SS) | `null` |
| `actividades[].orden` | integer | No | Posición dentro del día. La actividad nueva va al final. Un valor negativo (-1 es la primera posición del día,<br>-2 la segunda, etc.) indica una actividad sin hora que el usuario ha colocado entre las demás; el servidor lo<br>asigna al reordenar y no hace falta enviarlo al crear o modificar. | `0` |
| `actividades[].ubicacion_nombre` | string \| null | No |  | `Piazza del Colosseo` |
| `actividades[].latitud` | number \| null | No | Latitud del lugar (null si no se eligió una dirección del buscador) | `41.890214` |
| `actividades[].longitud` | number \| null | No | Longitud del lugar (null si no se eligió una dirección del buscador) | `12.492231` |
| `actividades[].lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap | `way/24146600` |
| `actividades[].categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |
| `actividades[].creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `actividades[].creado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |
| `actividades[].actualizado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |

**400** — El identificador del viaje no es un UUID, la fecha o la lista de actividades no son válidas, o las actividades con hora no quedan ordenadas por su hora

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La fecha es obligatoria y debe tener el formato AAAA-MM-DD |
| `orden_no_valido` | Las actividades con hora deben seguir ordenadas por su hora; solo se pueden mover las que no tienen hora o empiezan a la misma hora |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado, o la agenda de ese día ha cambiado desde que se pidió el listado

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |
| `agenda_cambiada` | La agenda de ese día ha cambiado. Recárgala para ver las actividades actuales |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_actividad` | No se ha podido guardar el orden de las actividades |

### GET /viajes/{viajeId}/actividades/{actividadId}/foto/url

**Enlace temporal para ver la foto del documento escaneado**

Devuelve un enlace firmado que caduca a los 5 minutos: hay que pedir uno nuevo cada vez que se abre la foto.
Solo existe si la actividad se creó desde un escaneo con foto. También funciona en viajes finalizados.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `actividadId` | path | Sí | string (uuid) |  |  |

**Respuestas**

**200** — Enlace temporal a la foto

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `url` | string (uri) | No |  |  |
| `expira_en` | string (date-time) | No |  |  |

**400** — El identificador del viaje o del la actividad no es un UUID

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o no es miembro (`viaje_no_encontrado`), no existe en el viaje (`actividad_no_encontrada`) o no tiene foto (`sin_foto`)

| Código de error | Mensaje |
| --- | --- |
| `sin_foto` | Este actividad no tiene foto del documento |

**500** — Error interno del servidor

**502** — No se ha podido obtener la foto

### PATCH /viajes/{viajeId}/actividades/{actividadId}

**Modifica una actividad del itinerario**

Cambia solo los campos que se envían (al menos uno). Con `null` se vacían la hora de inicio, la hora de fin,
la ubicación, las coordenadas (`latitud` y `longitud` se envían siempre juntas), el identificador del lugar y
la categoría; el título y la fecha no se pueden vaciar.
La hora de fin necesita una hora de inicio y no puede ser anterior a ella (se comprueba también con las horas
que la actividad ya tiene guardadas). Si se cambia la fecha, la actividad pasa al final de ese día.
La puede modificar cualquier miembro mientras el viaje está activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `actividadId` | path | Sí | string (uuid) | Identificador de la actividad | `8a1b2c3d-0000-4000-8000-000000000020` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `titulo` | string | No |  | `Coliseo y Foro` |
| `fecha` | string (date) | No |  | `2027-05-13` |
| `hora_inicio` | string \| null | No | Hora de inicio (HH:MM). Con null se quita (y entonces la hora de fin también debe quitarse) | `10:00` |
| `hora_fin` | string \| null | No | Hora de fin (HH:MM). Con null se quita | `12:00` |
| `ubicacion_nombre` | string \| null | No |  | `Piazza del Colosseo` |
| `latitud` | number \| null | No | Latitud del lugar elegido en el buscador. Se envía junto con la longitud. Con null (también en la longitud) se quitan las coordenadas | `41.890214` |
| `longitud` | number \| null | No | Longitud del lugar elegido en el buscador. Se envía junto con la latitud. Con null (también en la latitud) se quitan las coordenadas | `12.492231` |
| `lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap (tipo/número), el que devuelve GET /direcciones. Opcional | `way/24146600` |
| `categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |

**Respuestas**

**200** — Actividad modificada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `tiene_foto` | boolean | No | Si el gasto o la actividad tiene la foto del ticket o documento escaneado. La imagen se pide con GET .../foto/url |  |
| `id` | string (uuid) | No |  | `8a1b2c3d-0000-4000-8000-000000000020` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `titulo` | string | No |  | `Visita al Coliseo` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha` | string (date) | No |  | `2027-05-12` |
| `hora_inicio` | string \| null | No | Hora de inicio (HH:MM:SS) | `10:00:00` |
| `hora_fin` | string \| null | No | Hora de fin (HH:MM:SS) | `null` |
| `orden` | integer | No | Posición dentro del día. La actividad nueva va al final. Un valor negativo (-1 es la primera posición del día,<br>-2 la segunda, etc.) indica una actividad sin hora que el usuario ha colocado entre las demás; el servidor lo<br>asigna al reordenar y no hace falta enviarlo al crear o modificar. | `0` |
| `ubicacion_nombre` | string \| null | No |  | `Piazza del Colosseo` |
| `latitud` | number \| null | No | Latitud del lugar (null si no se eligió una dirección del buscador) | `41.890214` |
| `longitud` | number \| null | No | Longitud del lugar (null si no se eligió una dirección del buscador) | `12.492231` |
| `lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap | `way/24146600` |
| `categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |
| `actualizado_en` | string (date-time) | No |  | `2026-10-24T10:00:00Z` |

**400** — No se envía ningún campo, un dato no es válido o los identificadores no son UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La hora de fin necesita una hora de inicio |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o la actividad no es de ese viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `actividad_no_encontrada` | La actividad no existe en este viaje |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_actividad` | No se ha podido modificar la actividad |

### DELETE /viajes/{viajeId}/actividades/{actividadId}

**Elimina una actividad del itinerario**

Borra la actividad para todos los miembros del viaje. La puede borrar cualquier miembro mientras el viaje
está activo. Responde 204 sin cuerpo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `actividadId` | path | Sí | string (uuid) | Identificador de la actividad | `8a1b2c3d-0000-4000-8000-000000000020` |

**Respuestas**

**204** — Actividad eliminada

**400** — Los identificadores no son UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje o de la actividad no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o la actividad no es de ese viaje

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `actividad_no_encontrada` | La actividad no existe en este viaje |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_actividad` | No se ha podido eliminar la actividad |

## Playlist

### GET /viajes/{viajeId}/playlist

**Devuelve la playlist compartida del viaje**

La playlist es un enlace de Spotify que todos los miembros ven en el inicio del viaje. Devuelve `playlist: null` si el
viaje no tiene ninguna. Sirve también en viajes finalizados.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Playlist del viaje, o null si no tiene ninguna

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `playlist` | object \| null | Sí | Playlist del viaje, o null si no tiene ninguna |  |
| `playlist.url` | string (uri) | Sí |  | `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` |
| `playlist.actualizado_en` | string (date-time) | Sí |  | `2026-11-22T10:00:00Z` |

**400** — El identificador del viaje no es un UUID

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

**500** — Error interno del servidor

**502** — No se ha podido obtener la playlist

### PUT /viajes/{viajeId}/playlist

**Enlaza o cambia la playlist del viaje**

Cualquier miembro puede enlazar o cambiar la playlist, con el viaje activo. El enlace tiene que ser de una playlist de
Spotify (`https://open.spotify.com/playlist/...`, también con `intl-es` o `?si=...`, o `spotify:playlist:...`). La API lo
guarda en su forma canónica.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `url` | string | Sí | Enlace de una playlist de Spotify (web o spotify:playlist:...) | `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` |

**Respuestas**

**200** — Playlist guardada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `playlist` | object \| null | Sí | Playlist del viaje, o null si no tiene ninguna |  |
| `playlist.url` | string (uri) | Sí |  | `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` |
| `playlist.actualizado_en` | string (date-time) | Sí |  | `2026-11-22T10:00:00Z` |

**400** — El enlace no es de una playlist de Spotify, o el identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El enlace tiene que ser de una playlist de Spotify (por ejemplo, https://open.spotify.com/playlist/...) |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

**409** — El viaje está finalizado y ya no se puede modificar

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

**502** — No se ha podido guardar la playlist

### DELETE /viajes/{viajeId}/playlist

**Quita la playlist del viaje**

Cualquier miembro puede quitarla, con el viaje activo. Responde 204 sin cuerpo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**204** — Playlist quitada (sin cuerpo)

**400** — El identificador del viaje no es un UUID

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

**409** — El viaje está finalizado y ya no se puede modificar

**500** — Error interno del servidor

**502** — No se ha podido quitar la playlist

## Gastos

### GET /viajes/{viajeId}/gastos

**Lista el historial de gastos del viaje con el total**

Devuelve los gastos del viaje del más reciente al más antiguo (por fecha y, en el mismo día, por la hora a
la que se registraron), cada uno con la parte de cada participante, y el total gastado, sumado en céntimos.
Solo lo pueden pedir los miembros del viaje. También funciona en viajes finalizados, porque
solo lee.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Historial de gastos y total (lista vacía y total 0 si el viaje aún no tiene gastos)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `gastos` | array<Gasto> | No | Gastos del viaje, del más reciente al más antiguo |  |
| `gastos[].tiene_foto` | boolean | No | Si el gasto o la actividad tiene la foto del ticket o documento escaneado. La imagen se pide con GET .../foto/url |  |
| `gastos[].id` | string (uuid) | No |  | `9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c` |
| `gastos[].viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `gastos[].concepto` | string | No |  | `Cena en el Trastevere` |
| `gastos[].importe` | number | No |  | `60.5` |
| `gastos[].categoria` | enum (comida, transporte, entradas, alojamiento, ocio, otros) | No |  | `comida` |
| `gastos[].pagado_por` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `gastos[].fecha` | string (date) | No |  | `2027-05-12` |
| `gastos[].creado_por` | string (uuid) \| null | No | Quién registró el gasto (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `gastos[].creado_en` | string (date-time) | No |  | `2026-10-28T10:00:00Z` |
| `gastos[].actualizado_en` | string (date-time) | No |  | `2026-10-28T10:00:00Z` |
| `gastos[].repartos` | array<RepartoGasto> | No | Parte de cada participante; suman el importe del gasto | `[{"usuario_id":"df77cba6-4be5-4cbc-814b-1e228dd73dcc","importe":30.25},{"usuario_id":"5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f","importe":30.25}]` |
| `gastos[].repartos[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `gastos[].repartos[].importe` | number | No | Parte del gasto que le corresponde a este miembro | `30.25` |
| `total` | number | No | Suma de los importes de todos los gastos del viaje | `107.84` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se han podido obtener los gastos |

### POST /viajes/{viajeId}/gastos

**Registra un gasto compartido**

Registra un gasto del viaje y lo reparte entre los participantes indicados a partes iguales en una única
operación (función SQL `crear_gasto`): si falla una parte, no se guarda nada. Se calcula en céntimos y los que
sobran se asignan a los primeros participantes para que el total siempre sume el importe introducido.

Cualquier miembro puede registrar un gasto mientras el viaje esté activo. El pagador y los participantes deben
ser miembros; quien hace la petición queda marcado como `creado_por`.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `foto_ruta` | string \| null | No | Ruta de la foto del ticket o documento escaneado (la devuelve POST /gastos/escaneo). Solo se acepta si es de este viaje |  |
| `concepto` | string | Sí | Qué se ha pagado. Se guardan sin los espacios del principio y del final | `Cena en el Trastevere` |
| `importe` | number | Sí | Importe total en la moneda del viaje, mayor que 0 y con dos decimales como máximo | `60.5` |
| `categoria` | enum (comida, transporte, entradas, alojamiento, ocio, otros) \| null | No | Tipo de gasto. Opcional; si no se envía se guarda «otros» | `comida` |
| `pagado_por` | string (uuid) | Sí | Miembro del viaje que ha pagado | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `fecha` | string (date) \| null | No | Día del gasto (AAAA-MM-DD). Opcional; si no se envía se guarda la fecha de hoy | `2027-05-12` |
| `participantes` | array<string (uuid)> | Sí | Miembros del viaje entre los que se divide el gasto a partes iguales, sin repetir ninguno | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc","5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f"]` |

**Respuestas**

**201** — Gasto registrado, con la parte de cada participante

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `tiene_foto` | boolean | No | Si el gasto o la actividad tiene la foto del ticket o documento escaneado. La imagen se pide con GET .../foto/url |  |
| `id` | string (uuid) | No |  | `9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `concepto` | string | No |  | `Cena en el Trastevere` |
| `importe` | number | No |  | `60.5` |
| `categoria` | enum (comida, transporte, entradas, alojamiento, ocio, otros) | No |  | `comida` |
| `pagado_por` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `fecha` | string (date) | No |  | `2027-05-12` |
| `creado_por` | string (uuid) \| null | No | Quién registró el gasto (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-28T10:00:00Z` |
| `actualizado_en` | string (date-time) | No |  | `2026-10-28T10:00:00Z` |
| `repartos` | array<RepartoGasto> | No | Parte de cada participante; suman el importe del gasto | `[{"usuario_id":"df77cba6-4be5-4cbc-814b-1e228dd73dcc","importe":30.25},{"usuario_id":"5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f","importe":30.25}]` |
| `repartos[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `repartos[].importe` | number | No | Parte del gasto que le corresponde a este miembro | `30.25` |

**400** — Faltan datos o no son válidos, el identificador del viaje no es un UUID, o quien paga o algún
participante no es miembro del viaje


| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El importe debe ser un número mayor que 0 con dos decimales como máximo |
| `datos_invalidos` | Quien paga y los participantes tienen que ser miembros del viaje |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se ha podido registrar el gasto |

### GET /viajes/{viajeId}/gastos/balance

**Saldo de cada miembro del viaje**

Devuelve, para cada miembro, lo que ha pagado, su parte de los gastos y su saldo (lo pagado menos su parte):
positivo, le deben; negativo, debe. Se calcula en céntimos a partir de los gastos y sus repartos, así que
siempre está al día y la suma de todos los saldos es 0.
Salen primero los miembros actuales, en el orden del viaje, y después quien abandonó el viaje con gastos,
sin nombre. Solo lo pueden pedir los miembros del viaje; también funciona en viajes finalizados.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Saldo de cada miembro (todos a 0 si el viaje aún no tiene gastos)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `saldos` | array<SaldoMiembro> | No | Un saldo por miembro; entre todos suman 0 | `[{"usuario_id":"df77cba6-4be5-4cbc-814b-1e228dd73dcc","nombre":"Adriana","pagado":10,"parte":6.34,"saldo":3.66},{"usuario_id":"5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f","nombre":"Berta","pagado":6,"parte":6.33,"saldo":-0.33},{"usuario_id":"8c4d2e1f-3a5b-4c6d-9e7f-1a2b3c4d5e6f","nombre":"Daniel","pagado":0,"parte":3.33,"saldo":-3.33}]` |
| `saldos[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `saldos[].nombre` | string \| null | No | Nombre del miembro (null si ya abandonó el viaje) | `Adriana` |
| `saldos[].pagado` | number | No | Suma de los gastos que ha pagado | `10` |
| `saldos[].parte` | number | No | Suma de sus partes en los repartos de los gastos | `6.34` |
| `saldos[].saldo` | number | No | Lo pagado menos su parte. Positivo, le deben; negativo, debe | `3.66` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se ha podido calcular el balance |

### GET /viajes/{viajeId}/gastos/liquidacion

**Transferencias para saldar las cuentas del viaje**

Propone el plan mínimo de transferencias para dejar todos los saldos del viaje a 0. Se calcula en céntimos
a partir del balance: primero empareja los saldos iguales de signo contrario y después la mayor deuda con el
mayor saldo a favor, así que salen como mucho n − 1 transferencias para n miembros con saldo.
Cada transferencia indica quién paga, a quién y cuánto, con los nombres de los miembros; quien ya abandonó el
viaje aparece sin nombre. Con todo saldado devuelve una lista vacía.
Las deudas marcadas como saldadas (`POST /gastos/saldadas`) cuentan como pagadas, así que ya no aparecen aquí.
Solo lo pueden pedir los miembros del viaje; también funciona en viajes finalizados, porque solo lee.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Transferencias para saldar el viaje (lista vacía si todo está saldado)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `transferencias` | array<Transferencia> | No | Transferencias para dejar todos los saldos a 0; vacía si el viaje ya está saldado |  |
| `transferencias[].de` | string (uuid) | No | Miembro que paga | `5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f` |
| `transferencias[].de_nombre` | string \| null | No | Nombre de quien paga (null si ya abandonó el viaje) | `Berta` |
| `transferencias[].a` | string (uuid) | No | Miembro que recibe | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `transferencias[].a_nombre` | string \| null | No | Nombre de quien recibe (null si ya abandonó el viaje) | `Adriana` |
| `transferencias[].importe` | number | No | Cuánto paga, en euros con dos decimales | `6.34` |
| `saldadas` | array<object> | No | Deudas marcadas como saldadas (el importe ya cuenta como pagado). Quien recibe el dinero puede deshacer la marca | `[{"de":"5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f","de_nombre":"Berta","a":"df77cba6-4be5-4cbc-814b-1e228dd73dcc","a_nombre":"Adriana","importe":0.33},{"de":"8c4d2e1f-3a5b-4c6d-9e7f-1a2b3c4d5e6f","de_nombre":"Daniel","a":"df77cba6-4be5-4cbc-814b-1e228dd73dcc","a_nombre":"Adriana","importe":3.33}]` |
| `saldadas[].de` | string (uuid) | No | Miembro que debía el dinero |  |
| `saldadas[].de_nombre` | string \| null | No | Nombre del miembro (null si ya abandonó el viaje) |  |
| `saldadas[].a` | string (uuid) | No | Miembro que recibía el dinero |  |
| `saldadas[].a_nombre` | string \| null | No | Nombre del miembro (null si ya abandonó el viaje) |  |
| `saldadas[].importe` | number | No | Importe marcado como saldado, en euros |  |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se ha podido calcular la liquidación |

### POST /viajes/{viajeId}/gastos/saldadas

**Marca como saldada la deuda que un miembro tiene con quien usa la app**

Solo lo puede hacer quien recibe el dinero: marca como saldada la transferencia de `de_usuario_id` a quien hace la
petición, por el `importe` que todavía debe según la liquidación. No crea ningún gasto ni aparece en el historial:
el balance y la liquidación cuentan el importe como si se hubiera pagado. Si ya había una deuda saldada de ese
miembro, se suma. Solo con el viaje activo.
Si el importe ya no coincide con la deuda actual (por ejemplo, porque se ha registrado otro gasto), responde 409
`deuda_cambiada` y no cambia nada: hay que volver a pedir la liquidación.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `de_usuario_id` | string (uuid) | Sí | Miembro que debe el dinero |  |
| `importe` | number | Sí | Importe de la deuda en euros, con dos decimales como máximo |  |

**Respuestas**

**204** — Deuda marcada como saldada (sin cuerpo)

**400** — Falta el miembro o el importe no es válido (mayor que 0 y con dos decimales como máximo)

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El importe debe ser un número mayor que 0 con dos decimales como máximo |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje no está activo (`viaje_no_activo`) o el importe ya no es la deuda actual (`deuda_cambiada`)

| Código de error | Mensaje |
| --- | --- |
| `deuda_cambiada` | La deuda ha cambiado: actualiza la liquidación antes de marcarla |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se ha podido marcar la deuda como saldada |

### DELETE /viajes/{viajeId}/gastos/saldadas/{deudorId}

**Deshace la marca de saldado de una deuda**

Solo la puede deshacer quien la marcó (quien recibe el dinero), con el viaje activo. Los saldos y la liquidación
vuelven a contar la deuda por el importe que quedaba.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `deudorId` | path | Sí | string (uuid) | Miembro que debe el dinero |  |

**Respuestas**

**204** — Marca deshecha (sin cuerpo)

**400** — El identificador del viaje o del miembro no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El miembro no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o no hay ninguna deuda saldada de ese miembro que deshacer (`deuda_no_encontrada`)

| Código de error | Mensaje |
| --- | --- |
| `deuda_no_encontrada` | No hay ninguna deuda saldada que deshacer |

**409** — El viaje no está activo

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se ha podido deshacer la marca |

### POST /viajes/{viajeId}/gastos/escaneo

**Detecta si una foto es un gasto, una actividad u otro documento, y devuelve sus datos**

Lee con OCR la foto de un documento (JPEG o PNG, en el campo `archivo`) y detecta su tipo:
- `gasto`: un ticket de compra (tiene un total, IVA, factura o un importe en euros). Devuelve el `concepto` y el `importe`.
- `actividad`: una reserva, entrada, vuelo o cita (tiene fecha, hora o palabras como «reserva» o «entrada»). Devuelve el
  `titulo`, la `fecha` y la `hora_inicio`.
- `otro`: cualquier otro documento. Devuelve un `resumen` del texto que se ha leído.

Con pistas insuficientes o empatadas el tipo es `otro`, para no crear un gasto o una actividad equivocados.
`fecha` es `null` si el documento no trae el año, porque entonces no se puede saber a qué fecha corresponde, y
cualquier campo que no se reconoce también es `null`.

La petición no guarda nada: la app muestra los datos en la pantalla de confirmación del tipo detectado, el usuario
los revisa o corrige, y solo entonces se crea el gasto (`POST /gastos`), la actividad o el documento de resumen.
Solo lee, así que también funciona en viajes finalizados. Hace falta ser miembro del viaje.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`multipart/form-data`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `archivo` | string (binary) | Sí | Foto de un documento en JPEG o PNG de 8 MB (8.000.000 bytes) como máximo. Un solo archivo por petición |  |

**Respuestas**

**200** — Tipo detectado y sus datos

Cuerpo (`application/json`):

Una de estas variantes:

- **EscaneoGasto**

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `foto_ruta` | string \| null | No | Ruta de la foto guardada con el gasto o la actividad. Es null si no se guarda foto (un resumen de texto no la necesita, ni los datos que no se han podido guardar) |  |
| `tipo` | enum (gasto) | Sí |  |  |
| `datos` | object | Sí |  |  |
| `datos.concepto` | string \| null | Sí | Nombre del comercio o del gasto, tal como aparece en el ticket | `RESTAURANTE EL FARO` |
| `datos.importe` | number \| null | Sí | Total del ticket en euros (la línea de «total», o el mayor importe si no hay ninguna) | `11.5` |

- **EscaneoActividad**

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `foto_ruta` | string \| null | No | Ruta de la foto guardada con el gasto o la actividad. Es null si no se guarda foto (un resumen de texto no la necesita, ni los datos que no se han podido guardar) |  |
| `tipo` | enum (actividad) | Sí |  |  |
| `datos` | object | Sí |  |  |
| `datos.titulo` | string \| null | Sí | Título de la actividad, tomado de la primera línea del documento | `Vuelo Madrid a Roma IB3456` |
| `datos.fecha` | string (date) \| null | Sí | Fecha en AAAA-MM-DD. Es null si el documento no trae el año o la fecha no existe | `2027-05-12` |
| `datos.hora_inicio` | string \| null | Sí | Hora de inicio en HH:MM (también se admite 10h30 en el documento) | `08:20` |

- **EscaneoOtro**

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `foto_ruta` | string \| null | No | Ruta de la foto guardada con el gasto o la actividad. Es null si no se guarda foto (un resumen de texto no la necesita, ni los datos que no se han podido guardar) |  |
| `tipo` | enum (otro) | Sí |  |  |
| `datos` | object | Sí |  |  |
| `datos.resumen` | string | Sí | Texto que se ha leído en el documento, con sus líneas, recortado a 1000 caracteres. Vacío si el OCR no ha leído nada | `Póliza de seguro<br>Cobertura total durante el viaje` |

**400** — Falta el archivo o llega más de uno, el archivo no es un JPEG o PNG, ocupa más de 8 MB o el identificador del
viaje no es un UUID


| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Adjunta la foto del ticket en el campo «archivo» |
| `tipo_no_permitido` | Solo se pueden escanear fotos JPEG o PNG |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

**502** — No se ha podido leer el viaje (`error_gasto`) o el OCR ha fallado al leer la imagen (`error_ocr`)

| Código de error | Mensaje |
| --- | --- |
| `error_ocr` | No se ha podido leer el ticket |

### GET /viajes/{viajeId}/gastos/{gastoId}/foto/url

**Enlace temporal para ver la foto del ticket**

Devuelve un enlace firmado que caduca a los 5 minutos: hay que pedir uno nuevo cada vez que se abre la foto.
Solo existe si el gasto se creó desde un escaneo con foto. También funciona en viajes finalizados.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `gastoId` | path | Sí | string (uuid) |  |  |

**Respuestas**

**200** — Enlace temporal a la foto

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `url` | string (uri) | No |  |  |
| `expira_en` | string (date-time) | No |  |  |

**400** — El identificador del viaje o del gasto no es un UUID

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o no es miembro (`viaje_no_encontrado`), no existe en el viaje (`gasto_no_encontrado`) o no tiene foto (`sin_foto`)

| Código de error | Mensaje |
| --- | --- |
| `sin_foto` | Este gasto no tiene foto del ticket |

**500** — Error interno del servidor

**502** — No se ha podido obtener la foto

### GET /viajes/{viajeId}/gastos/{gastoId}

**Detalle de un gasto con la parte de cada miembro**

Devuelve el gasto con su importe, quién pagó, la categoría, la fecha y el reparto. Cada parte trae el nombre
del miembro; quien ya abandonó el viaje sale sin nombre y con `abandonado: true`.
Solo lo pueden pedir los miembros del viaje. Si el gasto no existe o es de otro viaje, responde 404.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `gastoId` | path | Sí | string (uuid) | Identificador del gasto | `9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c` |

**Respuestas**

**200** — Gasto con el nombre y la parte de cada miembro

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `concepto` | string | No |  | `Cena en el Trastevere` |
| `importe` | number | No |  | `60.5` |
| `categoria` | enum (comida, transporte, entradas, alojamiento, ocio, otros) | No |  | `comida` |
| `pagado_por` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `fecha` | string (date) | No |  | `2027-05-12` |
| `creado_por` | string (uuid) \| null | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  |  |
| `actualizado_en` | string (date-time) | No |  |  |
| `repartos` | array<RepartoDetalle> | No |  |  |
| `repartos[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `repartos[].nombre` | string \| null | No | Nombre del miembro (null si ya abandonó el viaje) | `Adriana` |
| `repartos[].abandonado` | boolean | No | true si el miembro ya abandonó el viaje | `false` |
| `repartos[].importe` | number | No | Parte del gasto que le corresponde a este miembro | `30.25` |

**400** — El identificador del viaje o del gasto no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del gasto no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro, o el gasto no existe o es de otro viaje

| Código de error | Mensaje |
| --- | --- |
| `gasto_no_encontrado` | El gasto no existe o no pertenece a este viaje |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se ha podido obtener el gasto |

### PATCH /viajes/{viajeId}/gastos/{gastoId}

**Edita un gasto y recalcula su reparto**

Actualiza el gasto con los mismos datos que al crearlo (concepto, importe, categoría, quién pagó, fecha y
participantes) y vuelve a repartirlo a partes iguales, en céntimos. El balance y la liquidación se recalculan
solos, porque salen de los repartos.
Solo pueden editarlo quien registró el gasto y el creador del viaje, y solo mientras el viaje está activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `gastoId` | path | Sí | string (uuid) | Identificador del gasto | `9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `foto_ruta` | string \| null | No | Ruta de la foto del ticket o documento escaneado (la devuelve POST /gastos/escaneo). Solo se acepta si es de este viaje |  |
| `concepto` | string | Sí | Qué se ha pagado. Se guardan sin los espacios del principio y del final | `Cena en el Trastevere` |
| `importe` | number | Sí | Importe total en la moneda del viaje, mayor que 0 y con dos decimales como máximo | `60.5` |
| `categoria` | enum (comida, transporte, entradas, alojamiento, ocio, otros) \| null | No | Tipo de gasto. Opcional; si no se envía se guarda «otros» | `comida` |
| `pagado_por` | string (uuid) | Sí | Miembro del viaje que ha pagado | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `fecha` | string (date) \| null | No | Día del gasto (AAAA-MM-DD). Opcional; si no se envía se guarda la fecha de hoy | `2027-05-12` |
| `participantes` | array<string (uuid)> | Sí | Miembros del viaje entre los que se divide el gasto a partes iguales, sin repetir ninguno | `["df77cba6-4be5-4cbc-814b-1e228dd73dcc","5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f"]` |

**Respuestas**

**200** — Gasto editado, con su nuevo reparto

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `tiene_foto` | boolean | No | Si el gasto o la actividad tiene la foto del ticket o documento escaneado. La imagen se pide con GET .../foto/url |  |
| `id` | string (uuid) | No |  | `9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `concepto` | string | No |  | `Cena en el Trastevere` |
| `importe` | number | No |  | `60.5` |
| `categoria` | enum (comida, transporte, entradas, alojamiento, ocio, otros) | No |  | `comida` |
| `pagado_por` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `fecha` | string (date) | No |  | `2027-05-12` |
| `creado_por` | string (uuid) \| null | No | Quién registró el gasto (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-10-28T10:00:00Z` |
| `actualizado_en` | string (date-time) | No |  | `2026-10-28T10:00:00Z` |
| `repartos` | array<RepartoGasto> | No | Parte de cada participante; suman el importe del gasto | `[{"usuario_id":"df77cba6-4be5-4cbc-814b-1e228dd73dcc","importe":30.25},{"usuario_id":"5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f","importe":30.25}]` |
| `repartos[].usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `repartos[].importe` | number | No | Parte del gasto que le corresponde a este miembro | `30.25` |

**400** — Datos no válidos, identificador no UUID, o quien paga o un participante no es miembro

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El importe debe ser un número mayor que 0 con dos decimales como máximo |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**403** — Quien edita no registró el gasto ni es el creador del viaje

| Código de error | Mensaje |
| --- | --- |
| `sin_permiso` | Solo puede editar el gasto quien lo registró o el creador del viaje |

**404** — El viaje no existe o el usuario no es miembro, o el gasto no existe o es de otro viaje

| Código de error | Mensaje |
| --- | --- |
| `gasto_no_encontrado` | El gasto no existe o no pertenece a este viaje |

**409** — El viaje está finalizado o archivado

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se han podido guardar los cambios del gasto |

### DELETE /viajes/{viajeId}/gastos/{gastoId}

**Borra un gasto y sus repartos**

Borra el gasto y, en cascada, sus repartos: el total, el balance y la liquidación dejan de contarlo.
Solo pueden borrarlo quien registró el gasto y el creador del viaje, y solo mientras el viaje está activo.
Quien no puede borrarlo recibe el mismo 404 que si el gasto no existiera.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `gastoId` | path | Sí | string (uuid) | Identificador del gasto | `9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c` |

**Respuestas**

**204** — Gasto borrado

**400** — El identificador del viaje o del gasto no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del gasto no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro, o el gasto no existe, es de otro viaje o no se puede borrar

| Código de error | Mensaje |
| --- | --- |
| `gasto_no_encontrado` | El gasto no existe o no pertenece a este viaje |

**409** — El viaje está finalizado o archivado

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_gasto` | No se ha podido eliminar el gasto |

## Documentos

### GET /viajes/{viajeId}/documentos

**Lista los documentos de la cartera del viaje**

Devuelve los datos de los documentos de la cartera compartida del viaje (billetes, reservas, seguros...),
del más reciente al más antiguo. No incluye el contenido de los archivos.
Solo lo pueden pedir los miembros del viaje. También funciona en viajes finalizados, porque
solo lee.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Documentos del viaje (lista vacía si aún no tiene ninguno)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `documentos` | array<Documento> | No | Documentos del viaje, del más reciente al más antiguo |  |
| `documentos[].id` | string (uuid) | No |  | `4a7b9c2d-1e3f-4a5b-8c6d-7e8f9a0b1c2d` |
| `documentos[].viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `documentos[].nombre` | string | No |  | `Billete de tren Madrid-Roma` |
| `documentos[].tipo_mime` | enum (application/pdf, image/jpeg, image/png, text/plain) | No | Tipo reconocido a partir del contenido del archivo. `text/plain` son los resúmenes guardados desde el escaneo | `application/pdf` |
| `documentos[].tamano_bytes` | integer | No | Tamaño del archivo en bytes (8.000.000 como máximo) | `248731` |
| `documentos[].subido_por` | string (uuid) \| null | No | Quién subió el documento (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `documentos[].creado_en` | string (date-time) | No |  | `2026-11-08T10:00:00Z` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_documento` | No se han podido obtener los documentos |

### POST /viajes/{viajeId}/documentos

**Sube un documento a la cartera del viaje**

Sube un PDF o una imagen JPEG o PNG de 8 MB como máximo a la cartera compartida del viaje. El archivo se
guarda en el bucket privado `documentos` de Supabase Storage, en la carpeta del viaje y con un nombre
aleatorio, y sus datos quedan registrados en la tabla `documentos`. Si el registro falla, el archivo se
borra del bucket.

El tipo se reconoce por el contenido del archivo, no por su extensión ni por el tipo que indica el
navegador. Cualquier miembro puede subir documentos mientras el viaje esté activo; quien hace la petición
queda como `subido_por`.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`multipart/form-data`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `archivo` | string (binary) | Sí | PDF, JPEG o PNG de 8 MB (8.000.000 bytes) como máximo. Un solo archivo por petición |  |
| `nombre` | string | No | Nombre que verán los miembros. Si no se indica, se usa el del archivo (recortado a 150 caracteres) | `Billete de tren Madrid-Roma` |

**Respuestas**

**201** — Documento subido y registrado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `4a7b9c2d-1e3f-4a5b-8c6d-7e8f9a0b1c2d` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Billete de tren Madrid-Roma` |
| `tipo_mime` | enum (application/pdf, image/jpeg, image/png, text/plain) | No | Tipo reconocido a partir del contenido del archivo. `text/plain` son los resúmenes guardados desde el escaneo | `application/pdf` |
| `tamano_bytes` | integer | No | Tamaño del archivo en bytes (8.000.000 como máximo) | `248731` |
| `subido_por` | string (uuid) \| null | No | Quién subió el documento (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-11-08T10:00:00Z` |

**400** — Falta el archivo o llega más de uno, el archivo no es un PDF, JPEG o PNG, ocupa más de 8 MB, el nombre
no es válido o el identificador del viaje no es un UUID


| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Adjunta el archivo del documento en el campo «archivo» |
| `tipo_no_permitido` | Solo se pueden subir documentos PDF o imágenes JPEG o PNG |
| `archivo_demasiado_grande` | El documento no puede ocupar más de 8 MB |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase (al subir el archivo o al registrarlo)

| Código de error | Mensaje |
| --- | --- |
| `error_documento` | No se ha podido subir el documento |

### POST /viajes/{viajeId}/documentos/texto

**Guarda en la cartera el resumen en texto de un documento escaneado**

Lo usa la app al escanear un documento que no es ni un gasto ni una actividad (`POST /gastos/escaneo` devuelve
`tipo: otro`). El `texto` se guarda como `Resumen escaneado.txt` (o con el `nombre` indicado) en UTF-8 y aparece en la
cartera como un documento más, que se puede abrir, descargar y eliminar. Solo con el viaje activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `texto` | string | Sí | Texto del resumen en UTF-8. Se recorta de espacios al principio y al final, y no puede ocupar más de 8 MB | `Póliza de seguro<br>Cobertura total durante el viaje` |
| `nombre` | string | No | Nombre del documento. Si no se indica, es «Resumen escaneado.txt» | `Póliza del seguro` |

**Respuestas**

**201** — Resumen guardado en la cartera

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `4a7b9c2d-1e3f-4a5b-8c6d-7e8f9a0b1c2d` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Billete de tren Madrid-Roma` |
| `tipo_mime` | enum (application/pdf, image/jpeg, image/png, text/plain) | No | Tipo reconocido a partir del contenido del archivo. `text/plain` son los resúmenes guardados desde el escaneo | `application/pdf` |
| `tamano_bytes` | integer | No | Tamaño del archivo en bytes (8.000.000 como máximo) | `248731` |
| `subido_por` | string (uuid) \| null | No | Quién subió el documento (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-11-08T10:00:00Z` |

**400** — El texto está vacío o ocupa más de 8 MB, el nombre tiene más de 150 caracteres o el identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El resumen no puede estar vacío ni ocupar más de 8 MB |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado y ya no se puede modificar

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

**502** — Supabase no ha podido guardar el resumen

| Código de error | Mensaje |
| --- | --- |
| `error_documento` | No se ha podido guardar el resumen |

### DELETE /viajes/{viajeId}/documentos/{documentoId}

**Elimina un documento de la cartera del viaje**

Elimina un documento de la cartera compartida del viaje: borra su fila de la tabla `documentos` y, después,
su archivo del bucket privado `documentos` de Supabase Storage. No se puede deshacer.

Cualquier miembro puede eliminar cualquier documento, no solo quien lo subió, y solo mientras el viaje esté
activo. Si falla el borrado del archivo una vez borrada la fila, la respuesta sigue siendo 204: para los
miembros el documento ya no existe y el archivo queda en el bucket sin fila, invisible.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `documentoId` | path | Sí | string (uuid) | Identificador del documento | `4a7b9c2d-1e3f-4a5b-8c6d-7e8f9a0b1c2d` |

**Respuestas**

**204** — Documento eliminado (sin cuerpo)

**400** — El identificador del viaje o del documento no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del documento no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (`viaje_no_encontrado`), o el documento no existe en este viaje, por ejemplo porque otro miembro ya lo eliminó (`documento_no_encontrado`)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `documento_no_encontrado` | El documento no existe en este viaje |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase (al borrar el documento)

| Código de error | Mensaje |
| --- | --- |
| `error_documento` | No se ha podido eliminar el documento |

### GET /viajes/{viajeId}/documentos/{documentoId}/url

**Obtiene un enlace temporal para abrir o descargar un documento**

Devuelve una URL firmada de Supabase Storage para abrir (previsualizar) un documento de la cartera del
viaje. El bucket es privado, así que el archivo solo se puede ver con este enlace, que **dura 5 minutos**
(`expira_en`). Un documento se puede abrir siempre mientras no se elimine: cada vez que se abre se pide un
enlace nuevo. El archivo no pasa por el servidor.

Con `descargar=true` el enlace hace que el navegador guarde el archivo con el nombre del documento.
No devuelve la ruta interna del archivo en el bucket.

Solo lo pueden pedir los miembros del viaje. También funciona en viajes finalizados, porque
solo lee.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `documentoId` | path | Sí | string (uuid) | Identificador del documento | `4a7b9c2d-1e3f-4a5b-8c6d-7e8f9a0b1c2d` |
| `descargar` | query | No | boolean | Si es `true`, el enlace descarga el archivo con el nombre del documento en lugar de abrirlo | `false` |

**Respuestas**

**200** — Enlace temporal del documento

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `url` | string (uri) | No | Enlace firmado de Supabase Storage para abrir o descargar el archivo | `https://proyecto.supabase.co/storage/v1/object/sign/documentos/123e4567-e89b-12d3-a456-426614174000/0b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e.pdf?token=eyJ...` |
| `expira_en` | string (date-time) | No | Cuándo caduca el enlace (5 minutos después de pedirlo) | `2026-11-09T16:51:45Z` |
| `nombre` | string | No |  | `Billete de tren Madrid-Roma` |
| `tipo_mime` | enum (application/pdf, image/jpeg, image/png) | No |  | `application/pdf` |

**400** — El identificador del viaje o del documento no es un UUID, o `descargar` no es `true` ni `false`

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del documento no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (`viaje_no_encontrado`), o el documento no existe en este viaje o su archivo ya no está (`documento_no_encontrado`)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `documento_no_encontrado` | El documento no existe en este viaje |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_documento` | No se ha podido obtener el enlace del documento |

## Tareas

### GET /viajes/{viajeId}/tareas

**Lista las tareas del viaje**

Devuelve la lista de tareas colaborativa del viaje, de la más antigua a la más reciente, cada una con su
responsable (nombre y avatar). Solo lo pueden pedir los miembros del viaje. También funciona en viajes
finalizados, porque solo lee.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Tareas del viaje (lista vacía si aún no tiene ninguna)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `tareas` | array<Tarea> | No | Tareas del viaje, de la más antigua a la más reciente |  |
| `tareas[].id` | string (uuid) | No |  | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |
| `tareas[].texto` | string | No |  | `Reservar mesa para la cena del sábado` |
| `tareas[].hecha` | boolean | No |  | `false` |
| `tareas[].hecha_en` | string (date-time) \| null | No | Cuándo se marcó como hecha (null mientras está pendiente) | `null` |
| `tareas[].creado_en` | string (date-time) | No |  | `2026-11-14T10:00:00Z` |
| `tareas[].responsable` | object \| null | No | Miembro a quien se asigna la tarea; null si está sin asignar |  |
| `tareas[].responsable.usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `tareas[].responsable.nombre` | string \| null | No | Null si el responsable ya no es miembro del viaje | `Berta` |
| `tareas[].responsable.avatar_url` | string \| null | No |  | `null` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_tarea` | No se han podido obtener las tareas |

### POST /viajes/{viajeId}/tareas

**Añade una tarea a la lista del viaje**

Crea una tarea pendiente con su texto (de 1 a 200 caracteres, sin espacios al principio ni al final) y su
responsable, que tiene que ser miembro del viaje; sin responsable (o con `null`) la tarea queda sin asignar. Cualquier miembro puede añadir tareas, y solo mientras
el viaje esté activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `texto` | string | Sí | Texto de la tarea (se recortan los espacios de los extremos) | `Reservar mesa para la cena del sábado` |
| `responsable_id` | string (uuid) \| null | No | Miembro del viaje a quien se asigna; si falta o es null, la tarea se crea sin asignar | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |

**Respuestas**

**201** — Tarea creada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |
| `texto` | string | No |  | `Reservar mesa para la cena del sábado` |
| `hecha` | boolean | No |  | `false` |
| `hecha_en` | string (date-time) \| null | No | Cuándo se marcó como hecha (null mientras está pendiente) | `null` |
| `creado_en` | string (date-time) | No |  | `2026-11-14T10:00:00Z` |
| `responsable` | object \| null | No | Miembro a quien se asigna la tarea; null si está sin asignar |  |
| `responsable.usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `responsable.nombre` | string \| null | No | Null si el responsable ya no es miembro del viaje | `Berta` |
| `responsable.avatar_url` | string \| null | No |  | `null` |

**400** — El identificador del viaje no es un UUID, el texto está vacío o supera los 200 caracteres, o el responsable no es un UUID válido ni miembro del viaje

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El texto debe tener entre 1 y 200 caracteres |
| `datos_invalidos` | El responsable tiene que ser miembro del viaje |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_tarea` | No se ha podido crear la tarea |

### PATCH /viajes/{viajeId}/tareas/{tareaId}

**Edita o marca una tarea**

Cambia solo los campos que se envían: el texto, el responsable (miembro del viaje, o `null` para dejarla sin asignar) o si está hecha. Hay que
enviar al menos uno. Al marcarla (`hecha: true`) se guarda cuándo se hizo en `hecha_en`; al desmarcarla,
`hecha_en` vuelve a `null`. Cualquier miembro puede editar o marcar cualquier tarea, y solo mientras el
viaje esté activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `tareaId` | path | Sí | string (uuid) | Identificador de la tarea | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `texto` | string | No |  | `Reservar mesa para el domingo` |
| `responsable_id` | string (uuid) \| null | No | Nuevo responsable, miembro del viaje; null deja la tarea sin asignar | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `hecha` | boolean | No | true marca la tarea como hecha y false la desmarca | `true` |

**Respuestas**

**200** — Tarea actualizada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |
| `texto` | string | No |  | `Reservar mesa para la cena del sábado` |
| `hecha` | boolean | No |  | `false` |
| `hecha_en` | string (date-time) \| null | No | Cuándo se marcó como hecha (null mientras está pendiente) | `null` |
| `creado_en` | string (date-time) | No |  | `2026-11-14T10:00:00Z` |
| `responsable` | object \| null | No | Miembro a quien se asigna la tarea; null si está sin asignar |  |
| `responsable.usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `responsable.nombre` | string \| null | No | Null si el responsable ya no es miembro del viaje | `Berta` |
| `responsable.avatar_url` | string \| null | No |  | `null` |

**400** — Algún identificador no es un UUID, no se envía ningún campo, o el texto, el responsable o `hecha` no son válidos (incluido un responsable que no es miembro del viaje)

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Indica al menos un campo que cambiar: texto, responsable_id o hecha |
| `datos_invalidos` | El campo hecha debe ser verdadero o falso |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (`viaje_no_encontrado`), o la tarea no existe en este viaje, por ejemplo porque otro miembro ya la borró (`tarea_no_encontrada`)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `tarea_no_encontrada` | La tarea no existe en este viaje |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_tarea` | No se ha podido actualizar la tarea |

### DELETE /viajes/{viajeId}/tareas/{tareaId}

**Borra una tarea de la lista del viaje**

Borra la tarea para todos los miembros. No se puede deshacer. Cualquier miembro puede borrar cualquier
tarea, y solo mientras el viaje esté activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `tareaId` | path | Sí | string (uuid) | Identificador de la tarea | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |

**Respuestas**

**204** — Tarea borrada (sin cuerpo)

**400** — El identificador del viaje o de la tarea no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador de la tarea no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (`viaje_no_encontrado`), o la tarea no existe en este viaje (`tarea_no_encontrada`)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `tarea_no_encontrada` | La tarea no existe en este viaje |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_tarea` | No se ha podido eliminar la tarea |

## Sello

### GET /viajes/{viajeId}/sello

**Consulta el sello que el usuario ha elegido para el viaje**

Devuelve el sello del usuario con sesión en este viaje, o `sello: null` si no ha elegido ninguno. Cada
usuario solo ve el suyo. Un viaje activo todavía no tiene sello: responde `null`.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Sello del usuario (`null` si no tiene)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `sello` | \| null | No |  |  |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o lo ha eliminado (las políticas RLS no permiten distinguir los dos primeros casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_sello` | No se ha podido obtener el sello |

### PUT /viajes/{viajeId}/sello

**Elige o cambia el sello del viaje**

Guarda el diseño elegido por el usuario para este viaje, o sustituye el que tenía. El destino (el del
viaje o, si no tiene, su nombre) y el año (el de la fecha de inicio, o el de la finalización o la creación)
se guardan en este momento y no cambian después. Cualquier miembro puede hacerlo, tanto si ha archivado el
viaje como si no, pero solo cuando el viaje ya ha terminado.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `diseno` | enum (chincheta, mapa, ruta, avion) | Sí |  | `mapa` |

**Respuestas**

**200** — Sello guardado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `sello` | Sello | No |  |  |
| `sello.id` | string (uuid) | No |  | `7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f` |
| `sello.viaje_id` | string (uuid) \| null | No | Viaje al que pertenece el sello (null si el viaje se ha borrado del todo) | `0e6d7f1a-3b2c-4d5e-9f80-a1b2c3d4e5f6` |
| `sello.diseno` | enum (chincheta, mapa, ruta, avion) | No |  | `mapa` |
| `sello.destino` | string | No | Destino del viaje cuando se eligió el sello | `Roma` |
| `sello.anio` | integer | No | Año del viaje cuando se eligió el sello | `2027` |
| `sello.elegido_en` | string (date-time) | No |  | `2026-11-15T10:00:00Z` |

**400** — El identificador del viaje no es un UUID (`datos_invalidos`) o el diseño no es uno de los cuatro (`diseno_invalido`)

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |
| `diseno_invalido` | El diseño debe ser uno de: chincheta, mapa, ruta, avion |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o lo ha eliminado (las políticas RLS no permiten distinguir los dos primeros casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje todavía está activo: el sello se elige al terminarlo

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_terminado` | El viaje todavía no ha terminado |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_sello` | No se ha podido guardar el sello |

### DELETE /viajes/{viajeId}/sello

**Quita el sello del viaje**

Quita el sello del usuario en este viaje. Si no tenía ninguno, también responde 204. No afecta a los
sellos de los demás miembros.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**204** — Sello quitado (sin cuerpo)

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe, el usuario no es miembro o lo ha eliminado (las políticas RLS no permiten distinguir los dos primeros casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje todavía está activo: el sello se elige al terminarlo

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_terminado` | El viaje todavía no ha terminado |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_sello` | No se ha podido quitar el sello |

### GET /perfil/sellos

**Lista los sellos del usuario (pasaporte de viajes)**

Devuelve todos los sellos del usuario con sesión, por año descendente y, dentro de cada año, por fecha de
elección. Se leen solo de la tabla de sellos, así que siguen apareciendo aunque el usuario haya archivado
o eliminado el viaje, o aunque el viaje se haya borrado del todo (en ese caso `viaje_id` es `null`).
Cada usuario solo ve los suyos.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Respuestas**

**200** — Sellos del usuario (lista vacía si no tiene ninguno)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `sellos` | array<Sello> | No |  |  |
| `sellos[].id` | string (uuid) | No |  | `7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f` |
| `sellos[].viaje_id` | string (uuid) \| null | No | Viaje al que pertenece el sello (null si el viaje se ha borrado del todo) | `0e6d7f1a-3b2c-4d5e-9f80-a1b2c3d4e5f6` |
| `sellos[].diseno` | enum (chincheta, mapa, ruta, avion) | No |  | `mapa` |
| `sellos[].destino` | string | No | Destino del viaje cuando se eligió el sello | `Roma` |
| `sellos[].anio` | integer | No | Año del viaje cuando se eligió el sello | `2027` |
| `sellos[].elegido_en` | string (date-time) | No |  | `2026-11-15T10:00:00Z` |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_sello` | No se han podido obtener los sellos |

### PATCH /perfil/sellos/{selloId}

**Cambia el diseño de un sello propio**

Cambia el diseño de un sello del usuario, también cuando su viaje ya no existe. El destino y el año no
cambian. Un sello ajeno responde 404, igual que uno que no existe.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `selloId` | path | Sí | string (uuid) | Identificador del sello | `7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `diseno` | enum (chincheta, mapa, ruta, avion) | Sí |  | `mapa` |

**Respuestas**

**200** — Sello cambiado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `sello` | Sello | No |  |  |
| `sello.id` | string (uuid) | No |  | `7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f` |
| `sello.viaje_id` | string (uuid) \| null | No | Viaje al que pertenece el sello (null si el viaje se ha borrado del todo) | `0e6d7f1a-3b2c-4d5e-9f80-a1b2c3d4e5f6` |
| `sello.diseno` | enum (chincheta, mapa, ruta, avion) | No |  | `mapa` |
| `sello.destino` | string | No | Destino del viaje cuando se eligió el sello | `Roma` |
| `sello.anio` | integer | No | Año del viaje cuando se eligió el sello | `2027` |
| `sello.elegido_en` | string (date-time) | No |  | `2026-11-15T10:00:00Z` |

**400** — El identificador del sello no es un UUID (`datos_invalidos`) o el diseño no es uno de los cuatro (`diseno_invalido`)

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del sello no es válido |
| `diseno_invalido` | El diseño debe ser uno de: chincheta, mapa, ruta, avion |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El sello no existe o no es del usuario

| Código de error | Mensaje |
| --- | --- |
| `sello_no_encontrado` | El sello no existe |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_sello` | No se ha podido cambiar el sello |

### DELETE /perfil/sellos/{selloId}

**Quita un sello propio**

Quita un sello del usuario por su identificador, también cuando su viaje ya no existe. No afecta a los
sellos de los demás usuarios.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `selloId` | path | Sí | string (uuid) | Identificador del sello | `7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f` |

**Respuestas**

**204** — Sello quitado (sin cuerpo)

**400** — El identificador del sello no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del sello no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El sello no existe o no es del usuario

| Código de error | Mensaje |
| --- | --- |
| `sello_no_encontrado` | El sello no existe |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_sello` | No se ha podido quitar el sello |

## Puntos de interés

### GET /viajes/{viajeId}/puntos-de-interes

**Lista los puntos de interés de un viaje**

Devuelve los puntos de interés del viaje, del más antiguo al más reciente. Son los sitios que el grupo quiere
tener en el mapa sin que sean una actividad del itinerario: la pestaña «Puntos de interés» del Itinerario los
dibuja en un mapa aparte, con un marcador por punto.
Solo lo pueden pedir los miembros del viaje, y también funciona con un viaje finalizado o archivado (solo lectura).
No hay notificaciones en tiempo real: para ver los cambios de otros miembros basta con volver a pedir el listado.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Puntos de interés del viaje (lista vacía si no tiene ninguno)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `puntos_interes` | array<PuntoInteres> | No |  |  |
| `puntos_interes[].id` | string (uuid) | No |  | `6c7d8e9f-1a2b-4c3d-8e4f-5a6b7c8d9e0f` |
| `puntos_interes[].viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `puntos_interes[].nombre` | string | No |  | `Fontana di Trevi` |
| `puntos_interes[].nota` | string \| null | No |  | `Ir temprano para evitar colas` |
| `puntos_interes[].categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |
| `puntos_interes[].latitud` | number | No | Latitud del punto (6 decimales) | `41.900932` |
| `puntos_interes[].longitud` | number | No | Longitud del punto (6 decimales) | `12.483313` |
| `puntos_interes[].lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap, si se eligió con el buscador de direcciones | `way/24146600` |
| `puntos_interes[].direccion` | string \| null | No | Dirección del lugar (el `nombre` que devuelve GET /direcciones), si se eligió con el buscador; null si se eligió tocando el mapa | `Fontana di Trevi, Piazza di Trevi, Roma` |
| `puntos_interes[].creado_por` | string (uuid) \| null | No | Usuario que añadió el punto (null si ya no existe su perfil) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `puntos_interes[].creado_en` | string (date-time) | No |  | `2026-11-22T10:00:00Z` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_punto_interes` | No se han podido obtener los puntos de interés |

### POST /viajes/{viajeId}/puntos-de-interes

**Añade un punto de interés al mapa del viaje**

Añade un punto de interés con su ubicación (`latitud` y `longitud`, obligatorias) y un nombre. Si el sitio se eligió con el buscador se envía también su `direccion`, para poder mostrarla; si se eligió tocando el mapa no hay dirección (el servidor no hace geocodificación inversa). La nota y la
categoría son opcionales, y la categoría usa las mismas que las actividades. Si el punto se eligió con una
dirección del buscador (GET /direcciones) se puede enviar también su `lugar_externo_id`; si se eligió tocando el
mapa, no.
Lo puede añadir cualquier miembro mientras el viaje está activo; queda a su nombre (`creado_por`). Los puntos no se
pueden editar: para corregir uno se borra y se vuelve a crear.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `nombre` | string | Sí |  | `Fontana di Trevi` |
| `nota` | string \| null | No |  | `Ir temprano para evitar colas` |
| `categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |
| `latitud` | number | Sí |  | `41.900932` |
| `longitud` | number | Sí |  | `12.483313` |
| `lugar_externo_id` | string \| null | No |  | `way/24146600` |
| `direccion` | string \| null | No |  | `Fontana di Trevi, Piazza di Trevi, Roma` |

**Respuestas**

**201** — Punto de interés creado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `6c7d8e9f-1a2b-4c3d-8e4f-5a6b7c8d9e0f` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No |  | `Fontana di Trevi` |
| `nota` | string \| null | No |  | `Ir temprano para evitar colas` |
| `categoria` | enum (comida, cultura, transporte, alojamiento, otro) \| null | No |  | `cultura` |
| `latitud` | number | No | Latitud del punto (6 decimales) | `41.900932` |
| `longitud` | number | No | Longitud del punto (6 decimales) | `12.483313` |
| `lugar_externo_id` | string \| null | No | Identificador del lugar en OpenStreetMap, si se eligió con el buscador de direcciones | `way/24146600` |
| `direccion` | string \| null | No | Dirección del lugar (el `nombre` que devuelve GET /direcciones), si se eligió con el buscador; null si se eligió tocando el mapa | `Fontana di Trevi, Piazza di Trevi, Roma` |
| `creado_por` | string (uuid) \| null | No | Usuario que añadió el punto (null si ya no existe su perfil) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-11-22T10:00:00Z` |

**400** — Faltan datos, no son válidos o el identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La latitud es obligatoria y debe ser un número entre -90 y 90 |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_punto_interes` | No se ha podido crear el punto de interés |

### DELETE /viajes/{viajeId}/puntos-de-interes/{puntoId}

**Borra un punto de interés del mapa del viaje**

Borra el punto de interés para todos los miembros. No se puede deshacer.
Cualquier miembro puede borrar cualquier punto, no solo quien lo añadió, y solo mientras el viaje esté activo.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `puntoId` | path | Sí | string (uuid) | Identificador del punto de interés | `6c7d8e9f-1a2b-4c3d-8e4f-5a6b7c8d9e0f` |

**Respuestas**

**204** — Punto de interés borrado (sin cuerpo)

**400** — El identificador del viaje o del punto de interés no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje o del punto de interés no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (`viaje_no_encontrado`), o el punto no existe en este viaje, por ejemplo porque otro miembro ya lo borró (`punto_no_encontrado`)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `punto_no_encontrado` | El punto de interés no existe en este viaje |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_punto_interes` | No se ha podido eliminar el punto de interés |

## Fotos

### GET /viajes/{viajeId}/fotos

**Lista las fotos y los vídeos de la galería del viaje**

Devuelve las fotos y los vídeos de la galería compartida del viaje, de lo más reciente a lo más antiguo, y el espacio
de almacenamiento que ocupan frente al límite del viaje (`almacenamiento`). Cada archivo incluye
`url`, una URL firmada de Supabase Storage para verla que caduca a la hora de generarla (1 hora): pasado ese
tiempo hay que volver a pedir el listado.
Solo lo pueden pedir los miembros del viaje. También funciona en viajes finalizados, porque
solo lee.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Fotos y vídeos del viaje (lista vacía si aún no tiene ninguno) y el almacenamiento usado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `fotos` | array<Foto> | No | Fotos y vídeos del viaje, de lo más reciente a lo más antiguo |  |
| `fotos[].id` | string (uuid) | No |  | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |
| `fotos[].viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `fotos[].nombre` | string | No | Nombre del archivo original | `coliseo.jpg` |
| `fotos[].tipo_mime` | enum (image/jpeg, image/png, image/webp, video/mp4, video/webm, video/quicktime) | No | Tipo reconocido a partir del contenido del archivo | `image/jpeg` |
| `fotos[].tamano_bytes` | integer | No | Tamaño del archivo en bytes (8.000.000 como máximo una foto y 50.000.000 un vídeo) | `248731` |
| `fotos[].subido_por` | string (uuid) \| null | No | Quién subió el archivo (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `fotos[].creado_en` | string (date-time) | No |  | `2026-11-08T10:00:00Z` |
| `fotos[].url` | string (uri) \| null | No | URL firmada de Supabase Storage para ver la foto o el vídeo; caduca a la hora (null si no se ha podido generar) | `https://proyecto.supabase.co/storage/v1/object/sign/fotos/123e4567-e89b-12d3-a456-426614174000/0b0e8f5a.jpg?token=eyJ...` |
| `almacenamiento` | object | No | Espacio que ocupa la galería del viaje frente a su límite |  |
| `almacenamiento.usado_bytes` | integer | No | Bytes que ocupan todos los archivos del viaje | `1500000` |
| `almacenamiento.limite_bytes` | integer | No | Límite de almacenamiento del viaje en bytes (200 MB) | `200000000` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_foto` | No se han podido obtener las fotos |

### POST /viajes/{viajeId}/fotos

**Sube una foto o un vídeo a la galería del viaje**

Sube una imagen JPEG, PNG o WebP de 8 MB como máximo, o un vídeo MP4, WebM o MOV de 50 MB como máximo (el tope por
archivo de Supabase Storage), a la galería compartida del viaje. El almacenamiento total del viaje está limitado a
200 MB: si el archivo no cabe en lo que queda se rechaza con `413`. El archivo se guarda
en el bucket privado `fotos` de Supabase Storage, en la carpeta del viaje y con un nombre aleatorio, y sus
datos quedan registrados en la tabla `fotos`. Si el registro falla, el archivo se borra del bucket.

El tipo se reconoce por el contenido del archivo, no por su extensión ni por el tipo que indica el
navegador. El nombre es el del archivo (recortado a 150 caracteres). Cualquier miembro puede subir
fotos y vídeos mientras el viaje esté activo; quien hace la petición queda como `subido_por`.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Cuerpo de la petición** (`multipart/form-data`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `archivo` | string (binary) | Sí | Imagen JPEG, PNG o WebP de 8 MB (8.000.000 bytes) como máximo, o vídeo MP4, WebM o MOV de 50 MB (50.000.000 bytes) como máximo. Un solo archivo por petición |  |

**Respuestas**

**201** — Foto o vídeo subido y registrado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `id` | string (uuid) | No |  | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `nombre` | string | No | Nombre del archivo original | `coliseo.jpg` |
| `tipo_mime` | enum (image/jpeg, image/png, image/webp, video/mp4, video/webm, video/quicktime) | No | Tipo reconocido a partir del contenido del archivo | `image/jpeg` |
| `tamano_bytes` | integer | No | Tamaño del archivo en bytes (8.000.000 como máximo una foto y 50.000.000 un vídeo) | `248731` |
| `subido_por` | string (uuid) \| null | No | Quién subió el archivo (null si su cuenta se ha eliminado) | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `creado_en` | string (date-time) | No |  | `2026-11-08T10:00:00Z` |
| `url` | string (uri) \| null | No | URL firmada de Supabase Storage para ver la foto o el vídeo; caduca a la hora (null si no se ha podido generar) | `https://proyecto.supabase.co/storage/v1/object/sign/fotos/123e4567-e89b-12d3-a456-426614174000/0b0e8f5a.jpg?token=eyJ...` |

**400** — Falta el archivo o llega más de uno, el archivo no es una foto JPEG, PNG o WebP ni un vídeo MP4, WebM o MOV,
la foto ocupa más de 8 MB, el vídeo más de 50 MB o el identificador del viaje no es un UUID


| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Adjunta la foto o el vídeo en el campo «archivo» |
| `tipo_no_permitido` | Solo se pueden subir fotos (JPEG, PNG o WebP) o vídeos (MP4, WebM o MOV) |
| `archivo_demasiado_grande` | La foto no puede ocupar más de 8 MB |
| `archivo_demasiado_grande` | El vídeo no puede ocupar más de 50 MB |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**413** — El archivo no cabe en el almacenamiento que le queda al viaje (200 MB en total)

| Código de error | Mensaje |
| --- | --- |
| `almacenamiento_lleno` | El viaje ha alcanzado su límite de almacenamiento |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase (al subir el archivo o al registrarlo)

| Código de error | Mensaje |
| --- | --- |
| `error_foto` | No se ha podido subir el archivo |

### DELETE /viajes/{viajeId}/fotos/{fotoId}

**Borra una foto o un vídeo de la galería del viaje**

Borra una foto o un vídeo de la galería compartida del viaje: borra su fila de la tabla `fotos` y, después, su
archivo del bucket privado `fotos` de Supabase Storage, con lo que se libera su espacio. No se puede deshacer.

Cualquier miembro puede borrar cualquier archivo, no solo quien lo subió, y solo mientras el viaje esté activo.
Si falla el borrado del archivo una vez borrada la fila, la respuesta sigue siendo 204: para los miembros el
archivo ya no existe y queda en el bucket sin fila, invisible.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `fotoId` | path | Sí | string (uuid) | Identificador de la foto o del vídeo | `5b8c0d3e-2f4a-4b6c-9d7e-8f9a0b1c2d3e` |

**Respuestas**

**204** — Foto o vídeo borrado (sin cuerpo)

**400** — El identificador del viaje o de la foto no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador de la foto no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (`viaje_no_encontrado`), o el archivo no existe en este viaje, por ejemplo porque otro miembro ya lo borró (`foto_no_encontrada`)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |
| `foto_no_encontrada` | La foto no existe en este viaje |

**409** — El viaje está finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está finalizado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_foto` | No se ha podido borrar el archivo |

## Resumen

### GET /viajes/{viajeId}/resumen

**Resumen «Fin de viaje» (Wrap) del viaje**

Calcula los datos que muestra el resumen de fin de viaje: los días del viaje, la actividad más votada y el
«alma del grupo». Los datos se calculan al pedirlos, así que siempre están al día.
Solo lo pueden pedir los miembros del viaje, y funciona con el viaje activo o finalizado porque solo
lee. Las fotos que también aparecen en la pantalla se piden con `GET /viajes/{viajeId}/fotos`.

El resumen solo incluye lo que enseña el Wrap: no devuelve los gastos (ni el total ni el más alto) ni el balance
entre los viajeros, que se consultan en la pantalla de gastos. Lo que no tiene datos viene como `null` y el Wrap
no muestra esa diapositiva. La imagen para descargar la genera el propio navegador con estos mismos datos, por
lo que no hay un endpoint para ella.

- `dias`: días desde el primero hasta el último del viaje, ambos incluidos. Si el viaje no tiene las dos
  fechas, los días distintos que tienen actividades.
- `actividad_mas_votada`: la opción con más votos entre las votaciones de tipo `actividad` (con un empate, la
  que va antes en la lista), o `null` si nadie ha votado.
- `alma_del_grupo`: el miembro actual que ha pagado más gastos (con el mismo número, el que ha pagado más
  dinero y después el primero de la lista) con sus pagos, planes propuestos (actividades creadas) y fotos
  subidas, o `null` si no hay gastos.
- `presupuesto`: el presupuesto del viaje (`total`), lo gastado en sus gastos (`gastado`) y lo que queda (`restante`,
  que es negativo si el viaje ya supera el presupuesto).

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |

**Respuestas**

**200** — Resumen del viaje

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `dias` | integer | No | Días del viaje | `4` |
| `actividad_mas_votada` | object \| null | No | Opción con más votos de las votaciones de tipo actividad (null si nadie ha votado) |  |
| `actividad_mas_votada.titulo` | string | No |  | `Coliseo Romano` |
| `actividad_mas_votada.votos` | integer | No |  | `3` |
| `alma_del_grupo` | object \| null | No | Miembro que ha pagado más gastos (null si no hay gastos) |  |
| `alma_del_grupo.usuario_id` | string (uuid) | No |  | `df77cba6-4be5-4cbc-814b-1e228dd73dcc` |
| `alma_del_grupo.nombre` | string \| null | No |  | `Berta` |
| `alma_del_grupo.pagos` | integer | No | Gastos que ha pagado | `2` |
| `alma_del_grupo.planes_propuestos` | integer | No | Actividades que ha creado | `4` |
| `alma_del_grupo.fotos_subidas` | integer | No | Fotos que ha subido a la galería | `3` |
| `presupuesto` | object | No | Presupuesto del viaje menos lo gastado en sus gastos |  |
| `presupuesto.total` | number | No | Presupuesto del viaje, en su moneda | `500` |
| `presupuesto.gastado` | number | No | Suma de los importes de los gastos del viaje | `132.9` |
| `presupuesto.restante` | number | No | Total menos gastado; negativo si se supera el presupuesto | `367.1` |

**400** — El identificador del viaje no es un UUID

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El identificador del viaje no es válido |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_resumen` | No se ha podido calcular el resumen del viaje |

## Rutas

### GET /viajes/{viajeId}/ruta

**Calcula la ruta a pie del día entre las actividades con ubicación**

Toma las actividades del día indicado que tienen coordenadas, en el orden de la agenda, y devuelve la ruta a
pie por calles que las une junto con distancia, duración y un orden más corto para visitarlas. Solo lo pueden
pedir los miembros del viaje, y también funciona con un viaje finalizado (solo lectura).

La ruta la calcula un servicio externo basado en OSRM con datos de OpenStreetMap (por defecto el servidor de rutas
a pie de OpenStreetMap Alemania; se cambia con la variable de entorno `RUTAS_URL`). Para respetar su política de
uso las llamadas salen de una en una, a razón de una por segundo; un mismo usuario no puede pedir dos rutas en
menos de un segundo, el tiempo máximo de espera es de 8 segundos y las rutas repetidas se sirven de una caché de
10 minutos.

La ruta sigue el orden de la agenda. El orden más corto (`orden_sugerido`) siempre empieza por la primera
actividad y se calcula con distancias en línea recta, por lo que `ahorro_m` es una estimación: la diferencia en
línea recta entre el recorrido de la agenda y el sugerido.

Con menos de dos actividades con ubicación no se llama al servicio externo y `ruta` vale `null`.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `viajeId` | path | Sí | string (uuid) | Identificador del viaje | `123e4567-e89b-12d3-a456-426614174000` |
| `fecha` | query | Sí | string (date) | Día del que se quiere la ruta (AAAA-MM-DD) | `2027-05-12` |

**Respuestas**

**200** — Actividades con ubicación del día, orden más corto y ruta (null si hay menos de dos actividades con ubicación)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `puntos` | array<PuntoDeRuta> | No | Actividades del día con ubicación, en el orden de la agenda |  |
| `puntos[].id` | string (uuid) | No | Identificador de la actividad |  |
| `puntos[].titulo` | string | No |  | `Visita al Coliseo` |
| `puntos[].latitud` | number | No |  | `41.890214` |
| `puntos[].longitud` | number | No |  | `12.492231` |
| `orden_sugerido` | array<string (uuid)> | No | Identificadores de esas actividades en un orden más corto, empezando siempre por la primera |  |
| `ahorro_m` | integer | No | Metros que se ahorran en línea recta con el orden sugerido respecto al de la agenda (0 si la agenda ya es el más corto) | `1240` |
| `ruta` | object \| null | No | Ruta a pie por calles siguiendo el orden de la agenda; null con menos de dos actividades con ubicación |  |

**400** — El identificador del viaje no es un UUID, la fecha falta o no es válida, o hay más de 25 actividades con ubicación

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La fecha es obligatoria y debe tener el formato AAAA-MM-DD |
| `datos_invalidos` | Hay demasiadas actividades con ubicación para trazar la ruta (máximo 25) |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**422** — El servicio de rutas no encuentra un camino a pie entre las actividades

| Código de error | Mensaje |
| --- | --- |
| `sin_ruta` | No se ha encontrado un camino entre las actividades de ese día |

**429** — El usuario pide rutas demasiado rápido o hay demasiados cálculos en cola

| Código de error | Mensaje |
| --- | --- |
| `demasiadas_rutas` | Espera un segundo entre un cálculo de ruta y otro |
| `servicio_ocupado` | Hay muchos cálculos de ruta en este momento. Inténtalo de nuevo en unos segundos |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — El servicio de rutas no responde, tarda demasiado o devuelve un error, o falla la consulta de las actividades

| Código de error | Mensaje |
| --- | --- |
| `error_ruta` | No se ha podido calcular la ruta |

## Perfil

### PATCH /perfil

**Cambia el nombre del perfil**

Cambia el nombre del perfil de quien hace la petición. La ruta no lleva ningún identificador: el servidor
usa siempre el usuario del token, así que solo se puede editar el perfil propio. El nombre se guarda sin
los espacios del principio y del final y tiene que quedar entre 1 y 100 caracteres, el mismo límite que el
registro. Devuelve el usuario con la misma forma que en la sesión, para que el cliente lo pueda guardar tal cual.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `nombre` | string | Sí | Nuevo nombre. Se guarda sin los espacios del principio y del final, y tiene que quedar entre 1 y 100 caracteres | `Berta` |

**Respuestas**

**200** — Nombre cambiado

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `usuario` | Usuario | No |  |  |
| `usuario.id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `usuario.nombre` | string \| null | No | perfiles.nombre. Con Google se toma del nombre de la cuenta la primera vez. Nulo si el usuario aún no tiene perfil | `Daniel` |
| `usuario.email` | string (email) | No | perfiles.email, o el email de Supabase Auth si no hay perfil | `daniel@travelwrap.app` |
| `usuario.avatar_url` | string \| null | No | perfiles.avatar_url. Con Google, la foto de la cuenta | `null` |
| `usuario.creado_en` | string (date-time) | No | perfiles.creado_en, o la fecha de alta en Supabase Auth si no hay perfil | `2026-10-07T18:00:00Z` |

**400** — El nombre no es un texto o, sin contar los espacios de los extremos, tiene menos de 1 o más de 100 caracteres

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El nombre debe tener entre 1 y 100 caracteres |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El usuario no tiene perfil (el login por email no siempre lo crea hasta que crea un viaje o se une a uno)

| Código de error | Mensaje |
| --- | --- |
| `perfil_no_encontrado` | El perfil no existe |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

### DELETE /perfil

**Elimina la cuenta**

Elimina la cuenta de quien hace la petición. La ruta no lleva ningún identificador: el servidor usa siempre el
usuario del token, así que solo se puede eliminar la cuenta propia. Es la única operación que usa la service key
de Supabase (borrar un usuario de Supabase Auth no se puede hacer con su propio token). Pasos, en este orden:

1. Borra los archivos de Storage de los viajes en los que es el único miembro que queda.
2. Borra esos viajes con todo lo suyo, borra sus sellos y sus suscripciones push y anonimiza su perfil: el
   nombre pasa a «Un antiguo miembro» y se borran el email y la foto. En los demás viajes sigue como miembro
   anonimizado y conserva sus tareas, gastos, repartos, mensajes y votos (ya no cuenta como miembro que queda
   para decidir si el viaje se elimina).
3. Borra sus fotos del bucket `avatares`.
4. Elimina el usuario en Supabase Auth.

Si un paso falla se para y la petición se puede repetir. Tras un 204 el token deja de ser válido.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Respuestas**

**204** — Cuenta eliminada

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase. La cuenta no se ha eliminado del todo y se puede volver a intentar

| Código de error | Mensaje |
| --- | --- |
| `error_cuenta` | No se ha podido eliminar la cuenta |

**503** — El servidor no tiene configurada la service key de Supabase (`SUPABASE_SERVICE_ROLE_KEY`)

| Código de error | Mensaje |
| --- | --- |
| `eliminacion_no_disponible` | La eliminación de cuentas no está disponible |

### PUT /perfil/avatar

**Cambia la foto del perfil**

Sube una imagen JPEG o PNG de 2 MB como máximo como foto del perfil de quien hace la petición. La ruta no
lleva ningún identificador: el servidor usa siempre el usuario del token. La foto se guarda en el bucket
público `avatares` de Supabase Storage, en la carpeta del usuario y con un nombre aleatorio, así que la URL
cambia con cada subida y los navegadores no siguen mostrando la foto anterior desde la caché.

El tipo se reconoce por el contenido del archivo (JPEG empieza por `FF D8 FF` y PNG por `89 50 4E 47`),
además de por el tipo que indica el cliente, que se puede falsear. Si no se puede guardar la URL en el perfil,
la foto subida se borra y el perfil queda igual. Una vez cambiada, se borra la foto anterior si era de este
bucket; las fotos de Google no se tocan.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Cuerpo de la petición** (`multipart/form-data`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `avatar` | string (binary) | Sí | JPEG o PNG de 2 MB (2.000.000 bytes) como máximo. Un solo archivo por petición |  |

**Respuestas**

**200** — Foto cambiada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `usuario` | Usuario | No |  |  |
| `usuario.id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `usuario.nombre` | string \| null | No | perfiles.nombre. Con Google se toma del nombre de la cuenta la primera vez. Nulo si el usuario aún no tiene perfil | `Daniel` |
| `usuario.email` | string (email) | No | perfiles.email, o el email de Supabase Auth si no hay perfil | `daniel@travelwrap.app` |
| `usuario.avatar_url` | string \| null | No | perfiles.avatar_url. Con Google, la foto de la cuenta | `null` |
| `usuario.creado_en` | string (date-time) | No | perfiles.creado_en, o la fecha de alta en Supabase Auth si no hay perfil | `2026-10-07T18:00:00Z` |

**400** — Falta la foto o llega más de una, no es una imagen JPEG o PNG, o ocupa más de 2 MB

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Adjunta la foto en el campo «avatar» |
| `tipo_no_permitido` | La foto debe ser una imagen JPEG o PNG |
| `archivo_demasiado_grande` | La foto no puede ocupar más de 2 MB |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El usuario no tiene perfil (el login por email no siempre lo crea hasta que crea un viaje o se une a uno)

| Código de error | Mensaje |
| --- | --- |
| `perfil_no_encontrado` | El perfil no existe |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase (al subir la foto o al guardarla en el perfil)

| Código de error | Mensaje |
| --- | --- |
| `error_storage` | No se ha podido guardar la foto |

### DELETE /perfil/avatar

**Quita la foto del perfil**

Deja el perfil sin foto (`avatar_url` nulo) y borra el archivo anterior si estaba en el bucket `avatares`;
una foto de Google no se borra. Si el perfil ya no tenía foto, también responde 200.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Respuestas**

**200** — Foto quitada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `usuario` | Usuario | No |  |  |
| `usuario.id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `usuario.nombre` | string \| null | No | perfiles.nombre. Con Google se toma del nombre de la cuenta la primera vez. Nulo si el usuario aún no tiene perfil | `Daniel` |
| `usuario.email` | string (email) | No | perfiles.email, o el email de Supabase Auth si no hay perfil | `daniel@travelwrap.app` |
| `usuario.avatar_url` | string \| null | No | perfiles.avatar_url. Con Google, la foto de la cuenta | `null` |
| `usuario.creado_en` | string (date-time) | No | perfiles.creado_en, o la fecha de alta en Supabase Auth si no hay perfil | `2026-10-07T18:00:00Z` |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El usuario no tiene perfil (el login por email no siempre lo crea hasta que crea un viaje o se une a uno)

| Código de error | Mensaje |
| --- | --- |
| `perfil_no_encontrado` | El perfil no existe |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_storage` | No se ha podido quitar la foto |

## Notificaciones

### GET /notificaciones/clave-publica

**Obtiene la clave pública para las notificaciones push**

Devuelve la clave pública VAPID del servidor, con la que el navegador crea la suscripción push de este
dispositivo. Si el servidor no tiene configuradas las claves, responde 503 y la app solo muestra los avisos
dentro de la aplicación.

**Avisos en tiempo real.** Los eventos del viaje también llegan por el namespace `/notificaciones` de
Socket.io (se conecta con `auth: { token }` y entra solo en su sala personal). Cuando un miembro crea una
votación, registra un gasto, añade una tarea o envía un mensaje, el resto de miembros activos del viaje
(nunca quien lo genera) recibe el evento `notificacion` con `{ viaje_id, viaje_nombre, tipo, pantalla, texto }`.
`tipo` es `votacion`, `gasto`, `tarea` o `mensaje`, y `pantalla` es `votaciones`, `gastos`, `tareas` o `chat`.
La misma carga se envía por push a los dispositivos suscritos.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Respuestas**

**200** — Clave pública VAPID

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `clave` | string | Sí | Clave pública VAPID en base64 de URL |  |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**503** — El servidor no tiene configuradas las notificaciones push

| Código de error | Mensaje |
| --- | --- |
| `push_no_disponible` | Las notificaciones push no están disponibles |

### POST /notificaciones/suscripciones

**Activa las notificaciones push de este dispositivo**

Guarda la suscripción push del dispositivo de quien hace la petición, con el formato que da el navegador
(`PushSubscription.toJSON()`). Si el `endpoint` ya estaba guardado, se actualiza. Solo se guardan
suscripciones del propio usuario del token.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `endpoint` | string | Sí | URL https del servicio push del navegador |  |
| `keys` | object | Sí |  |  |
| `keys.p256dh` | string | Sí |  |  |
| `keys.auth` | string | Sí |  |  |

**Respuestas**

**201** — Suscripción guardada

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `endpoint` | string | No |  |  |

**400** — Falta el endpoint (https) o alguna de las claves

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | La suscripción debe llevar un endpoint https y las claves p256dh y auth |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_notificacion` | No se ha podido activar las notificaciones |

### DELETE /notificaciones/suscripciones

**Desactiva las notificaciones push de este dispositivo**

Borra la suscripción push con ese `endpoint`, solo si es del usuario del token.

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Cuerpo de la petición** (`application/json`, obligatorio)

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `endpoint` | string | Sí |  |  |

**Respuestas**

**204** — Suscripción borrada (también si no existía)

**400** — Falta el endpoint

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | Indica el endpoint de la suscripción |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_notificacion` | No se ha podido desactivar las notificaciones |
