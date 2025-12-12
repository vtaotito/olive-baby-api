// Olive Baby API - Custom Error Class

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: Record<string, string[]>;
  public readonly code?: string;
  public readonly data?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errors?: Record<string, string[]>,
    code?: string,
    data?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    this.code = code;
    this.data = data;

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

  static conflict(message: string, code?: string, data?: any): AppError {
    return new AppError(message, 409, true, undefined, code, data);
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
