const gastoService = require('../services/gastoService');
const { UUID_REGEX, CHECK_VIOLATION, responderError, fechaValida, textoOpcional } = require('../utils/validacion');

const MAX_CONCEPTO = 100;
// numeric(12,2): diez cifras enteras y dos decimales
const MAX_IMPORTE = 9999999999.99;
const CATEGORIAS = new Set(['comida', 'transporte', 'entradas', 'alojamiento', 'ocio', 'otros']);

const validarConcepto = (valor) => {
  const concepto = typeof valor === 'string' ? valor.trim() : '';
  if (concepto === '' || concepto.length > MAX_CONCEPTO) {
    return { error: `El concepto es obligatorio y tiene un máximo de ${MAX_CONCEPTO} caracteres` };
  }
  return { valor: concepto };
};

const validarImporte = (valor) => {
  const centimos = typeof valor === 'number' ? valor * 100 : Number.NaN;
  const dosDecimales = Number.isFinite(centimos) && Math.abs(centimos - Math.round(centimos)) < 1e-6;
  if (!dosDecimales || valor <= 0 || valor > MAX_IMPORTE) {
    return { error: 'El importe debe ser un número mayor que 0 con dos decimales como máximo' };
  }
  return { valor: Math.round(centimos) / 100 };
};

const validarCategoria = (valor) => {
  const categoria = textoOpcional(valor);
  if (categoria === undefined || (categoria !== null && !CATEGORIAS.has(categoria))) {
    return { error: 'La categoría debe ser comida, transporte, entradas, alojamiento, ocio u otros' };
  }
  return { valor: categoria };
};

const validarPagadoPor = (valor) => {
  if (typeof valor !== 'string' || !UUID_REGEX.test(valor)) {
    return { error: 'Indica qué miembro del viaje ha pagado el gasto' };
  }
  return { valor };
};

const validarFecha = (valor) => {
  const fecha = textoOpcional(valor);
  if (fecha === undefined || (fecha !== null && !fechaValida(fecha))) {
    return { error: 'La fecha debe tener el formato AAAA-MM-DD' };
  }
  return { valor: fecha };
};

const validarParticipantes = (valor) => {
  const valido = Array.isArray(valor) && valor.length > 0 && valor.every((id) => typeof id === 'string' && UUID_REGEX.test(id));
  if (!valido) return { error: 'Indica al menos un miembro del viaje entre los que se divide el gasto' };

  const participantes = valor.map((id) => id.toLowerCase());
  if (new Set(participantes).size !== participantes.length) {
    return { error: 'Cada miembro solo puede aparecer una vez en el reparto' };
  }
  return { valor: participantes };
};

const validarNuevoGasto = (cuerpo) => {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};

  const concepto = validarConcepto(datos.concepto);
  if (concepto.error) return concepto;
  const importe = validarImporte(datos.importe);
  if (importe.error) return importe;
  const categoria = validarCategoria(datos.categoria);
  if (categoria.error) return categoria;
  const pagadoPor = validarPagadoPor(datos.pagado_por);
  if (pagadoPor.error) return pagadoPor;
  const fecha = validarFecha(datos.fecha);
  if (fecha.error) return fecha;
  const participantes = validarParticipantes(datos.participantes);
  if (participantes.error) return participantes;

  return {
    datos: {
      concepto: concepto.valor,
      importe: importe.valor,
      categoria: categoria.valor,
      pagado_por: pagadoPor.valor.toLowerCase(),
      fecha: fecha.valor,
      participantes: participantes.valor,
    },
  };
};

const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está cerrado y ya no se puede modificar'],
  no_miembro: [400, 'datos_invalidos', 'Quien paga y los participantes tienen que ser miembros del viaje'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_gasto', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await gastoService.listar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se han podido obtener los gastos');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener los gastos');
    return res.status(200).json({ gastos: resultado.gastos, total: resultado.total });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const crear = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const validacion = validarNuevoGasto(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await gastoService.crear(req.supabase, viajeId, validacion.datos);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del gasto no son válidos');
      }
      return responderError(res, 502, 'error_gasto', 'No se ha podido registrar el gasto');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido registrar el gasto');
    return res.status(201).json(resultado.gasto);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, crear };
