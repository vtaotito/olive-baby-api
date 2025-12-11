// Olive Baby API - Custom Error Class

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errors?: Record<string, string[]>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errors?: Record<string, string[]>): AppError {
    return new AppError(message, 400, true, errors);
  }

  static unauthorized(message: string = 'Não autorizado'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message: string = 'Acesso negado'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message: string = 'Recurso não encontrado'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409);
  }

  static unprocessable(message: string, errors?: Record<string, string[]>): AppError {
    return new AppError(message, 422, true, errors);
  }

  static internal(message: string = 'Erro interno do servidor'): AppError {
    return new AppError(message, 500, false);
  }

  static tooManyRequests(message: string = 'Muitas requisições. Tente novamente mais tarde.'): AppError {
    return new AppError(message, 429);
  }
}
