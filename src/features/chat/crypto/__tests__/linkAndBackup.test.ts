import { x25519 } from '@noble/curves/ed25519.js'

import { seededRandom } from '../__fixtures__/seededRandom'
import { utf8, utf8Decode } from '../bytes'
import {
  decryptBackup,
  DEFAULT_SCRYPT,
  deriveBackupKey,
  encryptBackup,
  fromWireKdf,
  newBackupSalt,
  normalizePassphrase,
  toWireKdf,
} from '../backupCipher'
import { isE2eeError } from '../errors'
import { linkCode, linkQrPayload, parseLinkQr } from '../linkCode'
import { openFromPublicKey, sealToPublicKey } from '../sealedBox'

const LINK_ID = '0192f0a1-7b2c-7d3e-8f40-123456789abc'

function catchError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  return null
}

describe('sobre hacia una efímera (traspaso)', () => {
  const random = seededRandom('link')
  const recipientSecret = random(32)
  const recipientPublic = x25519.getPublicKey(recipientSecret)

  test('ida y vuelta, atado al id del buzón', () => {
    const sealed = sealToPublicKey(recipientPublic, utf8('material'), utf8(LINK_ID), random)
    expect(utf8Decode(openFromPublicKey(recipientSecret, recipientPublic, sealed, utf8(LINK_ID)))).toBe('material')
    const otherBox = catchError(() => openFromPublicKey(recipientSecret, recipientPublic, sealed, utf8('otro-buzon')))
    expect(isE2eeError(otherBox, 'aead_failed')).toBe(true)
  })

  test('otra llave o un bit cambiado no abren', () => {
    const sealed = sealToPublicKey(recipientPublic, utf8('material'), utf8(LINK_ID), random)
    const stranger = random(32)
    expect(
      isE2eeError(
        catchError(() => openFromPublicKey(stranger, x25519.getPublicKey(stranger), sealed, utf8(LINK_ID))),
        'aead_failed',
      ),
    ).toBe(true)
    const flipped = sealed.ciphertext.slice()
    flipped[0] ^= 1
    expect(
      isE2eeError(
        catchError(() =>
          openFromPublicKey(recipientSecret, recipientPublic, { ...sealed, ciphertext: flipped }, utf8(LINK_ID)),
        ),
        'aead_failed',
      ),
    ).toBe(true)
  })

  test('el código corto es igual en los dos lados y cambia si cambia cualquiera de las dos públicas', () => {
    const a = x25519.getPublicKey(random(32))
    const b = x25519.getPublicKey(random(32))
    expect(linkCode(a, b)).toMatch(/^\d{6}$/)
    expect(linkCode(a, b)).toBe(linkCode(a, b))
    expect(linkCode(a, b)).not.toBe(linkCode(b, a))
    expect(linkCode(a, x25519.getPublicKey(random(32)))).not.toBe(linkCode(a, b))
  })

  test('QR de vinculación: formato y rechazo de lo que no es', () => {
    const qr = linkQrPayload(LINK_ID, recipientPublic)
    expect(qr.startsWith(`encorely-link:v1:${LINK_ID}:`)).toBe(true)
    expect(parseLinkQr(qr)).toEqual({ linkId: LINK_ID, newDevicePublic: recipientPublic })
    expect(parseLinkQr('encorely:v1:AAAA')).toBeNull()
    expect(parseLinkQr(`encorely-link:v1:${LINK_ID}:AAAA`)).toBeNull()
    expect(parseLinkQr(`encorely-link:v1:no-es-uuid:${qr.split(':').at(-1)}`)).toBeNull()
  })
})

describe('cifrado del respaldo', () => {
  test('ida y vuelta; frase equivocada o parámetros alterados fallan', async () => {
    const random = seededRandom('backup')
    const salt = newBackupSalt(random)
    const kdf = toWireKdf()
    const key = await deriveBackupKey('tres perros comen arepa', salt, DEFAULT_SCRYPT)
    const sealed = encryptBackup(key, utf8('{"v":1}'), kdf, salt, random)
    expect(utf8Decode(decryptBackup(key, sealed))).toBe('{"v":1}')

    const wrong = await deriveBackupKey('tres perros comen arepas', salt, DEFAULT_SCRYPT)
    expect(isE2eeError(catchError(() => decryptBackup(wrong, sealed)), 'aead_failed')).toBe(true)

    // Los parámetros van en el AAD: cambiarlos en el servidor rompe el descifrado aunque la llave sea la misma.
    const tampered = { ...sealed, kdf: { ...kdf, opsLimit: kdf.opsLimit * 2, memLimit: kdf.memLimit * 2 } }
    expect(isE2eeError(catchError(() => decryptBackup(key, tampered)), 'aead_failed')).toBe(true)
  })

  test('misma frase con espacios o forma Unicode distinta da la misma llave', async () => {
    const salt = new Uint8Array(16).fill(1)
    const a = await deriveBackupKey('  canción   de  rock  ', salt, DEFAULT_SCRYPT)
    const b = await deriveBackupKey('canción de rock', salt, DEFAULT_SCRYPT)
    expect(a).toEqual(b)
    expect(normalizePassphrase(' a \n b ')).toBe('a b')
  })

  test('los parámetros del servidor se acotan (un N gigante no cuelga el teléfono)', () => {
    expect(fromWireKdf(toWireKdf())).toEqual(DEFAULT_SCRYPT)
    expect(() => fromWireKdf({ algorithm: 'argon2id', opsLimit: 3, memLimit: 65536 })).toThrow()
    expect(() => fromWireKdf({ algorithm: 'scrypt', opsLimit: 2 ** 22, memLimit: 128 * 8 * 2 ** 22 })).toThrow()
    expect(() => fromWireKdf({ algorithm: 'scrypt', opsLimit: 3 * 2 ** 14, memLimit: 128 * 8 * 3 * 2 ** 14 })).toThrow()
    expect(() => fromWireKdf({ algorithm: 'scrypt', opsLimit: 2 ** 15, memLimit: 100 })).toThrow()
  })
})
