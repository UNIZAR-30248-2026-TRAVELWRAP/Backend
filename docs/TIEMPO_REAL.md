# Tiempo real (WebSockets)

La API REST (ver [API.md](API.md)) es la única que modifica datos. Por WebSocket el servidor solo **avisa** de los cambios, para que las pantallas abiertas se actualicen sin recargar.

El servidor usa Socket.io 4 en el mismo puerto que la API (`http://localhost:3000` en local), con un namespace por funcionalidad:

| Namespace | Estado | Uso |
| --- | --- | --- |
| `/votaciones` | Implementado | Cambios en las votaciones de un viaje |
| `/chat` | Esqueleto | Mensajes del chat del grupo |
| `/notificaciones` | Esqueleto | Notificaciones al usuario |

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

El aviso **no lleva los datos de la votación**: el cliente la vuelve a pedir con `GET /viajes/{viajeId}/votaciones/{votacionId}`, o la lista entera si el motivo es `creada`. Así cada usuario recibe su propio `mi_voto` y se siguen aplicando las políticas RLS.

### Seguridad

- Solo se aceptan conexiones con una sesión válida de Supabase, comprobada igual que en la API REST (`comprobarToken` en `authMiddleware.js`).
- Para unirse a la sala de un viaje hay que ser miembro activo, y se comprueba con las políticas RLS del usuario.
- Los avisos no contienen datos personales ni el contenido de las votaciones.

### Código y pruebas

- Servidor: `src/sockets/votacionesSocket.js`, configurado en `src/index.js`. Los controladores de votaciones avisan después de cada cambio que sale bien.
- Pruebas: `test/votacionesSocket.test.js`, con un servidor de Socket.io y clientes reales, y los avisos de `test/votacion.test.js`.
