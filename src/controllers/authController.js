const authService = require('../services/authService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_OAUTH = 'tw_oauth';
const RUTA_COOKIE_OAUTH = '/api/auth/google';

const backendUrl = () => process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT || 3000}`;
const frontendUrl = () => process.env.FRONTEND_URL ?? 'http://localhost:5173';

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

const codificar = (valor) => Buffer.from(JSON.stringify(valor)).toString('base64url');

const decodificar = (valor) => {
  try {
    return JSON.parse(Buffer.from(valor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const leerCookie = (req, nombre) => {
  const cabecera = req.headers.cookie ?? '';
  const par = cabecera
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
};

const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: backendUrl().startsWith('https://'),
  path: RUTA_COOKIE_OAUTH,
});

const redirigirAlFrontend = (res, fragmento) =>
  res.redirect(302, `${frontendUrl()}/auth/callback#${fragmento}`);

const login = async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return responderError(res, 400, 'datos_invalidos', 'El email no es válido');
  }
  if (typeof password !== 'string' || password.length === 0) {
    return responderError(res, 400, 'datos_invalidos', 'La contraseña es obligatoria');
  }

  try {
    const resultado = await authService.login(email.trim(), password);

    if (resultado.error) {
      if (resultado.error.code === 'email_not_confirmed') {
        return responderError(res, 401, 'email_no_confirmado', 'El email no está confirmado');
      }
      if (resultado.error.code === 'invalid_credentials' || resultado.error.status === 400) {
        return responderError(res, 401, 'credenciales_invalidas', 'Email o contraseña incorrectos');
      }
      return responderError(res, 502, 'error_autenticacion', 'No se ha podido iniciar sesión');
    }

    return res.status(200).json(resultado);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const refresh = async (req, res) => {
  const { refresh_token: refreshToken } = req.body ?? {};

  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return responderError(res, 400, 'datos_invalidos', 'El refresh_token es obligatorio');
  }

  try {
    const resultado = await authService.refrescar(refreshToken);

    if (resultado.error) {
      if (resultado.error.status >= 500) {
        return responderError(res, 502, 'error_autenticacion', 'No se ha podido renovar la sesión');
      }
      return responderError(res, 401, 'sesion_invalida', 'La sesión ha caducado o no es válida');
    }

    return res.status(200).json(resultado);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const googleInicio = async (req, res) => {
  try {
    const resultado = await authService.iniciarGoogle(`${backendUrl()}/api/auth/google/callback`);
    if (resultado.error) return redirigirAlFrontend(res, 'error=google');

    res.cookie(COOKIE_OAUTH, codificar(resultado.almacen), { ...opcionesCookie(), maxAge: 10 * 60 * 1000 });
    return res.redirect(302, resultado.url);
  } catch {
    return redirigirAlFrontend(res, 'error=google');
  }
};

const googleCallback = async (req, res) => {
  const almacen = decodificar(leerCookie(req, COOKIE_OAUTH) ?? '');
  res.clearCookie(COOKIE_OAUTH, opcionesCookie());

  if (req.query.error) return redirigirAlFrontend(res, 'error=google_cancelado');

  const codigo = typeof req.query.code === 'string' ? req.query.code : '';
  if (!codigo || !almacen) return redirigirAlFrontend(res, 'error=google');

  try {
    const flowId = typeof req.query.sb_flow_id === 'string' ? req.query.sb_flow_id : undefined;
    const resultado = await authService.completarGoogle(codigo, almacen, flowId);
    if (resultado.error) return redirigirAlFrontend(res, 'error=google');

    return redirigirAlFrontend(res, `sesion=${codificar(resultado)}`);
  } catch {
    return redirigirAlFrontend(res, 'error=google');
  }
};

module.exports = { login, refresh, googleInicio, googleCallback };
