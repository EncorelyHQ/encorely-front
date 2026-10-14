// Fuente única del texto sobre el cifrado del chat (v1.1: historial local, rotación de llaves, respaldo y traspaso).
// La pantalla de privacidad y el chat lo leen de aquí para que nunca se contradigan. Los límites son obligatorios y no
// se suavizan: lo que la app no hace no se insinúa.

export type DisclosureItem = {
  id: string
  // Lo que va antes de los dos puntos; la pantalla lo resalta.
  lead: string
  detail: string
  // Frase completa, para lectores de pantalla o para mostrarla en una sola línea.
  text: string
}

const item = (id: string, lead: string, detail: string): DisclosureItem => ({ id, lead, detail, text: `${lead}: ${detail}` })

export const E2EE_SUMMARY =
  'Tus mensajes se cifran en tu teléfono antes de salir. El servidor solo guarda mensajes cifrados: nadie de Encorely puede leerlos.'

export const E2EE_PROTECTS: readonly string[] = [
  'Cada mensaje se cifra en tu teléfono y solo la otra persona lo puede abrir, en su teléfono.',
  'El servidor solo guarda mensajes cifrados. Nadie de Encorely puede leerlos.',
  'Cuando tu teléfono guarda un mensaje recibido, le avisa al servidor y el servidor lo borra. Tu historial queda en tu teléfono, en una base cifrada.',
  'El servidor sí sabe con quién hablas y cuándo, pero no qué se dicen.',
  'Si reportas a alguien y decides adjuntar mensajes, esos mensajes se envían sin cifrar al equipo de moderación. Solo pasa si tú lo eliges.',
]

export const E2EE_VERIFY: readonly string[] = [
  'Cada chat tiene un código de seguridad. Si el código que ves tú y el que ve la otra persona son iguales, nadie se metió en medio.',
  'Compárenlo en persona, por ejemplo cuando se vean en el concierto. Si el código cambia, el chat te avisa.',
  'Tu llave de cifrado cambia cada semana, pero el código de seguridad no: solo cambia si alguien reinstala la app o cambia de teléfono sin pasar sus llaves.',
]

export const E2EE_LIMITS: readonly DisclosureItem[] = [
  item(
    'partialPastProtection',
    'Protección parcial de mensajes anteriores',
    'tu llave cambia cada 7 días y las anteriores se borran del teléfono cuando ya guardaste esos mensajes. Quien robe la llave vigente puede leer lo cifrado con ella, y no es tan fuerte como cambiar de llave en cada mensaje.',
  ),
  item(
    'historyOnPhone',
    'El historial vive en tu teléfono',
    'si lo pierdes o desinstalas la app sin respaldo, esos mensajes se pierden. El servidor ya los borró.',
  ),
  item(
    'backupPassphrase',
    'Respaldo opcional con tu frase',
    'si olvidas la frase, nadie puede recuperar tus mensajes, ni nosotros. El respaldo guarda las llaves del momento en que lo creas: mientras no lo borres, quien tenga la frase puede leer esos mensajes.',
  ),
  item(
    'transferNotMultiDevice',
    'Traspaso, no varios teléfonos',
    'vincular otro teléfono le pasa tu misma identidad. Está pensado para cambiar de teléfono: si sigues usando los dos, cada mensaje queda solo en el que lo descargue primero. El historial viaja por el respaldo, no por el traspaso.',
  ),
  item('manualVerification', 'Verificación manual', 'compara el código de seguridad en persona.'),
]
