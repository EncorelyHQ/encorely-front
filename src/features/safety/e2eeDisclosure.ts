// Fuente única del texto sobre el cifrado del chat (v1). La pantalla de privacidad y el chat lo leen de aquí
// para que nunca se contradigan. Los límites son obligatorios y no se suavizan.

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
  'Cada mensaje se cifra en tu teléfono y solo el teléfono de la otra persona lo puede abrir.',
  'El servidor solo guarda mensajes cifrados. Nadie de Encorely puede leerlos.',
  'El servidor sí sabe con quién hablas y cuándo, pero no qué se dicen.',
  'Si reportas a alguien y decides adjuntar mensajes, esos mensajes se envían sin cifrar al equipo de moderación. Solo pasa si tú lo eliges.',
]

export const E2EE_VERIFY: readonly string[] = [
  'Cada chat tiene un código de seguridad. Si el código que ves tú y el que ve la otra persona son iguales, nadie se metió en medio.',
  'Compárenlo en persona, por ejemplo cuando se vean en el concierto. Si el código cambia, el chat te avisa.',
]

export const E2EE_LIMITS: readonly DisclosureItem[] = [
  item(
    'noForwardSecrecy',
    'Sin forward secrecy',
    'si alguien roba la llave de tu teléfono, puede leer los mensajes que haya capturado antes y después.',
  ),
  item(
    'singleDevice',
    'Un solo teléfono',
    'si reinstalas la app o cambias de teléfono, se crea una llave nueva y los mensajes anteriores ya no se pueden leer.',
  ),
  item('noBackup', 'Sin copia de seguridad del historial', 'a propósito.'),
  item('manualVerification', 'Verificación manual', 'compara el código de seguridad en persona.'),
]
