import { apiRequest, ApiError } from '@/clients/api/http';
import { formatApiError } from '@/clients/api/errors';

jest.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  API_PREFIX: '/api/v1',
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('apiRequest', () => {
  it('devuelve JSON parseado en una respuesta exitosa', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 42, name: 'Track' }),
    });

    const data = await apiRequest<{ id: number; name: string }>('/tracks/42');
    expect(data).toEqual({ id: 42, name: 'Track' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/tracks/42',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('devuelve undefined en 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });
    const result = await apiRequest('/settings');
    expect(result).toBeUndefined();
  });

  it('lanza ApiError cuando la respuesta no es ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => JSON.stringify({ message: 'Track no encontrado' }),
    });

    await expect(apiRequest('/tracks/999')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Track no encontrado',
    });
  });

  it('ApiError incluye status cuando el cuerpo no tiene message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => '',
    });

    await expect(apiRequest('/fail')).rejects.toMatchObject({
      status: 500,
    });
  });

  it('envía Authorization header cuando se pasa token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{}',
    });

    await apiRequest('/profile', { token: 'jwt-abc' });
    const [, opts] = mockFetch.mock.calls[0];
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
  });

  it('serializa el body a JSON y añade Content-Type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{}',
    });

    await apiRequest('/swipes', { method: 'POST', body: { trackId: 't1', direction: 'Right' } });
    const [, opts] = mockFetch.mock.calls[0];
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(opts.body).toBe(JSON.stringify({ trackId: 't1', direction: 'Right' }));
  });

  it('construye query string correctamente', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '[]',
    });

    await apiRequest('/matches', { query: { page: 1, size: 10 } });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('size=10');
  });
});

describe('formatApiError', () => {
  it('devuelve el message de ApiError', () => {
    const err = new ApiError(401, 'No autorizado', null);
    expect(formatApiError(err, 'fallback')).toBe('No autorizado');
  });

  it('devuelve el message de Error genérico', () => {
    expect(formatApiError(new Error('algo falló'), 'fallback')).toBe('algo falló');
  });

  it('devuelve el fallback para valores desconocidos', () => {
    expect(formatApiError('string raro', 'fallback')).toBe('fallback');
    expect(formatApiError(null, 'fallback')).toBe('fallback');
  });
});
