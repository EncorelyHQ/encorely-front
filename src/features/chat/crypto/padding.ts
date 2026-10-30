import { E2eeError } from './errors'

export const PAD_BLOCK = 256

/** ISO/IEC 7816-4: 0x80 then zeros, so the server only learns length in 256 B buckets. */
export function pad(data: Uint8Array, block: number = PAD_BLOCK): Uint8Array {
  const total = Math.ceil((data.length + 1) / block) * block
  const out = new Uint8Array(total)
  out.set(data)
  out[data.length] = 0x80
  return out
}

export function unpad(data: Uint8Array, block: number = PAD_BLOCK): Uint8Array {
  if (data.length === 0 || data.length % block !== 0) throw new E2eeError('bad_padding')
  let i = data.length - 1
  while (i >= 0 && data[i] === 0) i--
  if (i < 0 || data[i] !== 0x80) throw new E2eeError('bad_padding')
  // Padding longer than one block means the sender did not use this scheme.
  if (data.length - i > block) throw new E2eeError('bad_padding')
  return data.slice(0, i)
}
