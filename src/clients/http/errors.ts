export class ApiError extends Error {
  readonly statusCode: number;
  readonly body?: unknown;

  constructor(statusCode: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}
