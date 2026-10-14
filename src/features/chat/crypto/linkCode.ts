import { sha256 } from '@noble/hashes/sha2.js'

import { b64urlDecode, b64urlEncode, concat, utf8 } from './bytes'
import { E2eeError } from './errors'

const CODE_CONTEXT = utf8('ENCORELY-LINKCODE-v1')
const QR_PREFIX = 'encorely-link:v1:'
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * 6 dígitos que los dos teléfonos calculan igual a partir de las dos efímeras. El teléfono nuevo solo instala
 * el material si la persona confirma que coincide con el del viejo: así el servidor no puede colarle llaves
 * propias poniendo otra efímera de remitente (acertar el código a ciegas es 1 en un millón, y el buzón es de un uso).
 */
export function linkCode(newDevicePublic: Uint8Array, senderPublic: Uint8Array): string {
  if (newDevicePublic.length !== 32 || senderPublic.length !== 32) throw new E2eeError('invalid_key')
  const digest = sha256(concat(CODE_CONTEXT, newDevicePublic, senderPublic))
  const n = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0
  return String(n % 1_000_000).padStart(6, '0')
}

export function linkQrPayload(linkId: string, newDevicePublic: Uint8Array): string {
  if (!UUID.test(linkId) || newDevicePublic.length !== 32) throw new E2eeError('invalid_input')
  return `${QR_PREFIX}${linkId.toLowerCase()}:${b64urlEncode(newDevicePublic)}`
}

export type ParsedLinkQr = { linkId: string; newDevicePublic: Uint8Array }

/** null si no es un QR de vinculación de Encorely (p. ej. el del código de seguridad). */
export function parseLinkQr(text: string): ParsedLinkQr | null {
  if (typeof text !== 'string' || !text.startsWith(QR_PREFIX)) return null
  const [linkId, key, ...rest] = text.slice(QR_PREFIX.length).split(':')
  if (rest.length > 0 || !linkId || !key || !UUID.test(linkId)) return null
  try {
    const newDevicePublic = b64urlDecode(key)
    return newDevicePublic.length === 32 ? { linkId: linkId.toLowerCase(), newDevicePublic } : null
  } catch {
    return null
  }
}
