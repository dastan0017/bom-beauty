import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ErrorCode, ErrorResponse } from '@bom/shared';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ApiException } from './errors';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'validation_failed',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'too_large',
  [HttpStatus.TOO_MANY_REQUESTS]: 'rate_limited',
};

const MESSAGES: Record<ErrorCode, string> = {
  validation_failed: 'Проверьте поля формы',
  unauthenticated: 'Нужно войти',
  forbidden: 'Нет доступа',
  csrf_failed: 'Сессия устарела, обновите страницу',
  origin_mismatch: 'Запрос с чужого сайта',
  not_found: 'Не найдено',
  conflict: 'Конфликт данных',
  too_large: 'Файл слишком большой',
  rate_limited: 'Слишком много запросов, попробуйте позже',
  internal: 'Что-то пошло не так',
  payment_unavailable: 'Онлайн-оплата сейчас недоступна',
  payment_failed: 'Не получилось открыть оплату, попробуйте ещё раз',
};

/** Every error leaves the API as `{ error: { code, message, fields? } }`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toBody(exception);
    if (status >= 500) this.logger.error(exception);
    response.status(status).json(body);
  }

  private toBody(exception: unknown): { status: number; body: ErrorResponse } {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      const issues = zodError instanceof ZodError ? zodError.issues : [];
      const fields: Record<string, string> = {};
      for (const issue of issues) {
        const path = issue.path.map(String).join('.') || '_';
        fields[path] ??= issue.message;
      }
      return this.make(HttpStatus.BAD_REQUEST, 'validation_failed', MESSAGES.validation_failed, fields);
    }
    if (exception instanceof ApiException) {
      return this.make(exception.getStatus(), exception.code, exception.message, exception.fields);
    }
    if (exception instanceof ThrottlerException) {
      return this.make(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited', MESSAGES.rate_limited);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_CODES[status] ?? (status >= 500 ? 'internal' : 'validation_failed');
      return this.make(status, code, MESSAGES[code]);
    }
    return this.make(HttpStatus.INTERNAL_SERVER_ERROR, 'internal', MESSAGES.internal);
  }

  private make(
    status: number,
    code: ErrorCode,
    message: string,
    fields?: Record<string, string>,
  ): { status: number; body: ErrorResponse } {
    return { status, body: { error: { code, message, ...(fields ? { fields } : {}) } } };
  }
}
