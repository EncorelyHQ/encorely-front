import { ApiError } from '@/lib/api/errors'
import type { KeyBundle, MatchSummary, OutgoingMessage, PeerKeyBundle, StoredMessage } from '@/lib/api/types'
import { seededRandom } from '../crypto/__fixtures__/seededRandom'
import type { ChatDeps, ChatTransport } from '../data/deps'
import { createDeviceKeys } from '../keys/deviceKeys'
import { createPeerKeyStore } from '../keys/peerKeys'
import { createMemoryKeyValueStore, createMemorySecretStore } from '../keys/storage'

type Match = { id: string; users: [string, string]; status: 'active' | 'closed'; eventName: string | null }

const http = (status: number, code: string) => new ApiError('http', code, { status, code })

// Servidor en memoria con las reglas del contrato v1 que importan al chat: boxKeyId creciente, 409 por llave
// vieja del destinatario, idempotencia por id y paginación before (desc) / after (asc) con nextCursor.
export function createFakeChatServer() {
  const names = new Map<string, string>()
  const keys = new Map<string, PeerKeyBundle>()
  const history = new Map<string, Map<number, PeerKeyBundle>>()
  const matches = new Map<string, Match>()
  const messages = new Map<string, StoredMessage[]>()
  const sendLog: { matchId: string; id: string; recipientBoxKeyId: number; ok: boolean }[] = []
  const pageLog: { matchId: string; before?: number; after?: number; limit: number }[] = []
  const ackLog: { matchId: string; userId: string; upToSeq: number }[] = []
  const sendFailures: ApiError[] = []
  let seq = 0
  let clock = Date.UTC(2026, 9, 14, 15, 0, 0)

  const tick = () => {
    clock += 1000
    return new Date(clock).toISOString()
  }

  function peerOf(matchId: string, me: string): string {
    const match = matches.get(matchId)
    if (!match || !match.users.includes(me)) throw http(404, 'match_not_found')
    if (match.status === 'closed') throw http(404, 'match_closed')
    return match.users[0] === me ? match.users[1] : match.users[0]
  }

  function store(matchId: string, senderId: string, msg: OutgoingMessage): StoredMessage {
    const list = messages.get(matchId) ?? []
    const stored: StoredMessage = {
      id: msg.id,
      seq: ++seq,
      senderId,
      version: msg.version,
      senderBoxKeyId: msg.senderBoxKeyId,
      recipientBoxKeyId: msg.recipientBoxKeyId,
      nonce: msg.nonce,
      ciphertext: msg.ciphertext,
      frankingTag: msg.frankingTag ?? null,
      createdAt: tick(),
    }
    list.push(stored)
    messages.set(matchId, list)
    return stored
  }

  function summary(matchId: string, me: string): MatchSummary {
    const match = matches.get(matchId)!
    const peer = match.users[0] === me ? match.users[1] : match.users[0]
    const list = messages.get(matchId) ?? []
    return {
      id: matchId,
      status: match.status,
      peer: { id: peer, displayName: names.get(peer) ?? '', age: null, city: null },
      eventName: match.eventName,
      sharedGenres: ['rock'],
      createdAt: new Date(Date.UTC(2026, 9, 1)).toISOString(),
      lastMessageAt: list.at(-1)?.createdAt ?? null,
      lastSeq: list.at(-1)?.seq ?? 0,
    } as MatchSummary
  }

  function transportFor(me: string): ChatTransport {
    return {
      async matches() {
        return [...matches.values()].filter((m) => m.users.includes(me)).map((m) => summary(m.id, me))
      },
      // Como el back: borra lo que el OTRO me envió hasta upToSeq; lo mío se queda hasta que el otro lo confirme.
      async ack(matchId, upToSeq) {
        peerOf(matchId, me)
        ackLog.push({ matchId, userId: me, upToSeq })
        messages.set(
          matchId,
          (messages.get(matchId) ?? []).filter((m) => m.senderId === me || m.seq > upToSeq),
        )
      },
      async match(matchId) {
        peerOf(matchId, me)
        return summary(matchId, me)
      },
      async myKeys() {
        const bundle = keys.get(me)
        if (!bundle) throw http(404, 'keys_missing')
        return bundle
      },
      async publishKeys(bundle: KeyBundle) {
        const current = keys.get(me)
        if (current && bundle.boxKeyId <= current.boxKeyId) throw http(409, 'stale_box_key_id')
        const full: PeerKeyBundle = { ...bundle, userId: me, updatedAt: tick() }
        keys.set(me, full)
        const h = history.get(me) ?? new Map()
        h.set(bundle.boxKeyId, full)
        history.set(me, h)
        return full
      },
      async peerKeys(matchId) {
        const peer = peerOf(matchId, me)
        const bundle = keys.get(peer)
        if (!bundle) throw http(404, 'peer_keys_missing')
        return bundle
      },
      async peerBox(matchId, boxKeyId) {
        const peer = peerOf(matchId, me)
        const bundle = history.get(peer)?.get(boxKeyId)
        if (!bundle) throw http(404, 'not_found')
        return { ...bundle, createdAt: bundle.updatedAt }
      },
      async page(matchId, cursor, limit) {
        peerOf(matchId, me)
        pageLog.push({ matchId, ...cursor, limit })
        const all = messages.get(matchId) ?? []
        if (cursor.after !== undefined) {
          const newer = all.filter((m) => m.seq > cursor.after!)
          const items = newer.slice(0, limit)
          return { items, nextCursor: newer.length > limit ? items.at(-1)!.seq : null }
        }
        const before = cursor.before ?? Number.MAX_SAFE_INTEGER
        const older = all.filter((m) => m.seq < before).reverse()
        const items = older.slice(0, limit)
        return { items, nextCursor: older.length > limit ? items.at(-1)!.seq : null }
      },
      async send(matchId, msg) {
        const peer = peerOf(matchId, me)
        const injected = sendFailures.shift()
        if (injected) {
          sendLog.push({ matchId, id: msg.id, recipientBoxKeyId: msg.recipientBoxKeyId, ok: false })
          throw injected
        }
        const existing = (messages.get(matchId) ?? []).find((m) => m.id === msg.id)
        if (existing) {
          if (existing.ciphertext !== msg.ciphertext) throw http(409, 'message_id_conflict')
          return { id: existing.id, seq: existing.seq, createdAt: existing.createdAt }
        }
        const peerKey = keys.get(peer)
        if (!peerKey || msg.recipientBoxKeyId !== peerKey.boxKeyId) {
          sendLog.push({ matchId, id: msg.id, recipientBoxKeyId: msg.recipientBoxKeyId, ok: false })
          throw http(409, 'stale_recipient_key')
        }
        sendLog.push({ matchId, id: msg.id, recipientBoxKeyId: msg.recipientBoxKeyId, ok: true })
        const stored = store(matchId, me, msg)
        return { id: stored.id, seq: stored.seq, createdAt: stored.createdAt }
      },
    }
  }

  return {
    addUser(id: string, name: string) {
      names.set(id, name)
    },
    addMatch(id: string, a: string, b: string, eventName: string | null = 'Bomba Estéreo') {
      matches.set(id, { id, users: [a, b], status: 'active', eventName })
    },
    closeMatch(id: string) {
      matches.get(id)!.status = 'closed'
    },
    // Mensaje que nadie puede abrir (sobre manipulado en tránsito o por el servidor).
    injectCorrupt(matchId: string, senderId: string, template: OutgoingMessage) {
      const flipped = template.ciphertext.startsWith('A') ? `B${template.ciphertext.slice(1)}` : `A${template.ciphertext.slice(1)}`
      return store(matchId, senderId, { ...template, id: globalThis.crypto.randomUUID(), ciphertext: flipped })
    },
    failNextSend(error: ApiError) {
      sendFailures.push(error)
    },
    messagesOf: (matchId: string) => messages.get(matchId) ?? [],
    keysOf: (userId: string) => keys.get(userId),
    sendLog,
    pageLog,
    ackLog,
    transportFor,
  }
}

export type FakeChatServer = ReturnType<typeof createFakeChatServer>

export function createTestDeps(
  server: FakeChatServer,
  userId: string,
  seed: string,
  extra: Partial<Pick<ChatDeps, 'local' | 'deviceKeys' | 'peerKeys'>> = {},
): ChatDeps {
  return {
    transport: server.transportFor(userId),
    deviceKeys: createDeviceKeys({
      secure: createMemorySecretStore(),
      kv: createMemoryKeyValueStore(),
      randomBytes: seededRandom(seed),
    }),
    peerKeys: createPeerKeyStore(createMemoryKeyValueStore()),
    newId: () => globalThis.crypto.randomUUID(),
    now: () => Date.now(),
    ...extra,
  }
}
