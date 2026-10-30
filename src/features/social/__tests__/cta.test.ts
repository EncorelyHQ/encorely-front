import { profileCta } from '../cta'

describe('profileCta (draft.15)', () => {
  it('con match ofrece escribir aunque también haya like', () => {
    expect(profileCta({ matched: true, likedByMe: true, canLike: false }, false)).toBe('write')
  })

  it('con like y sin match dice que te interesa; sin nada, ofrece el like', () => {
    expect(profileCta({ matched: false, likedByMe: true, canLike: true }, false)).toBe('liked')
    expect(profileCta({ matched: false, likedByMe: false, canLike: true }, false)).toBe('like')
  })

  it('en el perfil propio no hay botón', () => {
    expect(profileCta({ matched: false, likedByMe: false, canLike: false }, true)).toBe('none')
  })

  it('sin concierto en común no ofrece un like que fallaría (draft.17)', () => {
    expect(profileCta({ matched: false, likedByMe: false, canLike: false }, false)).toBe('noSharedEvent')
  })
})
