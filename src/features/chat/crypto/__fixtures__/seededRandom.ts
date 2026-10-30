import { sha256 } from '@noble/hashes/sha2.js'

import { concat, u32be, utf8, type RandomBytes } from '../bytes'

/** Deterministic byte stream for tests: sha256(seed ‖ counter) blocks. */
export function seededRandom(seed: string): RandomBytes {
  let counter = 0
  return (length: number) => {
    const out = new Uint8Array(length)
    let filled = 0
    while (filled < length) {
      const block = sha256(concat(utf8(seed), u32be(counter++)))
      const take = Math.min(block.length, length - filled)
      out.set(block.subarray(0, take), filled)
      filled += take
    }
    return out
  }
}
