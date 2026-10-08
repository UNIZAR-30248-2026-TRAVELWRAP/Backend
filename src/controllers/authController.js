const authService = require('../services/authService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

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

module.exports = { login, refresh };
