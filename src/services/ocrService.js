// Reconocimiento de texto (OCR) de la foto de un ticket con tesseract.js, en el propio servidor.
// Idioma español. El motor se carga solo al usarlo, para no retrasar el arranque de la API

const IDIOMA = 'spa';

// Texto que hay en la imagen (puede venir vacío si no se reconoce nada)
const reconocerTexto = async (imagen) => {
  const { createWorker } = require('tesseract.js');
  const trabajador = await createWorker(IDIOMA);
  try {
    const { data } = await trabajador.recognize(imagen);
    return data.text;
  } finally {
    await trabajador.terminate();
  }
};

module.exports = { reconocerTexto };
