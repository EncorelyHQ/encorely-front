import {
  chooseVersion,
  dataCodewords,
  encodeQr,
  formatBits,
  numDataCodewords,
  QrCapacityError,
  reedSolomonDivisor,
  reedSolomonRemainder,
  utf8Bytes,
  versionBits,
} from '../encoder'

const toRows = (modules: boolean[][]) => modules.map((row) => row.map((m) => (m ? '#' : '.')).join(''))

// Matrices verificadas al generarlas decodificándolas con ZXing (zxing-wasm 3.1.3, tryHarder, nivel M).
const HELLO_WORLD_V1 = [
  '#######.##..#.#######',
  '#.....#....#..#.....#',
  '#.###.#..#.#..#.###.#',
  '#.###.#.#..#..#.###.#',
  '#.###.#.###.#.#.###.#',
  '#.....#.#..#..#.....#',
  '#######.#.#.#.#######',
  '........#..##........',
  '#...#.######.#####..#',
  '...#....#.###....####',
  '..######..##.##.#..#.',
  '#####...##...#.......',
  '#####.#.#.#.#.##..##.',
  '........#.#.####.#.##',
  '#######.###.#.#.##.#.',
  '#.....#..#.###.##..##',
  '#.###.#.##.#.##...##.',
  '#.###.#..#..#...##.##',
  '#.###.#..###...###...',
  '#.....#....#.#.......',
  '#######.#########.#.#',
]

const URL_V2 = [
  '#######.#####...#.#######',
  '#.....#.#.#...#...#.....#',
  '#.###.#..#..####..#.###.#',
  '#.###.#.#.#####...#.###.#',
  '#.###.#..##.#..#..#.###.#',
  '#.....#...####....#.....#',
  '#######.#.#.#.#.#.#######',
  '........###...#..........',
  '#.##.###...#..##..#..#.##',
  '.####..#.##.#.#.#..#...#.',
  '##..#####.#.#.#...###....',
  '###.....#..#.#....#..##..',
  '#.....#..###.....##.#.###',
  '.###.#.#.#.#.########...#',
  '.###..#..##.#.#.....#.##.',
  '#..###.#.#..##.###.##...#',
  '.....##.####....#########',
  '........#...##..#...#.#.#',
  '#######.#.###...#.#.#.###',
  '#.....#.#.#.#..##...#..#.',
  '#.###.#...####..######.#.',
  '#.###.#.##..#######.#####',
  '#.###.#.#.####...##.#.##.',
  '#.....#..##....#.##.#.#..',
  '#######.#...#.#..#.######',
]

describe('Reed-Solomon', () => {
  test('matches the published 1-M example (Thonky "HELLO WORLD")', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]
    expect(reedSolomonRemainder(data, reedSolomonDivisor(10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23])
  })
})

describe('format and version information', () => {
  test('level M with mask 0..7 matches ISO 18004 table C.1', () => {
    const expected = [
      '101010000010010',
      '101000100100101',
      '101111001111100',
      '101101101001011',
      '100010111111001',
      '100000011001110',
      '100111110010111',
      '100101010100000',
    ]
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((m) => formatBits(m).toString(2).padStart(15, '0'))).toEqual(expected)
  })

  test('version bits for 7..10 match ISO 18004 table D.1', () => {
    expect([7, 8, 9, 10].map(versionBits)).toEqual([0x07c94, 0x085bc, 0x09a99, 0x0a4d3])
  })
})

describe('capacity', () => {
  test('data codewords per version at level M', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(numDataCodewords)).toEqual([16, 28, 44, 64, 86, 108, 124, 154, 182, 216])
  })

  test('picks the smallest version that fits (byte mode)', () => {
    expect(chooseVersion(14)).toBe(1)
    expect(chooseVersion(15)).toBe(2)
    expect(chooseVersion(98)).toBe(6)
    expect(chooseVersion(213)).toBe(10)
    expect(() => chooseVersion(214)).toThrow(QrCapacityError)
  })

  test('the safety QR payload (98 chars) fits in version 6', () => {
    const payload = `encorely:v1:${'A'.repeat(86)}`
    const qr = encodeQr(payload)
    expect(qr.version).toBe(6)
    expect(qr.size).toBe(41)
  })
})

describe('encodeQr', () => {
  test('byte-mode data codewords with terminator and 0xEC/0x11 padding', () => {
    expect(dataCodewords(utf8Bytes('HELLO WORLD'), 1)).toEqual([
      64, 180, 132, 84, 196, 196, 242, 5, 116, 245, 36, 196, 64, 236, 17, 236,
    ])
  })

  test('"HELLO WORLD" → known 1-M matrix (mask 4)', () => {
    const qr = encodeQr('HELLO WORLD')
    expect(qr.mask).toBe(4)
    expect(toRows(qr.modules)).toEqual(HELLO_WORLD_V1)
  })

  test('"https://encorely.app" → known 2-M matrix (mask 3)', () => {
    const qr = encodeQr('https://encorely.app')
    expect(qr.version).toBe(2)
    expect(qr.mask).toBe(3)
    expect(toRows(qr.modules)).toEqual(URL_V2)
  })

  test('draws finder patterns, timing and the dark module', () => {
    const { modules, size } = encodeQr(`encorely:v1:${'B'.repeat(86)}`)
    const finder = ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######']
    const block = (x: number, y: number) =>
      modules.slice(y, y + 7).map((row) => row.slice(x, x + 7).map((m) => (m ? '#' : '.')).join(''))
    expect(block(0, 0)).toEqual(finder)
    expect(block(size - 7, 0)).toEqual(finder)
    expect(block(0, size - 7)).toEqual(finder)
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6][i]).toBe(i % 2 === 0)
      expect(modules[i][6]).toBe(i % 2 === 0)
    }
    expect(modules[size - 8][8]).toBe(true)
  })

  test('encodes UTF-8 (multi-byte and surrogate pairs)', () => {
    expect(utf8Bytes('ñ')).toEqual([0xc3, 0xb1])
    expect(utf8Bytes('€')).toEqual([0xe2, 0x82, 0xac])
    expect(utf8Bytes('\u{1F3B5}')).toEqual([0xf0, 0x9f, 0x8e, 0xb5])
  })
})
