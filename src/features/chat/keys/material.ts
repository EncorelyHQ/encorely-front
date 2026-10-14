import { ed25519, x25519 } from '@noble/curves/ed25519.js'

import { b64DecodeLength, b64Encode, constantTimeEqual } from '../crypto/bytes'
import { boxKeyPairFromChain } from '../crypto/boxChain'
import { E2eeError } from '../crypto/errors'
import { isValidBoxKeyId, verifyBoxKey } from '../crypto/keyBundle'

/**
 * Lo que viaja en un respaldo o en un traspaso: identidad, cadena vigente y las cajas privadas que el teléfono
 * aún conserva (las ya borradas por la rotación no existen en ningún lado, y así debe ser).
 */
export interface KeyMaterial {
  v: 1
  identity: { sk: string; pk: string }
  /** chain_n vigente (base64) y el boxKeyId de la caja que salió de él. null en instalaciones v1 sin cadena. */
  chain: string | null
  chainKeyId: number | null
  current: number
  rotatedAt: number | null
  boxKeys: { id: number; sk: string; pk: string; sig: string }[]
}

export interface DecodedMaterial {
  identity: { secretKey: Uint8Array; publicKey: Uint8Array }
  chain: Uint8Array | null
  chainKeyId: number | null
  current: number
  rotatedAt: number | null
  boxKeys: { id: number; secretKey: Uint8Array; publicKey: Uint8Array; sig: Uint8Array }[]
}

function fail(): never {
  throw new E2eeError('invalid_key')
}

/**
 * Valida todo antes de instalar: cada privada debe producir su pública, cada caja debe estar firmada por esa
 * identidad y la cadena debe producir la caja que dice. Un material incoherente no se instala a medias.
 */
export function decodeKeyMaterial(value: unknown): DecodedMaterial {
  const m = value as Partial<KeyMaterial> | null
  if (!m || m.v !== 1 || !m.identity || !Array.isArray(m.boxKeys) || m.boxKeys.length === 0) fail()
  if (!isValidBoxKeyId(m.current)) fail()
  try {
    const identity = {
      secretKey: b64DecodeLength(m.identity.sk, 32),
      publicKey: b64DecodeLength(m.identity.pk, 32),
    }
    if (!constantTimeEqual(ed25519.getPublicKey(identity.secretKey), identity.publicKey)) fail()

    const seen = new Set<number>()
    const boxKeys = m.boxKeys.map((box) => {
      if (!box || !isValidBoxKeyId(box.id) || seen.has(box.id)) fail()
      seen.add(box.id)
      const secretKey = b64DecodeLength(box.sk, 32)
      const publicKey = b64DecodeLength(box.pk, 32)
      const sig = b64DecodeLength(box.sig, 64)
      if (!constantTimeEqual(x25519.getPublicKey(secretKey), publicKey)) fail()
      verifyBoxKey({ identityKey: m.identity!.pk, boxKey: box.pk, boxKeyId: box.id, boxKeySig: box.sig })
      return { id: box.id, secretKey, publicKey, sig }
    })
    if (!seen.has(m.current!)) fail()

    let chain: Uint8Array | null = null
    let chainKeyId: number | null = null
    if (m.chain != null) {
      chain = b64DecodeLength(m.chain, 32)
      chainKeyId = m.chainKeyId ?? null
      const fromChain = boxKeys.find((b) => b.id === chainKeyId)
      if (!fromChain || !constantTimeEqual(boxKeyPairFromChain(chain).publicKey, fromChain.publicKey)) fail()
    }
    const rotatedAt = typeof m.rotatedAt === 'number' && Number.isFinite(m.rotatedAt) ? m.rotatedAt : null
    return { identity, chain, chainKeyId, current: m.current!, rotatedAt, boxKeys }
  } catch (error) {
    if (error instanceof E2eeError) throw new E2eeError('invalid_key')
    throw error
  }
}

export function encodeKeyMaterial(decoded: DecodedMaterial): KeyMaterial {
  return {
    v: 1,
    identity: { sk: b64Encode(decoded.identity.secretKey), pk: b64Encode(decoded.identity.publicKey) },
    chain: decoded.chain ? b64Encode(decoded.chain) : null,
    chainKeyId: decoded.chainKeyId,
    current: decoded.current,
    rotatedAt: decoded.rotatedAt,
    boxKeys: decoded.boxKeys.map((b) => ({
      id: b.id,
      sk: b64Encode(b.secretKey),
      pk: b64Encode(b.publicKey),
      sig: b64Encode(b.sig),
    })),
  }
}

export function wipeMaterial(decoded: DecodedMaterial): void {
  decoded.identity.secretKey.fill(0)
  decoded.chain?.fill(0)
  for (const box of decoded.boxKeys) box.secretKey.fill(0)
}
