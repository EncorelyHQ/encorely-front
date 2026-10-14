import {
  displayNameError,
  emailError,
  loginPasswordError,
  newPasswordError,
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  utf8ByteLength,
} from '../validation'

describe('email', () => {
  it('normaliza espacios y mayúsculas', () => {
    expect(normalizeEmail('  Ana.Gomez@Mail.COM ')).toBe('ana.gomez@mail.com')
  })

  it.each(['ana@mail.com', 'ana.gomez+conciertos@sub.mail.co', ' ANA@MAIL.CO '])('acepta %s', (value) => {
    expect(emailError(value)).toBeNull()
  })

  it.each(['', '   ', 'ana', 'ana@', '@mail.com', 'ana@mail', 'ana @mail.com', 'ana@mail..com', 'ana@@mail.com'])(
    'rechaza %p',
    (value) => {
      expect(emailError(value)).not.toBeNull()
    },
  )

  it('distingue vacío de forma inválida', () => {
    expect(emailError('')).toBe('Escribe tu correo.')
    expect(emailError('ana')).toMatch(/nombre@dominio/)
  })

  it('rechaza correos de más de 254 caracteres', () => {
    expect(emailError(`${'a'.repeat(250)}@mail.com`)).not.toBeNull()
  })
})

describe('contraseña nueva', () => {
  it('exige el mínimo del back', () => {
    expect(newPasswordError('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(/al menos 12/)
    expect(newPasswordError('a'.repeat(PASSWORD_MIN_LENGTH))).toBeNull()
  })

  it('pide escribirla si está vacía', () => {
    expect(newPasswordError('')).toBe('Escribe una contraseña.')
  })

  it('limita a 72 bytes UTF-8, no a 72 caracteres', () => {
    expect(newPasswordError('a'.repeat(72))).toBeNull()
    expect(newPasswordError('a'.repeat(73))).not.toBeNull()
    // 25 "ñ" = 50 bytes; 37 = 74 bytes aunque sean 37 caracteres.
    expect(newPasswordError('ñ'.repeat(25))).toBeNull()
    expect(newPasswordError('ñ'.repeat(37))).not.toBeNull()
  })

  it('cuenta bytes como el back', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('ñ')).toBe(2)
    expect(utf8ByteLength('€')).toBe(3)
    expect(utf8ByteLength('𝄞')).toBe(4)
  })
})

describe('contraseña de login', () => {
  it('solo exige que no esté vacía', () => {
    expect(loginPasswordError('')).not.toBeNull()
    expect(loginPasswordError('corta')).toBeNull()
  })
})

describe('nombre visible', () => {
  it('valida largo sin contar espacios de los bordes', () => {
    expect(displayNameError('  ')).not.toBeNull()
    expect(displayNameError(' A ')).not.toBeNull()
    expect(displayNameError('Al')).toBeNull()
    expect(displayNameError('a'.repeat(51))).not.toBeNull()
  })
})
