// Generador QR mínimo para el código de seguridad: modo byte, corrección M, versiones 1–10.
// Sigue ISO/IEC 18004 (misma estructura que el generador de referencia de Nayuki). No hay librería
// de QR en el proyecto y el payload es corto (~100 B), así que no hace falta más que esto.

export type QrCode = {
  version: number
  size: number
  mask: number
  /** modules[y][x]: true = módulo oscuro. */
  modules: boolean[][]
}

export class QrCapacityError extends Error {
  constructor() {
    super('Payload too long for QR version 10-M')
    this.name = 'QrCapacityError'
  }
}

const MIN_VERSION = 1
const MAX_VERSION = 10
// Índice = versión. Solo nivel M.
const ECC_CODEWORDS_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_ERROR_CORRECTION_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const ALIGNMENT_POSITIONS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]
// Bits de nivel de corrección en la información de formato: M = 00.
const ECL_M_FORMAT_BITS = 0
const BYTE_MODE = 0b0100

export function utf8Bytes(text: string): number[] {
  const out: number[] = []
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
        i++
      }
    }
    if (code < 0x80) out.push(code)
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63))
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
    else
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
  }
  return out
}

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0
}

function numRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (version >= 7) result -= 36
  }
  return result
}

export function numDataCodewords(version: number): number {
  return (
    Math.floor(numRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[version] * NUM_ERROR_CORRECTION_BLOCKS[version]
  )
}

function charCountBits(version: number): number {
  return version <= 9 ? 8 : 16
}

// --- Reed-Solomon sobre GF(2^8) con polinomio 0x11D ---

export function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

export function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

export function reedSolomonRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor)
    })
  }
  return result
}

function addEccAndInterleave(data: number[], version: number): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[version]
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[version]
  const rawCodewords = Math.floor(numRawDataModules(version) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)

  const divisor = reedSolomonDivisor(blockEccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1))
    k += dat.length
    const ecc = reedSolomonRemainder(dat, divisor)
    if (i < numShortBlocks) dat.push(0)
    blocks.push(dat.concat(ecc))
  }

  const result: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      // Los bloques cortos tienen un hueco de relleno que no se transmite.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i])
    })
  }
  return result
}

export function chooseVersion(byteLength: number): number {
  for (let v = MIN_VERSION; v <= MAX_VERSION; v++) {
    const needed = 4 + charCountBits(v) + byteLength * 8
    if (byteLength < 2 ** charCountBits(v) && needed <= numDataCodewords(v) * 8) return v
  }
  throw new QrCapacityError()
}

export function dataCodewords(bytes: readonly number[], version: number): number[] {
  const bits: number[] = []
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  append(BYTE_MODE, 4)
  append(bytes.length, charCountBits(version))
  for (const b of bytes) append(b, 8)

  const capacityBits = numDataCodewords(version) * 8
  append(0, Math.min(4, capacityBits - bits.length))
  append(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) append(pad, 8)

  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]
    out.push(byte)
  }
  return out
}

// --- Matriz ---

class Grid {
  readonly size: number
  readonly modules: boolean[][]
  readonly isFunction: boolean[][]
  readonly version: number

  constructor(version: number) {
    this.version = version
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
  }

  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark
    this.isFunction[y][x] = true
  }

  drawFunctionPatterns() {
    const { size } = this
    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0)
      this.setFunction(i, 6, i % 2 === 0)
    }
    this.drawFinder(3, 3)
    this.drawFinder(size - 4, 3)
    this.drawFinder(3, size - 4)

    const positions = ALIGNMENT_POSITIONS[this.version]
    const last = positions.length - 1
    positions.forEach((px, i) => {
      positions.forEach((py, j) => {
        const overlapsFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)
        if (!overlapsFinder) this.drawAlignment(px, py)
      })
    })

    // Reserva las zonas de formato con un valor provisional; se escriben de verdad tras elegir máscara.
    this.drawFormatBits(0)
    this.drawVersion()
  }

  private drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.setFunction(xx, yy, dist !== 2 && dist !== 4)
      }
    }
  }

  private drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }

  drawFormatBits(mask: number) {
    const bits = formatBits(mask)
    const { size } = this
    for (let i = 0; i <= 5; i++) this.setFunction(8, i, getBit(bits, i))
    this.setFunction(8, 7, getBit(bits, 6))
    this.setFunction(8, 8, getBit(bits, 7))
    this.setFunction(7, 8, getBit(bits, 8))
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, getBit(bits, i))

    for (let i = 0; i < 8; i++) this.setFunction(size - 1 - i, 8, getBit(bits, i))
    for (let i = 8; i < 15; i++) this.setFunction(8, size - 15 + i, getBit(bits, i))
    this.setFunction(8, size - 8, true)
  }

  private drawVersion() {
    if (this.version < 7) return
    const bits = versionBits(this.version)
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i)
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.setFunction(a, b, bit)
      this.setFunction(b, a, bit)
    }
  }

  drawCodewords(data: readonly number[]) {
    const { size } = this
    let i = 0
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? size - 1 - vert : vert
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7))
            i++
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.isFunction[y][x] && maskBit(mask, x, y)) this.modules[y][x] = !this.modules[y][x]
      }
    }
  }
}

export function formatBits(mask: number): number {
  const data = (ECL_M_FORMAT_BITS << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

export function versionBits(version: number): number {
  let rem = version
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  return (version << 12) | rem
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  }
}

const FINDER_LIKE = [true, false, true, true, true, false, true]

// Penalización ISO 18004 §7.8.3: elige la máscara que más le facilita la lectura al escáner.
export function penaltyScore(modules: readonly boolean[][]): number {
  const size = modules.length
  let score = 0
  const at = (x: number, y: number, horizontal: boolean) => (horizontal ? modules[y][x] : modules[x][y])

  for (const horizontal of [true, false]) {
    for (let line = 0; line < size; line++) {
      let runColor = at(0, line, horizontal)
      let runLength = 1
      for (let pos = 1; pos < size; pos++) {
        const color = at(pos, line, horizontal)
        if (color === runColor) {
          runLength++
          if (runLength === 5) score += 3
          else if (runLength > 5) score += 1
        } else {
          runColor = color
          runLength = 1
        }
      }
      // Patrón tipo buscador (1:1:3:1:1) con 4 claros a un lado; el borde cuenta como claro.
      const lightAt = (pos: number) => pos < 0 || pos >= size || !at(pos, line, horizontal)
      for (let pos = 0; pos + 7 <= size; pos++) {
        if (!FINDER_LIKE.every((dark, k) => at(pos + k, line, horizontal) === dark)) continue
        const before = [1, 2, 3, 4].every((k) => lightAt(pos - k))
        const after = [0, 1, 2, 3].every((k) => lightAt(pos + 7 + k))
        if (before) score += 40
        if (after) score += 40
      }
    }
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x]
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3
    }
  }

  let dark = 0
  for (const row of modules) for (const m of row) if (m) dark++
  const total = size * size
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
  score += Math.max(0, k) * 10
  return score
}

export function encodeQr(text: string, forcedMask?: number): QrCode {
  const bytes = utf8Bytes(text)
  const version = chooseVersion(bytes.length)
  const codewords = addEccAndInterleave(dataCodewords(bytes, version), version)

  const base = new Grid(version)
  base.drawFunctionPatterns()
  base.drawCodewords(codewords)

  let best: { grid: Grid; mask: number; score: number } | null = null
  const masks = forcedMask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [forcedMask]
  for (const mask of masks) {
    const grid = new Grid(version)
    grid.modules.forEach((row, y) => row.forEach((_, x) => (row[x] = base.modules[y][x])))
    grid.isFunction.forEach((row, y) => row.forEach((_, x) => (row[x] = base.isFunction[y][x])))
    grid.applyMask(mask)
    grid.drawFormatBits(mask)
    const score = penaltyScore(grid.modules)
    if (!best || score < best.score) best = { grid, mask, score }
  }
  const chosen = best as { grid: Grid; mask: number }
  return { version, size: chosen.grid.size, mask: chosen.mask, modules: chosen.grid.modules }
}
