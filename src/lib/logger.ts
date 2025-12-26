/**
 * Logging utility for Vinylogix
 * Provides structured logging with different levels
 * Can be extended to send logs to external services in production
 */

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
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error instanceof Error
      ? { ...context, errorMessage: error.message, stack: error.stack }
      : { ...context, error };

    console.error(this.formatMessage('error', message, errorContext));

    // In production, errors could be sent to an external service here
    // e.g., Google Cloud Error Reporting, LogRocket, etc.
  }

  // Helper for logging service calls
  service(serviceName: string, method: string, data?: LogContext): void {
    this.debug(`${serviceName}.${method}`, data);
  }

  // Helper for logging API calls
  api(method: string, endpoint: string, data?: LogContext): void {
    this.debug(`API ${method} ${endpoint}`, data);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogLevel, LogContext };
