import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@bom/shared';

/** HttpException with an explicit API error code (docs/API.md §1). */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message, status);
  }
}

export const notFound = (message = 'Не найдено'): ApiException =>
  new ApiException('not_found', HttpStatus.NOT_FOUND, message);

export const invalidField = (field: string, code: string): ApiException =>
  new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Проверьте поля формы', { [field]: code });
