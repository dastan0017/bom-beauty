import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FINIK_BETA_PUBLIC_KEY, FINIK_PROD_PUBLIC_KEY } from './finik-keys';
import {
  canonicalString,
  signCanonical,
  sortTopLevel,
  verifyCanonical,
  type CanonicalRequest,
} from './finik-signer';

// Finik's two published signed webhooks (docs/finik/SPEC.md §2.8). If these stop verifying, our canonical string no
// longer matches Finik's and every real webhook would be rejected.

const prod = createPublicKey(FINIK_PROD_PUBLIC_KEY);
const beta = createPublicKey(FINIK_BETA_PUBLIC_KEY);

const vectorA: CanonicalRequest = {
  method: 'POST',
  path: '/finik-callback',
  host: 'huntpro.kg',
  headers: { 'content-type': 'application/json', 'x-api-timestamp': '1781763261255' },
  body: {
    fields: {
      amount: 1,
      webhook_url: 'https://huntpro.kg/finik-callback',
      paymentId: '141fc797-0366-480e-8ba7-2982632b2b2c',
      success_redirect_url:
        'https://api.acquiring.averspay.kg/v1/redirect?paymentId=141fc797-0366-480e-8ba7-2982632b2b2c&clientId=1295102413&status=succeeded',
      name: 'HuntPro',
      qrTransactionId: 'aaa76e79-f808-4ac5-b88e-76a9b4055832',
    },
    amount: 1,
    transactionDate: 1781697937466,
    clientId: '25c1aabe-fc4a-4968-85d9-90600466e9a5',
    id: '320259584_aaa76e79-f808-4ac5-b88e-76a9b4055832_DEBIT',
    status: 'succeeded',
    transactionId: '141fc797-0366-480e-8ba7-2982632b2b2c',
    data: {
      accountId: '8d4e1d11-e50c-4278-a5e2-4e55de196c6a',
      description: 'Order 2606',
      webhookUrl: 'https://huntpro.kg/finik-callback',
      name_en: 'HuntPro',
    },
  },
};
const signatureA =
  'jS1a8HW4BTIea8iCmoW/EF7FXUA0JSsHe/kSRBfCYdxFwvyrMe0SOfU9pAKzOOO0bIsa9FW+WqAzqxExHjcscmG8k/vwgB+dCMcM04K91vTL6eZAVOE/Hcx2iALNZnG6UVnP/jnUt8MjK+xwBhamwFktxdUovf+cVFZ2io10RAT1pOEIHtZceXbQeg7XlhcPuTAKmOuF1B4gGoksRtGglGwwyvYaa9ml8OPMP3uoCaauYqT0aUKLTNsJdFfO0Q3Dvsy9uyWvuVa5t6adbIm+SHlbz9VGSZ2xrwgETUBVj86dfA3oiAgERLKhQTBSMTxRYlUKhPVHGfR3kjAhD3g4JQ==';

const vectorB: CanonicalRequest = {
  method: 'POST',
  path: '/payments-callback',
  host: 'beta.api.averspay.kg',
  headers: { 'content-type': 'application/json', 'x-api-timestamp': '1776424627146' },
  body: {
    id: '3601266827_deb2bb99-843d-4dbe-8278-378e5d5cbee8_DEBIT',
    accountId: '5ec90dc6-e89d-424e-b3ca-48d1e5adb542',
    amount: 1,
    clientId: '79ba7a09-3365-4c5a-b0b4-10905e368698',
    deviceId: '060354a4-f82b-440d-8eed-868699e13218',
    fields: {
      transactionType: '20',
      amount: 1,
      paymentId: '1241932578574150354',
      success_redirect_url:
        'https://beta.api.acquiring.averspay.kg/v1/redirect?paymentId=1241932578574150354&clientId=3551560937&status=succeeded',
      qrComment: '',
      name: '79366240695',
      qrTransactionId: 'deb2bb99-843d-4dbe-8278-378e5d5cbee8',
      url: 'https://beta.qr.finik.kg/#00020101021232810011qr.finik.kg0114averspay-items1032509149e544bf4a31ab4974b21e5cc2e712021213021252044829530341754031005908Finik-QR63047de4',
    },
    receiptNumber: '291831989813',
    requestDate: 1776424624350,
    status: 'SUCCEEDED',
    transactionDate: 1776424624711,
    transactionId: 'deb2bb99-843d-4dbe-8278-378e5d5cbee8',
    transactionType: 'DEBIT',
    item: { id: '999248699_1241932578574150354' },
  },
};
const signatureB =
  'ZPqSA5LWRsw4nFNP0iOuUETggqP0joatjpWuQ1th52u2lf0jWj045Y4b1K0N0uGiqtnteMDmaXsXjRlWjb29lgjuICLs2zmUjwYUgGJZR+4cGFi8N0FfmXPBJUcxDExSRmclUngUzsKTQYyzmhq7fXsAqG+/NzB2QKqEOb5FCtS8Q1iDMPP3RldcbD9v2E154safALwCbMWEVcriSB1YnPY9yshlQZHTSoI9un5IRFMsgfjRlPBPU2E9AEffKEmlzNzuuruzHXuUw2E1Nu9SyEnwl6os1Ytfpgy5AD6OXKKE6pcjF3MigYe1vW/+dMZ0ZggGCPCqYSV5i1Q8SVzciA==';

describe('Finik signer: published vectors', () => {
  it('builds exactly the canonical strings Finik signed', () => {
    expect(canonicalString(vectorA)).toBe(
      [
        'post',
        '/finik-callback',
        'host:huntpro.kg&x-api-timestamp:1781763261255',
        '{"amount":1,"clientId":"25c1aabe-fc4a-4968-85d9-90600466e9a5","data":{"accountId":"8d4e1d11-e50c-4278-a5e2-4e55de196c6a","description":"Order 2606","webhookUrl":"https://huntpro.kg/finik-callback","name_en":"HuntPro"},"fields":{"amount":1,"webhook_url":"https://huntpro.kg/finik-callback","paymentId":"141fc797-0366-480e-8ba7-2982632b2b2c","success_redirect_url":"https://api.acquiring.averspay.kg/v1/redirect?paymentId=141fc797-0366-480e-8ba7-2982632b2b2c&clientId=1295102413&status=succeeded","name":"HuntPro","qrTransactionId":"aaa76e79-f808-4ac5-b88e-76a9b4055832"},"id":"320259584_aaa76e79-f808-4ac5-b88e-76a9b4055832_DEBIT","status":"succeeded","transactionDate":1781697937466,"transactionId":"141fc797-0366-480e-8ba7-2982632b2b2c"}',
      ].join('\n'),
    );
    expect(canonicalString(vectorB).split('\n').slice(0, 3)).toEqual([
      'post',
      '/payments-callback',
      'host:beta.api.averspay.kg&x-api-timestamp:1776424627146',
    ]);
  });

  it('verifies the production sample with the production key only', () => {
    expect(verifyCanonical(canonicalString(vectorA), signatureA, prod)).toBe(true);
    expect(verifyCanonical(canonicalString(vectorA), signatureA, beta)).toBe(false);
  });

  it('verifies the beta sample with the beta key only', () => {
    expect(verifyCanonical(canonicalString(vectorB), signatureB, beta)).toBe(true);
    expect(verifyCanonical(canonicalString(vectorB), signatureB, prod)).toBe(false);
  });

  it('rejects a changed amount, a reordered nested object, another host and a mangled signature', () => {
    const body = vectorA.body ?? {};
    const fields = body.fields as Record<string, unknown>;
    const cases: CanonicalRequest[] = [
      { ...vectorA, body: { ...body, amount: 2 } },
      { ...vectorA, body: { ...body, fields: { paymentId: fields.paymentId, ...fields } } },
      { ...vectorA, host: 'api.bom-beauty.com' },
      { ...vectorA, path: '/v1/webhooks/finik' },
    ];
    for (const request of cases)
      expect(verifyCanonical(canonicalString(request), signatureA, prod)).toBe(false);
    expect(verifyCanonical(canonicalString(vectorA), 'not-a-signature', prod)).toBe(false);
  });

  it('ignores the order of top-level keys', () => {
    const reversed = { ...vectorA, body: Object.fromEntries(Object.entries(vectorA.body ?? {}).reverse()) };
    expect(verifyCanonical(canonicalString(reversed), signatureA, prod)).toBe(true);
  });
});

describe('Finik signer: our requests', () => {
  it('signs the create-payment request in Finik’s format', () => {
    const data = canonicalString({
      method: 'POST',
      path: '/v1/payment',
      host: 'api.acquiring.averspay.kg',
      headers: { 'x-api-timestamp': '1792652400000', 'x-api-key': 'KEY' },
      body: {
        RedirectUrl: 'https://bom-beauty.com/pay/abc',
        PaymentId: 'p',
        Lang: 'ru',
        Data: { accountId: 'acc', name_en: 'Bom Beauty' },
        CardType: 'FINIK_QR',
        Amount: 5900,
      },
    });
    expect(data).toBe(
      [
        'post',
        '/v1/payment',
        'host:api.acquiring.averspay.kg&x-api-key:KEY&x-api-timestamp:1792652400000',
        '{"Amount":5900,"CardType":"FINIK_QR","Data":{"accountId":"acc","name_en":"Bom Beauty"},"Lang":"ru","PaymentId":"p","RedirectUrl":"https://bom-beauty.com/pay/abc"}',
      ].join('\n'),
    );
  });

  it('round-trips with PKCS#1 and PKCS#8 keys', () => {
    for (const type of ['pkcs1', 'pkcs8'] as const) {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pem = privateKey.export({ type, format: 'pem' });
      const data = canonicalString({ ...vectorA, body: { b: 1, a: { d: 1, c: 2 } } });
      expect(verifyCanonical(data, signCanonical(data, createPrivateKey(pem)), publicKey)).toBe(true);
    }
  });

  it('sorts only the top level', () => {
    expect(JSON.stringify(sortTopLevel({ b: 1, a: { d: 1, c: 2 } }))).toBe('{"a":{"d":1,"c":2},"b":1}');
  });
});
