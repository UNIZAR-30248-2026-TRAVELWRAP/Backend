const votacionService = require('../services/votacionService');
const votacionesSocket = require('../sockets/votacionesSocket');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ['abierta', 'cerrada'];
const TIPOS = ['fecha', 'destino', 'presupuesto', 'actividad', 'otro'];
// La de destino solo la abre el sistema al crear un viaje sin destino
const TIPOS_CREABLES = TIPOS.filter((tipo) => tipo !== 'destino');
const MAX_TITULO = 200;
const MAX_DESCRIPCION = 500;
const MAX_TEXTO_OPCION = 100;
const MIN_OPCIONES = 2;
const MAX_OPCIONES = 20;

// Códigos de PostgreSQL: opción repetida en la votación (índice único) y check incumplido
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

const fechaValida = (texto) => {
  if (!FECHA_REGEX.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto);
};

// Texto obligatorio, sin espacios a los lados y con longitud máxima. Devuelve null si no es válido
const textoObligatorio = (valor, maximo) => {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return texto === '' || texto.length > maximo ? null : texto;
};

// Opción de una votación: { texto, valor_fecha } (la fecha solo en las votaciones de fechas, y opcional)
const validarOpcion = (valor) => {
  const datos = valor !== null && typeof valor === 'object' ? valor : {};
  const texto = textoObligatorio(datos.texto, MAX_TEXTO_OPCION);
  if (!texto) return { error: `Cada opción necesita un texto de ${MAX_TEXTO_OPCION} caracteres como máximo` };

  const fecha = datos.valor_fecha ?? null;
  if (fecha !== null && (typeof fecha !== 'string' || !fechaValida(fecha))) {
    return { error: 'La fecha de la opción debe tener el formato AAAA-MM-DD' };
  }
  return { valor: { texto, valor_fecha: fecha } };
};

const validarNuevaVotacion = (cuerpo) => {
  const datos = cuerpo ?? {};

  const titulo = textoObligatorio(datos.titulo, MAX_TITULO);
  if (!titulo) return { error: `El título es obligatorio y tiene un máximo de ${MAX_TITULO} caracteres` };

  let descripcion = null;
  if (datos.descripcion !== undefined && datos.descripcion !== null) {
    if (typeof datos.descripcion !== 'string' || datos.descripcion.trim().length > MAX_DESCRIPCION) {
      return { error: `La descripción debe ser un texto de ${MAX_DESCRIPCION} caracteres como máximo` };
    }
    descripcion = datos.descripcion.trim() || null;
  }

  const tipo = datos.tipo ?? 'otro';
  if (!TIPOS_CREABLES.includes(tipo)) {
    return { error: `El tipo debe ser ${TIPOS_CREABLES.join(', ')}` };
  }

  if (!Array.isArray(datos.opciones) || datos.opciones.length < MIN_OPCIONES || datos.opciones.length > MAX_OPCIONES) {
    return { error: `La votación necesita entre ${MIN_OPCIONES} y ${MAX_OPCIONES} opciones` };
  }
  const opciones = [];
  for (const valor of datos.opciones) {
    const opcion = validarOpcion(valor);
    if (opcion.error) return opcion;
    opciones.push(opcion.valor);
  }
  const textos = new Set(opciones.map((o) => o.texto.toLowerCase()));
  if (textos.size !== opciones.length) return { error: 'Las opciones no se pueden repetir' };

  return { datos: { titulo, descripcion, tipo, opciones } };
};

// Respuesta de error para cada motivo por el que no se puede consultar, votar o cerrar una votación
const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_encontrada: [404, 'votacion_no_encontrada', 'La votación no existe en este viaje'],
  no_creador: [403, 'no_creador', 'Solo el creador del viaje puede cerrar las votaciones'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está cerrado y ya no se puede modificar'],
  votacion_cerrada: [409, 'votacion_cerrada', 'La votación ya está cerrada'],
  faltan_votos: [409, 'faltan_votos', 'La votación solo se puede cerrar cuando hayan votado todos los miembros'],
  opcion_no_valida: [400, 'opcion_no_valida', 'La opción no es de esta votación'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_votacion', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

// Fallo de la base de datos: una opción repetida o un dato fuera de rango tienen su propia respuesta
const responderFallo = (res, error, mensajeFallo) => {
  if (error.code === UNIQUE_VIOLATION) {
    return responderError(res, 409, 'opcion_duplicada', 'Esa opción ya está en la votación');
  }
  if (error.code === CHECK_VIOLATION) {
    return responderError(res, 400, 'datos_invalidos', 'Los datos de la votación no son válidos');
  }
  return responderError(res, 502, 'error_votacion', mensajeFallo);
};

// Comprueba los identificadores de la ruta. Devuelve false (y responde) si alguno no es válido
const idsValidos = (req, res) => {
  const { viajeId, votacionId } = req.params;
  if (!UUID_REGEX.test(viajeId) || (votacionId !== undefined && !UUID_REGEX.test(votacionId))) {
    responderError(res, 400, 'datos_invalidos', 'El identificador del viaje o de la votación no es válido');
    return false;
  }
  return true;
};

// Ejecuta la acción del servicio y responde con la votación (o con el motivo por el que no se ha podido).
// Si la acción cambia la votación (motivo), avisa en tiempo real a los miembros del viaje
const ejecutar = async (res, accion, codigoOk, mensajeFallo, aviso) => {
  try {
    const resultado = await accion();
    if (resultado.error) return responderFallo(res, resultado.error, mensajeFallo);
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, mensajeFallo);
    if (aviso) votacionesSocket.avisarCambio(aviso.viajeId, { votacion_id: resultado.votacion.id, motivo: aviso.motivo });
    return res.status(codigoOk).json(resultado.votacion);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const listar = async (req, res) => {
  if (!idsValidos(req, res)) return;
  const { estado, tipo } = req.query;
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return responderError(res, 400, 'datos_invalidos', 'El estado debe ser abierta o cerrada');
  }
  if (tipo !== undefined && !TIPOS.includes(tipo)) {
    return responderError(res, 400, 'datos_invalidos', `El tipo debe ser ${TIPOS.join(', ')}`);
  }

  try {
    const resultado = await votacionService.listar(req.supabase, req.usuario.id, req.params.viajeId, { estado, tipo });
    if (resultado.error) return responderError(res, 502, 'error_votacion', 'No se han podido obtener las votaciones');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener las votaciones');
    return res.status(200).json({ votaciones: resultado.votaciones });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const obtener = async (req, res) => {
  if (!idsValidos(req, res)) return;
  const { viajeId, votacionId } = req.params;
  return ejecutar(
    res,
    () => votacionService.obtener(req.supabase, req.usuario.id, viajeId, votacionId),
    200,
    'No se ha podido obtener la votación',
  );
};

const crear = async (req, res) => {
  if (!idsValidos(req, res)) return;
  const validacion = validarNuevaVotacion(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  return ejecutar(
    res,
    () => votacionService.crear(req.supabase, req.usuario.id, req.params.viajeId, validacion.datos),
    201,
    'No se ha podido crear la votación',
    { viajeId: req.params.viajeId, motivo: 'creada' },
  );
};

const anadirOpcion = async (req, res) => {
  if (!idsValidos(req, res)) return;
  const validacion = validarOpcion(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  const { viajeId, votacionId } = req.params;
  return ejecutar(
    res,
    () => votacionService.anadirOpcion(req.supabase, req.usuario.id, viajeId, votacionId, validacion.valor),
    201,
    'No se ha podido añadir la opción',
    { viajeId, motivo: 'opcion' },
  );
};

const votar = async (req, res) => {
  if (!idsValidos(req, res)) return;
  const opcionId = req.body?.opcion_id;
  if (typeof opcionId !== 'string' || !UUID_REGEX.test(opcionId)) {
    return responderError(res, 400, 'datos_invalidos', 'Indica la opción que votas (opcion_id)');
  }

  const { viajeId, votacionId } = req.params;
  return ejecutar(
    res,
    () => votacionService.votar(req.supabase, req.usuario.id, viajeId, votacionId, opcionId),
    200,
    'No se ha podido guardar el voto',
    { viajeId, motivo: 'voto' },
  );
};

const retirarVoto = async (req, res) => {
  if (!idsValidos(req, res)) return;
  const { viajeId, votacionId } = req.params;
  return ejecutar(
    res,
    () => votacionService.retirarVoto(req.supabase, req.usuario.id, viajeId, votacionId),
    200,
    'No se ha podido retirar el voto',
    { viajeId, motivo: 'voto' },
  );
};

const cerrar = async (req, res) => {
  if (!idsValidos(req, res)) return;
  const { viajeId, votacionId } = req.params;

  try {
    const resultado = await votacionService.cerrar(req.supabase, req.usuario.id, viajeId, votacionId);
    if (resultado.error) return responderError(res, 502, 'error_votacion', 'No se ha podido cerrar la votación');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido cerrar la votación');
    const { votacion, hubo_empate, destino } = resultado;
    votacionesSocket.avisarCambio(viajeId, { votacion_id: votacion.id, motivo: 'cerrada', destino });
    return res.status(200).json({ votacion, hubo_empate, destino });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, obtener, crear, anadirOpcion, votar, retirarVoto, cerrar };
