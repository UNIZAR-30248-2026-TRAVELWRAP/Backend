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
| DELETE | [`/viajes/{viajeId}`](#delete-viajesviajeid) | Elimina un viaje archivado | Token de sesión |
| POST | [`/viajes/{viajeId}/archivar`](#post-viajesviajeidarchivar) | Cierra y archiva un viaje | Token de sesión |
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
| PATCH | [`/viajes/{viajeId}/actividades/{actividadId}`](#patch-viajesviajeidactividadesactividadid) | Modifica una actividad del itinerario | Token de sesión |
| DELETE | [`/viajes/{viajeId}/actividades/{actividadId}`](#delete-viajesviajeidactividadesactividadid) | Elimina una actividad del itinerario | Token de sesión |

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
La PWA los reparte en «Mis viajes»: los activos con destino (tarjeta azul), los activos sin destino
(`pendiente_destino: true`, tarjeta verde) y, por estado, los finalizados y archivados (viajes anteriores).

**Acceso:** Requiere sesión: cabecera `Authorization: Bearer <token>`

**Parámetros**

| Nombre | En | Obligatorio | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `estado` | query | No | enum (activo, finalizado, archivado) | Devuelve solo los viajes en ese estado |  |

**Respuestas**

**200** — Viajes del usuario (lista vacía si no tiene ninguno)

Cuerpo (`application/json`):

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| `viajes` | array<any> | No |  |  |

**400** — El filtro `estado` no es válido

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El estado debe ser activo, finalizado o archivado |

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
| `nombre` | string | Sí |  | `Verano 2027` |
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
| `estado` | enum (activo, finalizado, archivado) | No |  | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |

**400** — Datos inválidos

| Código de error | Mensaje |
| --- | --- |
| `datos_invalidos` | El nombre es obligatorio y tiene un máximo de 100 caracteres |
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
| `estado` | enum (activo, finalizado, archivado) | No |  | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
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
Un viaje archivado es de solo lectura y no se puede editar.

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
| `estado` | enum (activo, finalizado, archivado) | No |  | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
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

**409** — El viaje está cerrado o archivado y ya no se puede modificar

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está cerrado y ya no se puede modificar |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido modificar el viaje |

### DELETE /viajes/{viajeId}

**Elimina un viaje archivado**

Borra el viaje para todos sus miembros, junto con todo lo asociado (miembros y, en el futuro, gastos,
tareas, documentos...), que se elimina en cascada (PB-13). No se puede deshacer.
Solo lo puede hacer el creador y solo con viajes archivados: la PWA lo ofrece desde «Viajes archivados».

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

**403** — El usuario es miembro del viaje pero no su creador

| Código de error | Mensaje |
| --- | --- |
| `no_creador` | Solo el creador del viaje puede hacerlo |

**404** — El viaje no existe o el usuario no es miembro (las políticas RLS no permiten distinguir ambos casos)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje no está archivado

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_archivado` | Solo se pueden eliminar viajes archivados |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido eliminar el viaje |

### POST /viajes/{viajeId}/archivar

**Cierra y archiva un viaje**

Pasa el viaje a estado `archivado` (PB-12). A partir de ese momento es un historial de solo lectura:
no se puede editar ni añadir contenido (gastos, tareas...). Sale de «Mis viajes» y aparece en «Viajes archivados».
Si el viaje estaba activo, se guarda el momento del cierre en `finalizado_en`.
Solo lo puede hacer el creador del viaje. No se puede deshacer.

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
| `estado` | enum (activo, finalizado, archivado) | No |  | `activo` |
| `creado_en` | string (date-time) | No |  | `2026-10-12T10:00:00Z` |
| `pendiente_destino` | boolean | No | true si el viaje está activo y aún no tiene destino. Se deduce de estado y destino, no se guarda | `false` |
| `rol` | enum (creador, miembro) | No | Rol del usuario que hace la petición en este viaje | `creador` |
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

**409** — El viaje ya estaba archivado

| Código de error | Mensaje |
| --- | --- |
| `viaje_archivado` | El viaje ya está archivado |

**500** — Error interno del servidor

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_viaje` | No se ha podido archivar el viaje |

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

**409** — El viaje está finalizado o archivado y ya no admite nuevos miembros

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

Crea una votación del viaje con sus opciones iniciales (entre 2 y 20, sin repetir), en una sola operación.
La puede crear cualquier miembro mientras el viaje está activo. Después, cualquier miembro puede proponer más opciones.
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
| `opciones` | array<NuevaOpcionRequest> | Sí | Opciones iniciales, en el orden en que se mostrarán. No se pueden repetir |  |
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
| `datos_invalidos` | La votación necesita entre 2 y 20 opciones |

**401** — Falta la cabecera Authorization Bearer, o el token ha caducado o no es válido

| Código de error | Mensaje |
| --- | --- |
| `sin_sesion` | Falta el token de acceso |
| `sesion_invalida` | La sesión ha caducado o no es válida |

**404** — El viaje no existe o el usuario no es miembro

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_encontrado` | El viaje no existe o no perteneces a él |

**409** — El viaje está archivado o finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está cerrado y ya no se puede modificar |

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
| `viaje_no_activo` | El viaje está cerrado y ya no se puede modificar |
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
| `viaje_no_activo` | El viaje está cerrado y ya no se puede modificar |
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

Devuelve las actividades del viaje ordenadas por día, después por hora de inicio (las que no tienen hora van al
final de su día) y por último por su posición dentro del día (`orden`). Con `fecha` solo devuelve las de ese día.
Solo lo pueden pedir los miembros del viaje, y también funciona con un viaje archivado (solo lectura).

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
| `actividades[].id` | string (uuid) | No |  | `8a1b2c3d-0000-4000-8000-000000000020` |
| `actividades[].viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `actividades[].titulo` | string | No |  | `Visita al Coliseo` |
| `actividades[].descripcion` | string \| null | No |  | `null` |
| `actividades[].fecha` | string (date) | No |  | `2027-05-12` |
| `actividades[].hora_inicio` | string \| null | No | Hora de inicio (HH:MM:SS) | `10:00:00` |
| `actividades[].hora_fin` | string \| null | No | Hora de fin (HH:MM:SS) | `null` |
| `actividades[].orden` | integer | No | Posición dentro del día; la nueva actividad va al final | `0` |
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
| `id` | string (uuid) | No |  | `8a1b2c3d-0000-4000-8000-000000000020` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `titulo` | string | No |  | `Visita al Coliseo` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha` | string (date) | No |  | `2027-05-12` |
| `hora_inicio` | string \| null | No | Hora de inicio (HH:MM:SS) | `10:00:00` |
| `hora_fin` | string \| null | No | Hora de fin (HH:MM:SS) | `null` |
| `orden` | integer | No | Posición dentro del día; la nueva actividad va al final | `0` |
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

**409** — El viaje está archivado o finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está cerrado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_actividad` | No se ha podido crear la actividad |

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
| `id` | string (uuid) | No |  | `8a1b2c3d-0000-4000-8000-000000000020` |
| `viaje_id` | string (uuid) | No |  | `123e4567-e89b-12d3-a456-426614174000` |
| `titulo` | string | No |  | `Visita al Coliseo` |
| `descripcion` | string \| null | No |  | `null` |
| `fecha` | string (date) | No |  | `2027-05-12` |
| `hora_inicio` | string \| null | No | Hora de inicio (HH:MM:SS) | `10:00:00` |
| `hora_fin` | string \| null | No | Hora de fin (HH:MM:SS) | `null` |
| `orden` | integer | No | Posición dentro del día; la nueva actividad va al final | `0` |
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

**409** — El viaje está archivado o finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está cerrado y ya no se puede modificar |

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

**409** — El viaje está archivado o finalizado (solo lectura)

| Código de error | Mensaje |
| --- | --- |
| `viaje_no_activo` | El viaje está cerrado y ya no se puede modificar |

**500** — Error interno del servidor

| Código de error | Mensaje |
| --- | --- |
| `error_interno` | Error interno del servidor |

**502** — Error al comunicarse con Supabase

| Código de error | Mensaje |
| --- | --- |
| `error_actividad` | No se ha podido eliminar la actividad |
