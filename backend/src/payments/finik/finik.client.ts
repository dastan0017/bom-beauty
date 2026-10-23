import { Inject, Injectable, Logger } from '@nestjs/common';
import { canonicalString, signCanonical, sortTopLevel } from './finik-signer';
import { FINIK_CONFIG, type FinikConfig } from './finik.config';

// Create Payment on Finik's API (docs/finik/SPEC.md §2.5, verified live 2026-10-23). Never logs the API key, the
// signature, the body or the payment URL (a bearer link): only ids, statuses and the payment page host.

const TIMEOUT_MS = 10_000;

export interface CreatePaymentInput {
  /** Our payments.id, sent as PaymentId (≤ 36 characters). */
  paymentId: string;
  amountKgs: number;
  /** Shown on Finik's page and echoed in the webhook: "Заказ №1042". */
  description: string;
  /** Where Finik sends the customer back. */
  redirectUrl: string;
  /** Data.endDate: the payment link stops working after this. */
  expiresAt: Date;
  /** Data.name_en: the name of the payment shown to the customer. */
  qrName: string;
}

export type CreatePaymentResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason: 'not_configured' | 'http' | 'timeout' | 'network' | 'bad_url';
      status?: number;
      message?: string;
    };

@Injectable()
export class FinikClient {
  private readonly logger = new Logger('Finik');

  constructor(@Inject(FINIK_CONFIG) private readonly config: FinikConfig) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const { baseUrl, apiKey, accountId, privateKey, webhookUrl, environment } = this.config;
    if (environment === 'mock' && webhookUrl) {
      // The local stand-in for Finik's page (FinikMockController).
      return { ok: true, url: `${webhookUrl.origin}/v1/dev/finik/pay/${input.paymentId}` };
    }
    if (!baseUrl || !apiKey || !accountId || !privateKey || !webhookUrl)
      return { ok: false, reason: 'not_configured' };

    const body = sortTopLevel({
      Amount: input.amountKgs,
      CardType: 'FINIK_QR',
      PaymentId: input.paymentId,
      RedirectUrl: input.redirectUrl,
      Lang: 'ru',
      Data: {
        accountId,
        name_en: input.qrName,
        webhookUrl: webhookUrl.toString(),
        description: input.description,
        endDate: input.expiresAt.getTime(),
      },
    });
    const url = new URL('/v1/payment', baseUrl);
    // Signed right before sending: Finik checks the timestamp.
    const signed = { 'x-api-key': apiKey, 'x-api-timestamp': Date.now().toString() };
    const signature = signCanonical(
      canonicalString({ method: 'POST', path: url.pathname, host: url.host, headers: signed, body }),
      privateKey,
    );

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...signed, signature },
        body: JSON.stringify(body),
        // A 302 carries the payment page in Location; following it would download the page's HTML instead.
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
      this.logger.warn(`create ${input.paymentId}: ${reason}`);
      return { ok: false, reason };
    }

    let paymentUrl: string | null = null;
    if (response.status >= 300 && response.status < 400) {
      paymentUrl = response.headers.get('location');
    } else if (response.ok) {
      // Newer format announced by Finik: 201 { paymentId, paymentUrl, status }.
      const json = (await response.json().catch(() => null)) as { paymentUrl?: unknown } | null;
      paymentUrl = typeof json?.paymentUrl === 'string' ? json.paymentUrl : null;
    } else {
      const message = errorMessage(await response.text().catch(() => ''));
      this.logger.warn(`create ${input.paymentId}: Finik ${response.status} ${message}`);
      return { ok: false, reason: 'http', status: response.status, message };
    }

    const host = httpsHost(paymentUrl);
    if (!paymentUrl || !host) {
      this.logger.warn(`create ${input.paymentId}: Finik ${response.status} without an https payment page`);
      return { ok: false, reason: 'bad_url', status: response.status };
    }
    this.logger.log(`create ${input.paymentId}: Finik ${response.status} → ${host}`);
    return { ok: true, url: paymentUrl };
  }
}

/** Finik answers `{ ErrorMessage }` (or `{ message }` from its API gateway); never longer than 200 characters. */
function errorMessage(text: string): string {
  try {
    const json = JSON.parse(text) as { ErrorMessage?: unknown; message?: unknown };
    const message = json.ErrorMessage ?? json.message;
    if (typeof message === 'string') return message.slice(0, 200);
  } catch {
    // not JSON
  }
  return text.slice(0, 200);
}

function httpsHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.host : null;
  } catch {
    return null;
  }
}
