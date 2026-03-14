import { SignalModel, type Signal, type PlatformType } from '../models/signal.js';
import { ValidationError, type ValidationErrorDetail } from '../errors/validation-error.js';

export interface SignalPayload {
  platform: PlatformType;
  externalId: string;
  authorId: string;
  conversationId: string;
  text: string;
  language: string;
  hashtags?: string[];
  mentions?: string[];
  urls?: string[];
  createdAt: string;
  geo?: {
    countryCode?: string;
    placeId?: string;
  };
  metrics?: {
    likeCount?: number;
    replyCount?: number;
    retweetCount?: number;
    quoteCount?: number;
  };
  source?: 'api' | 'batch' | 'manual';
  raw?: Record<string, unknown>;
}

export interface NormalizedSignalPayload {
  platform: PlatformType;
  externalId: string;
  authorId: string;
  conversationId: string;
  text: string;
  language: string;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  createdAt: Date;
  geo?: {
    countryCode?: string;
    placeId?: string;
  };
  metrics: {
    likeCount: number;
    replyCount: number;
    retweetCount: number;
    quoteCount: number;
  };
  source: 'api' | 'batch' | 'manual';
  raw?: Record<string, unknown>;
}

const MAX_TEXT_LENGTH = 2000;
const MAX_ARRAY_LENGTH = 100;
const MAX_URL_LENGTH = 512;

export function validateAndNormalizeSignalPayload(input: unknown): NormalizedSignalPayload {
  const details: ValidationErrorDetail[] = [];

  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Invalid signal payload', [
      { field: 'root', message: 'Payload must be an object' },
    ]);
  }

  const payload = input as SignalPayload;

  const requiredStringFields: Array<keyof SignalPayload> = [
    'platform',
    'externalId',
    'authorId',
    'conversationId',
    'text',
    'language',
    'createdAt',
  ];

  for (const field of requiredStringFields) {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      details.push({
        field,
        message: 'Field is required and must be a non-empty string',
      });
    }
  }

  if (payload.platform !== 'x') {
    details.push({
      field: 'platform',
      message: 'Only platform "x" is supported',
    });
  }

  if (typeof payload.text === 'string' && payload.text.length > MAX_TEXT_LENGTH) {
    details.push({
      field: 'text',
      message: `Text length must be <= ${MAX_TEXT_LENGTH} characters`,
    });
  }

  const languagePattern = /^[a-z]{2,3}(?:-[A-Z]{2})?$/u;
  if (typeof payload.language === 'string' && !languagePattern.test(payload.language)) {
    details.push({
      field: 'language',
      message: 'Language must match pattern /^[a-z]{2,3}(-[A-Z]{2})?$/',
    });
  }

  let createdAt: Date | undefined;
  if (typeof payload.createdAt === 'string') {
    const date = new Date(payload.createdAt);
    if (Number.isNaN(date.getTime())) {
      details.push({
        field: 'createdAt',
        message: 'createdAt must be a valid ISO8601 date string',
      });
    } else {
      createdAt = date;
    }
  }

  const normalizeStringArray = (value: unknown, field: string): string[] => {
    if (value === undefined) {
      return [];
    }
    if (!Array.isArray(value)) {
      details.push({
        field,
        message: 'Field must be an array of strings',
      });
      return [];
    }
    if (value.length > MAX_ARRAY_LENGTH) {
      details.push({
        field,
        message: `Array length must be <= ${MAX_ARRAY_LENGTH}`,
      });
    }

    const normalized: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') {
        details.push({
          field,
          message: 'Array items must be strings',
        });
        return [];
      }
      const trimmed = item.trim();
      if (trimmed.length === 0) {
        continue;
      }
      normalized.push(trimmed.toLowerCase());
    }

    return Array.from(new Set(normalized));
  };

  const hashtags = normalizeStringArray(payload.hashtags, 'hashtags');
  const mentions = normalizeStringArray(payload.mentions, 'mentions');

  const urls: string[] = [];
  if (payload.urls !== undefined) {
    if (!Array.isArray(payload.urls)) {
      details.push({
        field: 'urls',
        message: 'urls must be an array of strings',
      });
    } else {
      if (payload.urls.length > MAX_ARRAY_LENGTH) {
        details.push({
          field: 'urls',
          message: `Array length must be <= ${MAX_ARRAY_LENGTH}`,
        });
      }

      for (const url of payload.urls) {
        if (typeof url !== 'string') {
          details.push({
            field: 'urls',
            message: 'urls items must be strings',
          });
          break;
        }

        if (url.length > MAX_URL_LENGTH) {
          details.push({
            field: 'urls',
            message: `URL length must be <= ${MAX_URL_LENGTH}`,
          });
          break;
        }

        try {
          const parsed = new URL(url);
          urls.push(parsed.toString());
        } catch {
          details.push({
            field: 'urls',
            message: 'urls must contain valid absolute URLs',
          });
          break;
        }
      }
    }
  }

  if (payload.geo?.countryCode !== undefined) {
    const cc = payload.geo.countryCode;
    if (typeof cc !== 'string' || !/^[A-Z]{2}$/u.test(cc)) {
      details.push({
        field: 'geo.countryCode',
        message: 'countryCode must be a 2-letter ISO country code',
      });
    }
  }

  const metrics = {
    likeCount: payload.metrics?.likeCount ?? 0,
    replyCount: payload.metrics?.replyCount ?? 0,
    retweetCount: payload.metrics?.retweetCount ?? 0,
    quoteCount: payload.metrics?.quoteCount ?? 0,
  };

  (Object.keys(metrics) as Array<keyof typeof metrics>).forEach((key) => {
    const value = metrics[key];
    if (!Number.isInteger(value) || value < 0) {
      details.push({
        field: `metrics.${key.toString()}`,
        message: 'Metric must be a non-negative integer',
      });
    }
  });

  if (details.length > 0 || createdAt === undefined) {
    throw new ValidationError('Invalid signal payload', details);
  }

  const text = payload.text.trim().replace(/\s+/gu, ' ');

  let language = payload.language;
  const [lang, region] = language.split('-');
  if (region !== undefined && region.length > 0) {
    language = `${lang.toLowerCase()}-${region.toUpperCase()}`;
  } else {
    language = lang.toLowerCase();
  }

  const source: 'api' | 'batch' | 'manual' =
    payload.source === 'batch' || payload.source === 'manual' ? payload.source : 'api';

  return {
    platform: 'x',
    externalId: payload.externalId.trim(),
    authorId: payload.authorId.trim(),
    conversationId: payload.conversationId.trim(),
    text,
    language,
    hashtags,
    mentions,
    urls,
    createdAt,
    geo: payload.geo,
    metrics,
    source,
    raw: payload.raw,
  };
}

export async function ingestSignal(payload: unknown): Promise<{ signal: Signal; duplicate: boolean }> {
  const normalized = validateAndNormalizeSignalPayload(payload);

  const existing = await SignalModel.findOne({
    platform: normalized.platform,
    externalId: normalized.externalId,
  }).exec();

  if (existing) {
    return { signal: existing, duplicate: true };
  }

  const signal = await SignalModel.create({
    ...normalized,
    ingestedAt: new Date(),
  });

  return { signal, duplicate: false };
}
