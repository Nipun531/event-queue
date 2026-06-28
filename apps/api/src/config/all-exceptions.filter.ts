
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    console.error(exception);

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
  statusCode: httpStatus,
  message: 'An unexpected error occurred.',
  timestamp: new Date().toISOString(),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  path: httpAdapter.getRequestUrl(ctx.getRequest<Request>()),
};

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
