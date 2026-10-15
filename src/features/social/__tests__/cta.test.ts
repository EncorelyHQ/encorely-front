import { profileCta } from '../cta'

describe('profileCta (draft.15)', () => {
  it('con match ofrece escribir aunque también haya like', () => {
    expect(profileCta({ matched: true, likedByMe: true }, false)).toBe('write')
  })

  it('con like y sin match dice que te interesa; sin nada, ofrece el like', () => {
    expect(profileCta({ matched: false, likedByMe: true }, false)).toBe('liked')
    expect(profileCta({ matched: false, likedByMe: false }, false)).toBe('like')
  })

  it('en el perfil propio no hay botón', () => {
    expect(profileCta({ matched: false, likedByMe: false }, true)).toBe('none')
  })
})
