/**
 * Logging utility for Vinylogix
 * Provides structured logging with different levels
 * Integrates with Sentry for error tracking in production
 */

import * as Sentry from "@sentry/nextjs";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isServer = typeof window === 'undefined';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const env = this.isServer ? '[Server]' : '[Client]';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${env} [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message, context));
    }
    // Add breadcrumb for info level in production
    if (!this.isDevelopment) {
      Sentry.addBreadcrumb({
        category: 'info',
        message,
        data: context,
        level: 'info',
      });
    }
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
    // Send warnings to Sentry as breadcrumbs
    Sentry.addBreadcrumb({
      category: 'warning',
      message,
      data: context,
      level: 'warning',
    });
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error instanceof Error
      ? { ...context, errorMessage: error.message }
      : { ...context, error };

    console.error(this.formatMessage('error', message, errorContext));

    // Send to Sentry in production
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: { message, ...context },
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: errorContext,
      });
    }
  }

  // Helper for logging service calls
  service(serviceName: string, method: string, data?: LogContext): void {
    this.debug(`${serviceName}.${method}`, data);
  }

  // Helper for logging API calls
  api(method: string, endpoint: string, data?: LogContext): void {
    this.debug(`API ${method} ${endpoint}`, data);
  }

  // Set user context for Sentry
  setUser(user: { id: string; email?: string; role?: string }): void {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // Clear user context (on logout)
  clearUser(): void {
    Sentry.setUser(null);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogLevel, LogContext };
