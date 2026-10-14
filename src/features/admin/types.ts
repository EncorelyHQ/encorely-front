// Alias del contrato para el panel. Salen de los tipos generados: no escribir tipos de API a mano.
import type { components } from '@/lib/api/schema'

type S = components['schemas']

export type AdminEvent = S['AdminEventDto']
export type AdminEventRequest = S['AdminEventRequest']
export type AdminSong = S['AdminSongDto']
export type AdminSongRequest = S['AdminSongRequest']
export type ITunesTrack = S['ITunesTrackDto']
export type AdminReport = S['AdminReportDto']
export type AdminEvidence = S['AdminEvidenceDto']
export type AdminUserRef = S['AdminUserRef']
export type ReportStatus = S['ReportStatus']
export type ReportAction = S['ReportAction']
export type ReportReason = S['ReportReason']
export type UserStatus = S['UserStatus']
