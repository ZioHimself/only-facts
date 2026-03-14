import { ValidationError } from '../../src/errors/validation-error';
import type { ValidationErrorDetail } from '../../src/errors/validation-error';

describe('ValidationError', () => {
  it('has code property set to VALIDATION_ERROR', () => {
    const error = new ValidationError('test', []);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('preserves the error message', () => {
    const error = new ValidationError('Invalid signal payload', []);
    expect(error.message).toBe('Invalid signal payload');
  });

  it('stores details array', () => {
    const details: ValidationErrorDetail[] = [
      { field: 'text', message: 'required' },
      { field: 'language', message: 'invalid format' },
    ];
    const error = new ValidationError('test', details);
    expect(error.details).toEqual(details);
    expect(error.details).toHaveLength(2);
  });

  it('is an instance of Error', () => {
    const error = new ValidationError('test', []);
    expect(error).toBeInstanceOf(Error);
  });

  it('is an instance of ValidationError', () => {
    const error = new ValidationError('test', []);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('works with empty details array', () => {
    const error = new ValidationError('no details', []);
    expect(error.details).toEqual([]);
  });
});
