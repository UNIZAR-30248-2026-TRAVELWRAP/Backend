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
| GET | [`/viajes/{viajeId}/invitacion`](#get-viajesviajeidinvitacion) | Obtiene el enlace de invitación de un viaje | Token de sesión |
| POST | [`/invitaciones/{token}/unirse`](#post-invitacionestokenunirse) | Une al usuario autenticado al viaje del enlace de invitación | Token de sesión |

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
