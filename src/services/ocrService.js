// Reconocimiento de texto (OCR) de la foto de un documento con tesseract.js, en el propio servidor.
// Idioma español. El motor se carga solo al usarlo, para no retrasar el arranque de la API.
// Antes de leer, la imagen se prepara con sharp: las fotos de tickets salen mejor en escala de grises,
// ampliadas y binarizadas (blanco y negro). Se leen dos variantes y se unen los textos, porque una sola
// a veces pierde la línea del total y la otra no.

const IDIOMA = 'spa';
// Ancho al que se amplía la foto antes de leerla: más píxeles por letra, menos errores
const ANCHO_LECTURA = 3000;
// Umbral del blanco y negro: separa el texto oscuro del papel
const UMBRAL_BINARIO = 150;

// Variantes de preparación de la imagen. Cada una devuelve una imagen PNG lista para leer
const variantes = [
  // En escala de grises, con el contraste estirado
  (sharp, imagen) => sharp(imagen).rotate().resize({ width: ANCHO_LECTURA }).greyscale().normalise().png().toBuffer(),
  // En blanco y negro: separa mejor el texto de las sombras y del fondo
  (sharp, imagen) =>
    sharp(imagen).rotate().resize({ width: ANCHO_LECTURA }).greyscale().normalise().threshold(UMBRAL_BINARIO).png().toBuffer(),
];

// Texto que hay en la imagen (puede venir vacío si no se reconoce nada)
const reconocerTexto = async (imagen) => {
  const sharp = require('sharp');
  const { createWorker } = require('tesseract.js');
  const trabajador = await createWorker(IDIOMA);
  try {
    const textos = [];
    for (const preparar of variantes) {
      const preparada = await preparar(sharp, imagen);
      const { data } = await trabajador.recognize(preparada);
      textos.push(data.text);
    }
    return textos.join('\n');
  } finally {
    await trabajador.terminate();
  }
};

module.exports = { reconocerTexto };
