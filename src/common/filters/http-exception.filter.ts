import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface HttpExceptionBody {
  message?: string | string[];
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const message = this.getMessage(exceptionResponse, exception);

    response.status(statusCode).json({
      code: statusCode,
      message,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private getMessage(
    exceptionResponse: string | object,
    exception: HttpException,
  ): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const body = exceptionResponse as HttpExceptionBody;
    return body.message ?? exception.message;
  }
}
