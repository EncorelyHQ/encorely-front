import { ApiError } from '@/lib/api/errors'
import type { BackupBlob, BackupInfo, LinkRequest } from '@/lib/api/endpoints'
import type { BackupTransport } from '../backup/backup'
import { b64Decode } from '../crypto/bytes'
import type { LinkTransport } from '../link/linkDevice'

const http = (status: number, code: string) => new ApiError('http', code, { status, code })

// Respaldo y buzones de vinculación con las reglas del back (SyncService): un respaldo por usuario que se
// reemplaza, buzón por usuario de un solo uso que vence a los 10 minutos.
export function createFakeSyncServer() {
  const backups = new Map<string, BackupBlob>()
  const links = new Map<string, LinkRequest & { userId: string }>()
  let clock = Date.UTC(2026, 9, 14, 15, 0, 0)

  const info = (blob: BackupBlob): BackupInfo => ({
    version: blob.version,
    sizeBytes: b64Decode(blob.ciphertext).length,
    updatedAt: blob.updatedAt,
  })

  function backupFor(userId: string): BackupTransport {
    return {
      async info() {
        const blob = backups.get(userId)
        if (!blob) throw http(404, 'backup_missing')
        return info(blob)
      },
      async get() {
        const blob = backups.get(userId)
        if (!blob) throw http(404, 'backup_missing')
        return blob
      },
      async put(body) {
        if (b64Decode(body.ciphertext).length > 10 * 1024 * 1024) throw http(413, 'payload_too_large')
        const blob: BackupBlob = { ...body, updatedAt: new Date(clock).toISOString() }
        backups.set(userId, blob)
        return info(blob)
      },
      async remove() {
        backups.delete(userId)
      },
    }
  }

  function open(userId: string, linkId: string) {
    const link = links.get(linkId)
    if (!link || link.userId !== userId || Date.parse(link.expiresAt) <= clock) throw http(404, 'link_not_found')
    return link
  }

  function linkFor(userId: string): LinkTransport {
    return {
      async create(ephemeralKey) {
        const id = globalThis.crypto.randomUUID()
        const link = {
          id,
          userId,
          status: 'pending' as const,
          newDeviceEphemeralKey: ephemeralKey,
          senderEphemeralKey: null,
          nonce: null,
          ciphertext: null,
          expiresAt: new Date(clock + 10 * 60 * 1000).toISOString(),
        }
        links.set(id, link)
        return link
      },
      async get(linkId) {
        const { userId: _owner, ...dto } = open(userId, linkId)
        return dto
      },
      async fulfill(linkId, body) {
        const link = open(userId, linkId)
        if (link.status !== 'pending') throw http(409, 'link_already_fulfilled')
        links.set(linkId, { ...link, status: 'ready', ...body })
      },
      async remove(linkId) {
        const link = links.get(linkId)
        if (link?.userId === userId) links.delete(linkId)
      },
    }
  }

  return {
    backupFor,
    linkFor,
    backups,
    links,
    advance: (ms: number) => {
      clock += ms
    },
    /** Lo que haría un servidor malicioso: cambiar campos del buzón. */
    tamperLink(linkId: string, patch: Partial<LinkRequest>) {
      const link = links.get(linkId)!
      links.set(linkId, { ...link, ...patch })
    },
  }
}
