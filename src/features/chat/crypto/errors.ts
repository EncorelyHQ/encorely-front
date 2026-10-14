export type E2eeErrorCode =
  | 'aead_failed'
  | 'bad_padding'
  | 'malformed'
  | 'binding_mismatch'
  | 'franking_mismatch'
  | 'unsupported_version'
  | 'invalid_key'
  | 'invalid_signature'
  | 'identity_mismatch'
  | 'missing_keys'
  | 'invalid_input'

const MESSAGES: Record<E2eeErrorCode, string> = {
  aead_failed: 'Message authentication failed',
  bad_padding: 'Invalid message padding',
  malformed: 'Malformed encrypted payload',
  binding_mismatch: 'Message metadata does not match its envelope',
  franking_mismatch: 'Franking tag does not verify',
  unsupported_version: 'Unsupported message version',
  invalid_key: 'Invalid key material',
  invalid_signature: 'Invalid key signature',
  identity_mismatch: 'Identity key does not match',
  missing_keys: 'Device keys are missing',
  invalid_input: 'Invalid input',
}

// Messages are fixed per code on purpose: errors end up in logs and crash reports,
// so they must never carry plaintext, keys or ids.
export class E2eeError extends Error {
  readonly code: E2eeErrorCode

  constructor(code: E2eeErrorCode) {
    super(MESSAGES[code])
    this.name = 'E2eeError'
    this.code = code
  }
}

export function isE2eeError(error: unknown, code?: E2eeErrorCode): error is E2eeError {
  return error instanceof E2eeError && (code === undefined || error.code === code)
}
