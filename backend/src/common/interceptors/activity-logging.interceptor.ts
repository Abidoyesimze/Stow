import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface UserRequest {
  user?: { id: string };
  method: string;
  url: string;
  body: Record<string, any>;
  ip: string;
}

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<UserRequest>();
    const { user, method, url, body, ip } = request;

    return next.handle().pipe(
      tap(() => {
        if (user && ['POST', 'PATCH', 'DELETE'].includes(method)) {
          const actionType = this.getActionType(method, url);
          if (actionType) {
            // TODO(issue): persist activity to an audit store for savings actions.
            this.logger.log({
              msg: 'user_activity',
              userId: user.id,
              actionType,
              body: this.sanitizeBody(body),
              ip,
            });
          }
        }
      }),
    );
  }

  private getActionType(method: string, url: string): string | null {
    if (url.includes('/savings') && method === 'POST') return 'SAVINGS_DEPOSIT';
    if (url.includes('/goals') && method === 'POST') return 'GOAL_CREATED';
    if (url.includes('/groups') && method === 'POST') return 'GROUP_CREATED';
    if (url.includes('/admin/users') && url.includes('/ban'))
      return 'USER_BANNED';
    if (url.includes('/admin/users') && url.includes('/unban'))
      return 'USER_UNBANNED';
    return null;
  }

  private sanitizeBody(
    body: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (!body) return null;
    const sanitized = { ...body };
    delete sanitized.password; // never log sensitive data
    return sanitized;
  }
}
