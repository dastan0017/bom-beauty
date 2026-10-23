import { createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto';
import type { FinikEnvironment } from '@bom/shared';
import { pemFromBase64, type Env } from '../../config/env';
import { FINIK_BETA_PUBLIC_KEY, FINIK_PROD_PUBLIC_KEY } from './finik-keys';

/** DI token of the Finik configuration (built once at boot from env). */
export const FINIK_CONFIG = Symbol('FINIK_CONFIG');

const BASE_URLS = {
  beta: 'https://beta.api.acquiring.averspay.kg',
  prod: 'https://api.acquiring.averspay.kg',
} as const;

export interface FinikConfig {
  /** null: online payment is not configured on this server. */
  environment: FinikEnvironment | null;
  /** Finik's API; null in mock mode. */
  baseUrl: string | null;
  apiKey: string | null;
  accountId: string | null;
  /** Our key, signs requests to Finik. */
  privateKey: KeyObject | null;
  /** Verifies webhooks: Finik's public key for the environment, or the mock's. */
  webhookKey: KeyObject | null;
  /** Mock mode only: plays Finik's private key when the mock payment page sends a webhook. */
  mockFinikKey: KeyObject | null;
  /** Where Finik posts webhooks; its host and path are part of Finik's signature. */
  webhookUrl: URL | null;
}

export function finikConfigFromEnv(env: Env): FinikConfig {
  const off: FinikConfig = {
    environment: null,
    baseUrl: null,
    apiKey: null,
    accountId: null,
    privateKey: null,
    webhookKey: null,
    mockFinikKey: null,
    webhookUrl: null,
  };
  if (!env.FINIK_ENV || !env.FINIK_WEBHOOK_URL) return off;
  const webhookUrl = new URL(env.FINIK_WEBHOOK_URL);

  if (env.FINIK_ENV === 'mock') {
    // A fresh pair per process: the mock page and the webhook it calls run in the same API process.
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    return {
      ...off,
      environment: 'mock',
      accountId: env.FINIK_ACCOUNT_ID ?? 'mock-account',
      webhookKey: pair.publicKey,
      mockFinikKey: pair.privateKey,
      webhookUrl,
    };
  }

  if (!env.FINIK_API_KEY || !env.FINIK_ACCOUNT_ID || !env.FINIK_PRIVATE_KEY_BASE64) return off;
  const finikPem = env.FINIK_PUBLIC_KEY_BASE64
    ? pemFromBase64(env.FINIK_PUBLIC_KEY_BASE64)
    : env.FINIK_ENV === 'prod'
      ? FINIK_PROD_PUBLIC_KEY
      : FINIK_BETA_PUBLIC_KEY;
  return {
    ...off,
    environment: env.FINIK_ENV,
    baseUrl: BASE_URLS[env.FINIK_ENV],
    apiKey: env.FINIK_API_KEY,
    accountId: env.FINIK_ACCOUNT_ID,
    privateKey: createPrivateKey(pemFromBase64(env.FINIK_PRIVATE_KEY_BASE64)),
    webhookKey: createPublicKey(finikPem),
    webhookUrl,
  };
}

export const isFinikConfigured = (config: FinikConfig): boolean => config.environment !== null;

/** "ff99…ec89" for the admin: enough to recognise the account, not to copy it. */
export const maskAccountId = (accountId: string | null): string | null =>
  accountId && accountId.length > 10 ? `${accountId.slice(0, 4)}…${accountId.slice(-4)}` : accountId;
