import { installCryptoPolyfill } from '@/features/chat/crypto/random'

// Debe correr antes de cualquier import de @noble: sin getRandomValues no hay llaves ni nonces.
installCryptoPolyfill()
