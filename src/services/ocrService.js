// Reconocimiento de texto (OCR) de la foto de un documento con tesseract.js, en el propio servidor.
// Idioma español. El motor se carga la primera vez que se usa y después se reutiliza: cargar el idioma es lo más caro.
// Las lecturas se hacen una a una. La foto se prepara con sharp (enderezar según la orientación, escala de grises,
// filtro de mediana para quitar el ruido y contraste). Si la lectura sale con poca confianza, se prueba una segunda
// versión en blanco y negro y se queda con la que tenga más confianza.

const { createWorker } = require('tesseract.js');

const IDIOMA = 'spa';
// Ancho al que se reduce la foto antes de leerla: suficiente para las letras y mucho más rápido que las fotos de móvil enteras
const ANCHO_LECTURA = 1600;
// Filtro de mediana: quita el ruido de la foto sin borrar las letras (con más ruido, Tesseract tarda mucho más)
const FILTRO_RUIDO = 5;
// Por debajo de esta confianza (0-100) se prueba la versión en blanco y negro
const CONFIANZA_MINIMA = 75;
// Umbral del blanco y negro: separa el texto oscuro del papel
const UMBRAL_BINARIO = 150;

// Motor de lectura reutilizado. Si no se puede cargar, se olvida para que la siguiente petición lo vuelva a intentar
let motor = null;
const obtenerMotor = () => {
  if (!motor) {
    motor = createWorker(IDIOMA).catch((error) => {
      motor = null;
      throw error;
    });
  }
  return motor;
};

// Prepara la foto para leerla: enderezada, reducida, en gris sin ruido y con el contraste estirado
const preparar = (sharp, imagen, umbral) => {
  let preparada = sharp(imagen)
    .rotate()
    .resize({ width: ANCHO_LECTURA })
    .greyscale()
    .median(FILTRO_RUIDO)
    .normalise();
  if (umbral) preparada = preparada.threshold(umbral);
  return preparada.png().toBuffer();
};

const leer = async (imagen) => {
  const sharp = require('sharp');
  const trabajador = await obtenerMotor();

  const primera = await trabajador.recognize(await preparar(sharp, imagen));
  if (primera.data.confidence >= CONFIANZA_MINIMA) return primera.data.text;

  const segunda = await trabajador.recognize(await preparar(sharp, imagen, UMBRAL_BINARIO));
  return segunda.data.confidence > primera.data.confidence ? segunda.data.text : primera.data.text;
};

// Cola: una lectura detrás de otra, para que dos escaneos a la vez no se pisen en el mismo motor
let cola = Promise.resolve();

// Texto que hay en la imagen (puede venir vacío si no se reconoce nada)
const reconocerTexto = (imagen) => {
  const turno = cola.then(() => leer(imagen));
  cola = turno.catch(() => {});
  return turno;
};

module.exports = { reconocerTexto };
