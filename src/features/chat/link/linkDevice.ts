import { x25519 } from '@noble/curves/ed25519.js'
import { randomBytes } from '@noble/hashes/utils.js'
import type { FulfillLinkRequest, LinkRequest } from '@/lib/api/endpoints'
import {
  b64Decode,
  b64DecodeLength,
  b64Encode,
  constantTimeEqual,
  E2eeError,
  linkCode,
  linkQrPayload,
  openFromPublicKey,
  parseLinkQr,
  sealToPublicKey,
  utf8,
  utf8Decode,
  type RandomBytes,
  type SealedToKey,
} from '../crypto'
import type { KeyMaterial } from '../keys'
import type { ChatDeps } from '../data/deps'
import { ensureKeysPublished, forgetPublishedKeys } from '../data/publishKeys'
import { clearChatSessions } from '../data/session'

export type LinkTransport = {
  create: (ephemeralKey: string) => Promise<LinkRequest>
  get: (linkId: string) => Promise<LinkRequest>
  fulfill: (linkId: string, body: FulfillLinkRequest) => Promise<unknown>
  remove: (linkId: string) => Promise<unknown>
}

type LinkPayload = { v: 1; userId: string; keys: KeyMaterial }

// --- Teléfono NUEVO ---

export type PendingLink = {
  linkId: string
  expiresAt: number
  qr: string
  /** Efímera X25519: solo vive en memoria de esta pantalla y se borra al terminar. */
  secretKey: Uint8Array
  publicKey: Uint8Array
}

export type ReceivedLink = { code: string; sealed: SealedToKey }

/** Abre el buzón (10 min, un solo uso) y arma el QR `encorely-link:v1:<id>:<pública b64url>`. */
export async function openLinkRequest(transport: LinkTransport, random: RandomBytes = randomBytes): Promise<PendingLink> {
  const secretKey = random(32)
  const publicKey = x25519.getPublicKey(secretKey)
  const request = await transport.create(b64Encode(publicKey))
  // Si el servidor guardó otra llave, el viejo la rechazaría al compararla con el QR; mejor fallar aquí.
  if (!constantTimeEqual(b64DecodeLength(request.newDeviceEphemeralKey, 32), publicKey)) {
    secretKey.fill(0)
    throw new E2eeError('identity_mismatch')
  }
  return {
    linkId: request.id,
    expiresAt: Date.parse(request.expiresAt),
    qr: linkQrPayload(request.id, publicKey),
    secretKey,
    publicKey,
  }
}

/** Sondeo: null mientras el teléfono viejo no deja el material. El código sale de las dos efímeras. */
export async function checkLinkRequest(transport: LinkTransport, pending: PendingLink): Promise<ReceivedLink | null> {
  const request = await transport.get(pending.linkId)
  if (request.status !== 'ready' || !request.senderEphemeralKey || !request.nonce || !request.ciphertext) return null
  const sealed: SealedToKey = {
    senderEphemeralKey: b64DecodeLength(request.senderEphemeralKey, 32),
    nonce: b64DecodeLength(request.nonce, 24),
    ciphertext: b64Decode(request.ciphertext),
  }
  return { code: linkCode(pending.publicKey, sealed.senderEphemeralKey), sealed }
}

/**
 * Solo después de que la persona confirmó que el código coincide con el del otro teléfono: descifra, valida e
 * instala las llaves, destruye la efímera y el buzón, y publica una caja nueva por encima de la del servidor.
 */
export async function acceptLink(args: {
  deps: ChatDeps
  me: string
  transport: LinkTransport
  pending: PendingLink
  received: ReceivedLink
}): Promise<void> {
  const { pending } = args
  let payload: LinkPayload
  try {
    const plaintext = openFromPublicKey(pending.secretKey, pending.publicKey, args.received.sealed, utf8(pending.linkId))
    try {
      payload = JSON.parse(utf8Decode(plaintext)) as LinkPayload
    } catch {
      throw new E2eeError('malformed')
    } finally {
      plaintext.fill(0)
    }
  } finally {
    pending.secretKey.fill(0)
  }
  if (!payload || payload.v !== 1 || !payload.keys) throw new E2eeError('malformed')
  if (payload.userId !== args.me) throw new E2eeError('identity_mismatch')

  await args.deps.deviceKeys.importMaterial(args.me, payload.keys)
  clearChatSessions()
  forgetPublishedKeys()
  // El buzón vence solo en 10 min; borrarlo ya es higiene, no seguridad (el material solo abre con la efímera).
  await args.transport.remove(pending.linkId).catch(() => undefined)
  await ensureKeysPublished(args.deps, args.me, true)
}

export async function discardLink(transport: LinkTransport, pending: PendingLink): Promise<void> {
  pending.secretKey.fill(0)
  await transport.remove(pending.linkId)
}

// --- Teléfono VIEJO ---

export type PreparedTransfer = {
  linkId: string
  code: string
  send: () => Promise<void>
}

export class NotALinkQrError extends Error {
  constructor() {
    super('Not an Encorely link QR')
    this.name = 'NotALinkQrError'
  }
}

/**
 * Lee el QR, comprueba que el buzón del servidor tiene LA MISMA efímera que el QR (si no, el servidor la cambió) y
 * cifra identidad, cadena y cajas vigentes hacia ella. No envía nada hasta `send()`.
 */
export async function prepareLinkTransfer(args: {
  deps: ChatDeps
  me: string
  transport: LinkTransport
  qrText: string
  random?: RandomBytes
}): Promise<PreparedTransfer> {
  const parsed = parseLinkQr(args.qrText)
  if (!parsed) throw new NotALinkQrError()
  const request = await args.transport.get(parsed.linkId)
  if (request.status !== 'pending') throw new E2eeError('invalid_input')
  if (!constantTimeEqual(b64DecodeLength(request.newDeviceEphemeralKey, 32), parsed.newDevicePublic)) {
    throw new E2eeError('identity_mismatch')
  }

  const keys = await args.deps.deviceKeys.exportMaterial(args.me)
  const payload: LinkPayload = { v: 1, userId: args.me, keys }
  const plaintext = utf8(JSON.stringify(payload))
  const sealed = sealToPublicKey(parsed.newDevicePublic, plaintext, utf8(parsed.linkId), args.random)
  plaintext.fill(0)
  const body: FulfillLinkRequest = {
    senderEphemeralKey: b64Encode(sealed.senderEphemeralKey),
    nonce: b64Encode(sealed.nonce),
    ciphertext: b64Encode(sealed.ciphertext),
  }
  return {
    linkId: parsed.linkId,
    code: linkCode(parsed.newDevicePublic, sealed.senderEphemeralKey),
    send: async () => {
      await args.transport.fulfill(parsed.linkId, body)
    },
  }
}
