/**
 * User-friendly error message utilities for Vinylogix
 * Converts technical errors into readable messages for users
 */

import { logger } from './logger';

/**
 * Common error types
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error message mapping
 */
const errorMessages: Record<ErrorType, { title: string; description: string }> = {
  [ErrorType.NETWORK]: {
    title: 'Connection Error',
    description: 'Unable to connect to the server. Please check your internet connection and try again.',
  },
  [ErrorType.AUTH]: {
    title: 'Authentication Required',
    description: 'You need to be logged in to perform this action. Please sign in and try again.',
  },
  [ErrorType.PERMISSION]: {
    title: 'Permission Denied',
    description: 'You don\'t have permission to perform this action. Contact your administrator if you believe this is an error.',
  },
  [ErrorType.VALIDATION]: {
    title: 'Invalid Input',
    description: 'Please check your input and try again. Make sure all required fields are filled correctly.',
  },
  [ErrorType.NOT_FOUND]: {
    title: 'Not Found',
    description: 'The requested item could not be found. It may have been deleted or moved.',
  },
  [ErrorType.CONFLICT]: {
    title: 'Conflict',
    description: 'This action conflicts with existing data. Please refresh and try again.',
  },
  [ErrorType.RATE_LIMIT]: {
    title: 'Too Many Requests',
    description: 'You\'re making too many requests. Please wait a moment and try again.',
  },
  [ErrorType.SERVER]: {
    title: 'Server Error',
    description: 'Something went wrong on our end. Please try again later.',
  },
  [ErrorType.UNKNOWN]: {
    title: 'Unexpected Error',
    description: 'An unexpected error occurred. Please try again.',
  },
};

/**
 * Firebase Auth error code mapping
 */
const firebaseAuthErrors: Record<string, { title: string; description: string }> = {
  'auth/invalid-email': {
    title: 'Invalid Email',
    description: 'Please enter a valid email address.',
  },
  'auth/user-disabled': {
    title: 'Account Disabled',
    description: 'This account has been disabled. Please contact support.',
  },
  'auth/user-not-found': {
    title: 'Account Not Found',
    description: 'No account exists with this email address.',
  },
  'auth/wrong-password': {
    title: 'Incorrect Password',
    description: 'The password you entered is incorrect. Please try again.',
  },
  'auth/email-already-in-use': {
    title: 'Email Already Registered',
    description: 'An account with this email already exists. Try logging in instead.',
  },
  'auth/weak-password': {
    title: 'Weak Password',
    description: 'Please choose a stronger password (at least 6 characters).',
  },
  'auth/operation-not-allowed': {
    title: 'Operation Not Allowed',
    description: 'This operation is not allowed. Please contact support.',
  },
  'auth/too-many-requests': {
    title: 'Too Many Attempts',
    description: 'Access temporarily disabled due to many failed attempts. Try again later.',
  },
  'auth/network-request-failed': {
    title: 'Network Error',
    description: 'Network error occurred. Please check your connection.',
  },
};

/**
 * Firestore error code mapping
 */
const firestoreErrors: Record<string, { title: string; description: string }> = {
  'permission-denied': {
    title: 'Permission Denied',
    description: 'You don\'t have permission to access this data.',
  },
  'not-found': {
    title: 'Not Found',
    description: 'The requested data was not found.',
  },
  'already-exists': {
    title: 'Already Exists',
    description: 'This item already exists.',
  },
  'resource-exhausted': {
    title: 'Quota Exceeded',
    description: 'You\'ve exceeded your quota. Please try again later.',
  },
  'unavailable': {
    title: 'Service Unavailable',
    description: 'The service is temporarily unavailable. Please try again.',
  },
};

/**
 * Parse error and return user-friendly message
 */
export function parseError(error: any): { title: string; description: string } {
  // Log the original error for debugging
  logger.error('Error occurred', error);

  // Handle Firebase Auth errors
  if (error?.code?.startsWith('auth/')) {
    const authError = firebaseAuthErrors[error.code];
    if (authError) return authError;
  }

  // Handle Firestore errors
  if (error?.code && firestoreErrors[error.code]) {
    return firestoreErrors[error.code];
  }

  // Handle HTTP status codes
  if (error?.status || error?.response?.status) {
    const status = error.status || error.response.status;

    switch (status) {
      case 400:
        return errorMessages[ErrorType.VALIDATION];
      case 401:
        return errorMessages[ErrorType.AUTH];
      case 403:
        return errorMessages[ErrorType.PERMISSION];
      case 404:
        return errorMessages[ErrorType.NOT_FOUND];
      case 409:
        return errorMessages[ErrorType.CONFLICT];
      case 429:
        return errorMessages[ErrorType.RATE_LIMIT];
      case 500:
      case 502:
      case 503:
        return errorMessages[ErrorType.SERVER];
    }
  }

  // Handle network errors
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return errorMessages[ErrorType.NETWORK];
  }

  // Return generic error
  return errorMessages[ErrorType.UNKNOWN];
}

/**
 * Get error message for specific context
 */
export function getContextError(context: string, error: any): { title: string; description: string } {
  const baseError = parseError(error);

  // Customize based on context
  const contextMessages: Record<string, Partial<Record<ErrorType, string>>> = {
    'record': {
      [ErrorType.NOT_FOUND]: 'Record not found. It may have been deleted.',
      [ErrorType.PERMISSION]: 'You don\'t have permission to modify this record.',
    },
    'order': {
      [ErrorType.NOT_FOUND]: 'Order not found. It may have been cancelled.',
      [ErrorType.PERMISSION]: 'You don\'t have permission to view this order.',
    },
    'user': {
      [ErrorType.NOT_FOUND]: 'User account not found.',
      [ErrorType.PERMISSION]: 'You don\'t have permission to modify user accounts.',
    },
  };

  // Override description if context-specific message exists
  const contextType = Object.keys(errorMessages).find(
    key => errorMessages[key as ErrorType].title === baseError.title
  ) as ErrorType;

  if (contextType && contextMessages[context]?.[contextType]) {
    return {
      ...baseError,
      description: contextMessages[context][contextType]!,
    };
  }

  return baseError;
}

/**
 * Format error for toast notification
 */
export function formatErrorForToast(error: any, context?: string) {
  const { title, description } = context
    ? getContextError(context, error)
    : parseError(error);

  return {
    title,
    description,
    variant: 'destructive' as const,
  };
}
