import { validateAndNormalizeSignalPayload } from '../../src/services/signal-service.js';
import { ValidationError } from '../../src/errors/validation-error.js';

describe('validateAndNormalizeSignalPayload', () => {
  const basePayload = {
    platform: 'x' as const,
    externalId: '123',
    authorId: '456',
    conversationId: '123',
    text: 'Hello World #Demo @User https://example.com',
    language: 'en',
    hashtags: ['Demo'],
    mentions: ['User'],
    urls: ['https://example.com'],
    createdAt: '2026-03-14T12:34:56.000Z',
  };

  describe('happy path', () => {
    it('normalizes a valid payload', () => {
      const result = validateAndNormalizeSignalPayload(basePayload);

      expect(result.platform).toBe('x');
      expect(result.externalId).toBe('123');
      expect(result.hashtags).toEqual(['demo']);
      expect(result.mentions).toEqual(['user']);
      expect(result.urls).toEqual(['https://example.com/']);
      expect(result.language).toBe('en');
      expect(result.metrics.likeCount).toBe(0);
      expect(result.metrics.replyCount).toBe(0);
      expect(result.metrics.retweetCount).toBe(0);
      expect(result.metrics.quoteCount).toBe(0);
      expect(result.source).toBe('api');
    });

    it('defaults source to api when omitted', () => {
      const result = validateAndNormalizeSignalPayload(basePayload);
      expect(result.source).toBe('api');
    });

    it('preserves explicit source values', () => {
      expect(
        validateAndNormalizeSignalPayload({ ...basePayload, source: 'batch' }).source
      ).toBe('batch');
      expect(
        validateAndNormalizeSignalPayload({ ...basePayload, source: 'manual' }).source
      ).toBe('manual');
    });

    it('collapses whitespace in text', () => {
      const payload = { ...basePayload, text: '  hello   world  ' };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.text).toBe('hello world');
    });

    it('normalizes language with region code', () => {
      const payload = { ...basePayload, language: 'en-US' };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.language).toBe('en-US');
    });

    it('lowercases and deduplicates hashtags', () => {
      const payload = { ...basePayload, hashtags: ['Demo', 'DEMO', 'test'] };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.hashtags).toEqual(['demo', 'test']);
    });

    it('lowercases and deduplicates mentions', () => {
      const payload = { ...basePayload, mentions: ['User', 'USER', 'other'] };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.mentions).toEqual(['user', 'other']);
    });

    it('filters empty strings from hashtags', () => {
      const payload = { ...basePayload, hashtags: ['demo', '', '  '] };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.hashtags).toEqual(['demo']);
    });

    it('trims externalId, authorId, conversationId', () => {
      const payload = {
        ...basePayload,
        externalId: '  123  ',
        authorId: '  456  ',
        conversationId: '  789  ',
      };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.externalId).toBe('123');
      expect(result.authorId).toBe('456');
      expect(result.conversationId).toBe('789');
    });

    it('parses createdAt into a Date object', () => {
      const result = validateAndNormalizeSignalPayload(basePayload);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe('2026-03-14T12:34:56.000Z');
    });

    it('passes through geo when valid', () => {
      const payload = {
        ...basePayload,
        geo: { countryCode: 'US', placeId: 'abc' },
      };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.geo).toEqual({ countryCode: 'US', placeId: 'abc' });
    });

    it('passes through raw field', () => {
      const payload = { ...basePayload, raw: { foo: 'bar' } };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.raw).toEqual({ foo: 'bar' });
    });
  });

  describe('required field validation', () => {
    it('throws ValidationError when required fields are missing', () => {
      expect(() => validateAndNormalizeSignalPayload({})).toThrow(ValidationError);
    });

    it('throws when payload is null', () => {
      expect(() => validateAndNormalizeSignalPayload(null)).toThrow(ValidationError);
      try {
        validateAndNormalizeSignalPayload(null);
      } catch (e) {
        expect((e as ValidationError).details[0].field).toBe('root');
      }
    });

    it('throws when payload is a string', () => {
      expect(() => validateAndNormalizeSignalPayload('not an object')).toThrow(ValidationError);
    });

    it('throws when payload is a number', () => {
      expect(() => validateAndNormalizeSignalPayload(42)).toThrow(ValidationError);
    });

    it('reports all missing required fields', () => {
      try {
        validateAndNormalizeSignalPayload({ platform: 'x' });
      } catch (e) {
        const err = e as ValidationError;
        const fields = err.details.map((d) => d.field);
        expect(fields).toContain('externalId');
        expect(fields).toContain('authorId');
        expect(fields).toContain('text');
        expect(fields).toContain('language');
        expect(fields).toContain('createdAt');
      }
    });
  });

  describe('platform validation', () => {
    it('throws for unsupported platform', () => {
      const payload = { ...basePayload, platform: 'facebook' };
      expect(() => validateAndNormalizeSignalPayload(payload)).toThrow(ValidationError);
    });
  });

  describe('text validation', () => {
    it('throws when text exceeds 2000 characters', () => {
      const payload = { ...basePayload, text: 'a'.repeat(2001) };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const textError = err.details.find((d) => d.field === 'text');
        expect(textError).toBeDefined();
        expect(textError!.message).toContain('2000');
      }
    });

    it('accepts text at exactly 2000 characters', () => {
      const payload = { ...basePayload, text: 'a'.repeat(2000) };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.text.length).toBe(2000);
    });
  });

  describe('language validation', () => {
    it('throws for invalid language code', () => {
      const payload = { ...basePayload, language: 'english' };
      expect(() => validateAndNormalizeSignalPayload(payload)).toThrow(ValidationError);
    });

    it('accepts 2-letter language code', () => {
      const result = validateAndNormalizeSignalPayload({ ...basePayload, language: 'uk' });
      expect(result.language).toBe('uk');
    });

    it('accepts 3-letter language code', () => {
      const result = validateAndNormalizeSignalPayload({ ...basePayload, language: 'ukr' });
      expect(result.language).toBe('ukr');
    });

    it('accepts language with region', () => {
      const result = validateAndNormalizeSignalPayload({ ...basePayload, language: 'en-US' });
      expect(result.language).toBe('en-US');
    });
  });

  describe('createdAt validation', () => {
    it('throws for unparseable date string', () => {
      const payload = { ...basePayload, createdAt: 'not-a-date' };
      expect(() => validateAndNormalizeSignalPayload(payload)).toThrow(ValidationError);
    });
  });

  describe('URL validation', () => {
    it('throws for invalid URLs', () => {
      const payload = { ...basePayload, urls: ['not-a-url'] };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const urlError = err.details.find((d) => d.field === 'urls');
        expect(urlError).toBeDefined();
      }
    });

    it('throws when a URL exceeds 512 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(500);
      const payload = { ...basePayload, urls: [longUrl] };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const urlError = err.details.find((d) => d.field === 'urls');
        expect(urlError).toBeDefined();
        expect(urlError!.message).toContain('512');
      }
    });

    it('throws when urls is not an array', () => {
      const payload = { ...basePayload, urls: 'https://example.com' };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const urlError = err.details.find((d) => d.field === 'urls');
        expect(urlError).toBeDefined();
      }
    });
  });

  describe('geo validation', () => {
    it('throws for invalid countryCode format', () => {
      const payload = { ...basePayload, geo: { countryCode: 'usa' } };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const geoError = err.details.find((d) => d.field === 'geo.countryCode');
        expect(geoError).toBeDefined();
      }
    });

    it('throws for lowercase countryCode', () => {
      const payload = { ...basePayload, geo: { countryCode: 'us' } };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const geoError = err.details.find((d) => d.field === 'geo.countryCode');
        expect(geoError).toBeDefined();
      }
    });
  });

  describe('metrics validation', () => {
    it('throws for negative metric values', () => {
      const payload = { ...basePayload, metrics: { likeCount: -1 } };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const metricError = err.details.find((d) => d.field === 'metrics.likeCount');
        expect(metricError).toBeDefined();
      }
    });

    it('throws for non-integer metric values', () => {
      const payload = { ...basePayload, metrics: { replyCount: 1.5 } };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const metricError = err.details.find((d) => d.field === 'metrics.replyCount');
        expect(metricError).toBeDefined();
      }
    });

    it('accepts zero metric values', () => {
      const payload = {
        ...basePayload,
        metrics: { likeCount: 0, replyCount: 0, retweetCount: 0, quoteCount: 0 },
      };
      const result = validateAndNormalizeSignalPayload(payload);
      expect(result.metrics.likeCount).toBe(0);
    });
  });

  describe('array length limits', () => {
    it('throws when hashtags exceed 100 items', () => {
      const payload = {
        ...basePayload,
        hashtags: Array.from({ length: 101 }, (_, i) => `tag${i}`),
      };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const hashtagError = err.details.find((d) => d.field === 'hashtags');
        expect(hashtagError).toBeDefined();
        expect(hashtagError!.message).toContain('100');
      }
    });

    it('throws when urls exceed 100 items', () => {
      const payload = {
        ...basePayload,
        urls: Array.from({ length: 101 }, (_, i) => `https://example.com/${i}`),
      };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const urlError = err.details.find((d) => d.field === 'urls');
        expect(urlError).toBeDefined();
        expect(urlError!.message).toContain('100');
      }
    });
  });

  describe('non-array field types', () => {
    it('throws when hashtags is not an array', () => {
      const payload = { ...basePayload, hashtags: 'not-array' };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const hashtagError = err.details.find((d) => d.field === 'hashtags');
        expect(hashtagError).toBeDefined();
      }
    });

    it('throws when mentions is not an array', () => {
      const payload = { ...basePayload, mentions: 42 };
      try {
        validateAndNormalizeSignalPayload(payload);
      } catch (e) {
        const err = e as ValidationError;
        const mentionError = err.details.find((d) => d.field === 'mentions');
        expect(mentionError).toBeDefined();
      }
    });
  });
});
