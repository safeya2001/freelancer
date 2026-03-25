import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error', message_ar: 'حدث خطأ في الخادم' };

    if (status >= 500) {
      this.logger.error(exception);
    }

    const msgText =
      typeof message === 'object' && (message as any).message
        ? (message as any).message
        : message;

    const msgTextAr =
      typeof message === 'object' && (message as any).message_ar
        ? (message as any).message_ar
        : (status >= 500 ? 'حدث خطأ في الخادم' : undefined);

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: msgText,
      ...(msgTextAr && { message_ar: msgTextAr }),
    });
  }
}
