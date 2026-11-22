# Tiempo real (WebSockets)

La API REST (ver [API.md](API.md)) es la única que modifica datos. Por WebSocket el servidor solo **avisa** de los cambios, para que las pantallas abiertas se actualicen sin recargar.

El servidor usa Socket.io 4 en el mismo puerto que la API (`http://localhost:3000` en local), con un namespace por funcionalidad:

| Namespace | Estado | Uso |
| --- | --- | --- |
| `/votaciones` | Implementado | Cambios en las votaciones de un viaje |
| `/chat` | Implementado | Mensajes nuevos del chat del grupo |
| `/notificaciones` | Implementado | Avisos de votaciones, gastos, tareas y mensajes nuevos |

## `/chat`

### Conexión

Igual que `/votaciones`, con el mismo `token` de sesión:

```js
const socket = io("http://localhost:3000/chat", {
  auth: { token },
  transports: ["websocket"],
})
```

Los errores de conexión son los mismos que en `/votaciones`.

### Eventos que envía el cliente

| Evento | Datos | Respuesta (acknowledgement, opcional) | Qué hace |
| --- | --- | --- | --- |
| `unirse_viaje` | `{ viaje_id }` | `{ ok: true }` o `{ error: { codigo, mensaje } }` | Empieza a recibir los mensajes del viaje. Solo para sus miembros activos: si no lo es, responde `viaje_no_encontrado`. |
| `salir_viaje` | `{ viaje_id }` | — | Deja de recibir los mensajes de ese viaje. |

Al reconectarse hay que volver a emitir `unirse_viaje`.

### Eventos que envía el servidor

**`mensaje`**: se ha guardado un mensaje nuevo en el viaje. Se envía a todos los miembros unidos a la sala, incluido quien lo escribió (que así no necesita añadirlo a mano). El mensaje tiene el mismo formato que la respuesta de `POST /viajes/{viajeId}/mensajes`:

```json
{
  "viaje_id": "…",
  "mensaje": {
    "id": "…",
    "texto": "¿A qué hora quedamos?",
    "creado_en": "2026-05-12T10:00:00Z",
    "autor": { "usuario_id": "…", "nombre": "Adriana", "avatar_url": null }
  }
}
```

El mensaje se envía solo después de guardarse en la base de datos. Escribir sigue siendo solo por la API REST: por el socket no se envían mensajes.

### Seguridad

- Solo se aceptan conexiones con una sesión válida, y solo se une a la sala de un viaje quien es miembro activo.
- Los mensajes salen únicamente a los miembros del viaje, porque cada sala es de un viaje.

### Código

- Servidor: `src/sockets/chatSocket.js`, configurado en `src/index.js`. `mensajeController.js` avisa después de cada mensaje guardado.

## `/votaciones`

### Conexión

El cliente se conecta con su token de sesión, el mismo `token` que usa la API REST:

```js
import { io } from "socket.io-client"

const socket = io("http://localhost:3000/votaciones", {
  auth: { token },
  transports: ["websocket"],
})
```

Si el token falta o no es válido, se rechaza la conexión. El cliente recibe `connect_error` y, en `err.data`, un error con el mismo formato que los de la API: `{ codigo, mensaje }`. Los códigos posibles son `sin_sesion`, `sesion_invalida`, `error_autenticacion` y `error_interno`.

### Eventos que envía el cliente

| Evento | Datos | Respuesta (acknowledgement, opcional) | Qué hace |
| --- | --- | --- | --- |
| `unirse_viaje` | `{ viaje_id }` | `{ ok: true }` o `{ error: { codigo, mensaje } }` | Empieza a recibir los cambios de las votaciones del viaje. Solo para sus miembros activos: si no lo es, responde `viaje_no_encontrado`; con un identificador mal formado, `datos_invalidos`. |
| `salir_viaje` | `{ viaje_id }` | — | Deja de recibir los cambios de ese viaje. |

Al reconectarse, el cliente tiene que volver a emitir `unirse_viaje`, porque las salas no se conservan entre conexiones.

### Eventos que envía el servidor

**`votacion_cambiada`**: una votación del viaje ha cambiado. Se envía a todos los miembros unidos al viaje, incluido quien hizo el cambio.

```json
{ "viaje_id": "…", "votacion_id": "…", "motivo": "voto" }
```

| `motivo` | Cuándo se envía (endpoint REST que lo provoca) |
| --- | --- |
| `creada` | Se ha creado una votación (`POST /viajes/{viajeId}/votaciones`) |
| `opcion` | Se ha propuesto una opción (`POST .../votaciones/{votacionId}/opciones`) |
| `voto` | Alguien ha votado, cambiado o retirado su voto (`PUT` y `DELETE .../voto`) |
| `cerrada` | El creador ha cerrado la votación (`POST .../cerrar`). Si es la de destino, incluye además `destino` con el destino fijado en el viaje |
| `miembros` | Alguien nuevo se ha unido al viaje (`POST /invitaciones/{token}/unirse`). No lleva `votacion_id`: cambia quién puede votar en todas las votaciones del viaje, y con ello `total_miembros` y `todos_han_votado` |

El aviso **no lleva los datos de la votación**: el cliente la vuelve a pedir con `GET /viajes/{viajeId}/votaciones/{votacionId}`, o la lista entera si el motivo es `creada`. Con `miembros` vuelve a pedir también el viaje, para mostrar a los miembros nuevos. Así cada usuario recibe su propio `mi_voto` y se siguen aplicando las políticas RLS.

### Seguridad

- Solo se aceptan conexiones con una sesión válida de Supabase, comprobada igual que en la API REST (`comprobarToken` en `authMiddleware.js`).
- Para unirse a la sala de un viaje hay que ser miembro activo, y se comprueba con las políticas RLS del usuario.
- Los avisos no contienen datos personales ni el contenido de las votaciones.

### Código y pruebas

- Servidor: `src/sockets/votacionesSocket.js`, configurado en `src/index.js`. Los controladores de votaciones avisan después de cada cambio que sale bien, y el de invitaciones cuando se une un miembro nuevo.
- Pruebas: `test/votacionesSocket.test.js`, con un servidor de Socket.io y clientes reales, y los avisos de `test/votacion.test.js` y `test/invitationController.test.js`.

## `/notificaciones`

Avisa a cada usuario de lo que pasa en sus viajes. Se conecta igual que `/chat` (`auth: { token }`, `transports: ["websocket"]`), pero **no hace falta unirse a ningún viaje**: el servidor mete a cada usuario en su sala personal y le envía los avisos de todos sus viajes.

### Eventos que envía el cliente

Ninguno.

### Eventos que envía el servidor

**`notificacion`**: otro miembro ha creado una votación, registrado un gasto, añadido una tarea o enviado un mensaje. Se envía a los demás miembros activos del viaje, nunca a quien lo ha generado.

```json
{
  "viaje_id": "123e4567-e89b-12d3-a456-426614174000",
  "viaje_nombre": "Roma 2027",
  "tipo": "gasto",
  "pantalla": "gastos",
  "texto": "Ana ha registrado un gasto: Cena"
}
```

`tipo` es `votacion`, `gasto`, `tarea` o `mensaje`, y `pantalla` (a la que lleva el aviso) es `votaciones`, `gastos`, `tareas` o `chat`.

### Notificaciones push

La misma carga se envía con Web Push a los dispositivos que han activado las notificaciones (`POST /notificaciones/suscripciones`). El servidor necesita `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en su entorno; sin ellas no hay push, pero los avisos por socket siguen funcionando. El service worker no muestra la notificación si la app está abierta y a la vista, porque ya sale el aviso dentro de la app.
