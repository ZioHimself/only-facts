export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string, public readonly details: ValidationErrorDetail[]) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
