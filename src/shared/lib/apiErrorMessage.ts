import { ApiError } from '@/clients/http/errors';

export function getApiErrorMessage(error: unknown, fallback = 'Algo salió mal'): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) {
      return error.message || 'No tenés permiso para esta acción.';
    }
    if (error.statusCode === 400) {
      return error.message || 'Solicitud inválida.';
    }
    if (error.statusCode === 404) {
      return error.message || 'No encontrado.';
    }
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
