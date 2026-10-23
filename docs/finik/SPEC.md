# Online payment with Finik (M9)

Status: implemented in M9 (2026-10-23) as §0 describes; the project docs (`ARCHITECTURE.md` §7.9, `DATA-MODEL.md`,
`API.md`, `DEPLOY.md`) now describe the built feature and win over the later sections of this spec, which keep the
research and the original plan (`/payment/[id]`, `GET /payments/:id` and retry were replaced by `/pay/<token>`).
Go-live steps: `DEPLOY.md` §2.4, §3.

Original status: spec, 2026-10-22. Researched from Finik's developer documentation (sources in §2.11) and checked by
hand:

- the request signature was re-implemented with `node:crypto` and verified against **both** signed webhook samples
  that Finik publishes (one signed with the production key, one with the beta key), §2.8;
- Node 24 `fetch(..., { redirect: 'manual' })` returns the `302` with a readable `Location` header;
- Finik's beta endpoint answers a wrong API key with API Gateway's `403 {"message":"Forbidden"}`, not the documented
  error shape.

Read together with `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md` and `docs/API.md`. For the payment feature
this spec wins where they disagree; §9 lists the doc updates that bring them in line.

## 0. Final decisions (2026-10-23)

Agreed with the developer after this spec was written. **Where a later section disagrees, this list wins.**

1. **One payment page per order:** `/pay/<token>` on the site. The token is a random 128-bit URL-safe string stored on
   the order and never derived from the order id.
   - The page shows the order lines, the total, any adjustment and the state.
   - «Оплатить» creates a Finik payment for the **current** amount due, or reuses a live attempt with the same amount,
     then redirects to Finik.
   - Finik's `RedirectUrl` is `/pay/<token>?from=finik`, where the page polls until the webhook lands.
   - This replaces `/payment/[id]` and `GET /payments/:id`.
   - The online order sheet still redirects straight to Finik: `POST /orders` creates the first attempt. If Finik fails,
     it falls back to `/pay/<token>`.
2. **Telegram, one message per situation.** Every message that concerns the customer ends with the WhatsApp text the
   button will send (a `<blockquote>` preview) and has two inline URL buttons: the `wa.me/<customer>?text=…` button
   and «Открыть в админке».
   - WhatsApp order, when online payment is on: at creation, «не оплачен», with the payment link text and
     «💬 Отправить ссылку на оплату».
   - Any order paid: «✅ оплачен», with a delivery text and «💬 Написать о доставке». The text uses the Kyrgyzstan
     template when the customer's phone is +996, otherwise the abroad template.
   - Online order still unpaid after the link expired: «⏰ не оплачен», with the link text and «💬 Отправить ссылку».
   - Rare review alerts: double payment, a different amount, a cancelled order, a deleted order.
   - The admin's connection check paid.
   - Online orders get **no** message at creation. WhatsApp orders with online payment off keep today's message.
3. **No country field in the form:** Kyrgyzstan versus abroad comes from the phone's country code.
4. **WhatsApp texts are editable** in «Настройки → Оплата»: three templates (link, paid in Kyrgyzstan, paid abroad)
   with the placeholders `{имя}`, `{заказ}`, `{сумма}`, `{адрес}` and `{ссылка}`. The defaults live in
   `packages/shared/src/whatsapp.ts`; delivery times are written into the abroad template.
5. **Adjustment instead of order editing:** while an order is unpaid, the admin can set a signed adjustment in сом
   with a short note (delivery, discount, an added item). Amount due = `totalKgs + adjustmentKgs`, which must be > 0.
   The pay page shows the adjustment as its own line. An attempt created for an older amount is never reused.
6. **Order sheet stays compact.**
   - A two-option segmented control «Онлайн» / «WhatsApp» with one caption line under it.
   - While online is selected, a hint under the phone field: «Номер с WhatsApp: сюда напишем об оплате и доставке».
   - The button reads «Оплатить 5 900 сом».
   - Nothing changes when online payment is off.
7. **Scope:**
   - Visa wording toggle: yes.
   - Online-KKM: no.
   - Beta credentials: no (mock mode for development, a 1 сом live check before launch).
   - The cart stays products only (D21); combining a program and products in one order is a later change.
8. **Error codes:** `payment_unavailable` (409, online payment off or not configured) and `payment_failed` (502,
   Finik refused or did not answer).

## 1. What changes

**Today** (ARCHITECTURE §1, §7.1): order sheet → WhatsApp opens with a prefilled message and the order is recorded →
Нурайым sends bank details in WhatsApp → 100% prepayment → shipping. No online payment.

**After M9:**

- When the owner has switched online payment on, the order sheet (cart and direct program mode) asks how to pay:
  «Онлайн-оплата» (Finik: QR code or any Kyrgyz banking app, Visa when enabled for the account) or «Через WhatsApp»
  (today's flow, unchanged).
- Online: the API stores the order, creates a Finik payment for the **server-computed total in сом** and returns
  Finik's payment page URL; the browser goes there in the same tab. After paying, Finik sends the customer back to
  `/payment/{paymentId}` on the site, which shows the state by polling the API. The order becomes «Оплачен» only when
  Finik's **signed webhook** arrives: the webhook is the source of truth, never the redirect.
- Нурайым gets a Telegram message when an online order is paid (and once if it stays unpaid), sees the payment state
  in «Заказы», can mark any order paid, unpaid or refunded by hand (bank transfers from WhatsApp orders included),
  and controls online payment in «Настройки → Оплата».
- With online payment off (the default after deploy) or not configured on the server, the site behaves exactly as
  today, byte for byte in the order sheet.

**Out of scope:** refunds through an API (none is documented; refunds happen in Finik's cabinet and the admin only
records them), saved cards, Finik's mobile SDKs, charging in other currencies (FINIK_QR accepts KGS only), delivery
fees and fiscal receipts (owner decisions, §11), `additionalData` / `currencies` / `support` / images on Finik's page
(possible later, §2.5).

## 2. Finik Web SDK: verified reference

### 2.1 Environments

|                        | Beta (no real money)                     | Production                          |
| ---------------------- | ---------------------------------------- | ----------------------------------- |
| API base               | `https://beta.api.acquiring.averspay.kg` | `https://api.acquiring.averspay.kg` |
| Create payment         | `POST {base}/v1/payment`                 | `POST {base}/v1/payment`            |
| Payment page host seen | `beta.qr.finik.kg`                       | `qr.finik.kg` (seen 2026-10-23)     |
| Webhook verification   | beta public key (§2.7)                   | production public key (§2.7)        |
| Signed with            | our private key                          | our private key                     |

API keys are issued per environment: a beta key in production (or the reverse) gets `403 {"message":"Forbidden"}`
from API Gateway. The API sits behind AWS API Gateway + CloudFront.

### 2.2 Credentials and onboarding

1. **RSA key pair** (we generate it, 2048 bits):

   ```sh
   openssl genrsa -out finik_private.pem 2048
   openssl rsa -in finik_private.pem -pubout > finik_public.pem
   ```

   The private key lives only in the server `.env` (as base64, §5.2) and the developer's password manager: never in
   the repo, the admin, logs or chats. OpenSSL 3 writes PKCS#8 (`BEGIN PRIVATE KEY`), older versions PKCS#1
   (`BEGIN RSA PRIVATE KEY`); `crypto.createPrivateKey` reads both (verified).

   Done on 2026-10-22: the real pair sits in `finik/` at the repo root for now (ignored by git as `/finik/` and by
   Docker in `.dockerignore`). Public key SHA-256 fingerprint (DER):
   `368eeddfcd56820ee46e6e1f89b1e851e850f74fb9a08c9d0905d64ee2a96e17`. The folder is temporary: the private key moves
   to the password manager, then the folder is deleted. Implementation work never opens, prints, copies or commits
   anything from it; tests generate their own keys.

2. **API key** (`x-api-key`): Finik cabinet (finik.kg → «Войти») → «Ключи» → «Сгенерировать ключ»:
   - «Пользователь»: the owner;
   - «Название клиента»: legal name and brand, e.g. «ИП Бекиева Н. (Bom Beauty)»;
   - «Тип клиента»: «Веб-клиент»;
   - «Публичный ключ»: upload `finik_public.pem`;
   - «QuickPay ключ», «QuickPay ID», «Callback URL»: leave empty (Finik's own guide says so; every payment carries
     its webhook URL);
   - «Создать». The key shows up in «Ключи»; the «Фильтр» there shows which account it belongs to.

3. **Account ID** (`Data.accountId`): the Finik account that receives the money (cabinet → «Счета»).
4. **Beta credentials (optional)**: the cabinet issues production keys. The developer may ask Finik support directly
   for a beta API key and account (§11); the owner is not asked for them. Without beta, test with mock mode, then
   with a 1 сом payment in production while the site switch is still off (§10).

Pricing (Finik's site, 2026-10-22): connecting is free; the standard fee is 4% per successful payment, taken at once
as a separate transaction; withdrawals to any bank are free; Visa is accepted, MasterCard not yet. Online-KKM
(fiscal receipts sent to the tax service) costs 600 сом a month on top, works only together with Finik payments, and
is switched on in Finik's app or cabinet: it needs no code on our side.

Finik support: finik@quickpay.kg, WhatsApp +996 995 901 109, Telegram @finik_pay.

**Live check, 2026-10-23.** With the owner's production API key and account ID, and our private key, one signed
request built exactly as in §2.3 and §2.5 (1 сом, `endDate` +10 minutes) got `302` in 1.3 s:

- **Path:** `/v1/payment` is right. The cabinet shows `https://api.acquiring.averspay.kg/payment` as the key's URL;
  ignore that path.
- **The `302` response:** it has `content-type: application/json`, and its `Location` looks like
  `https://qr.finik.kg/<uuid>?type=t&paymentId=<n>_<our PaymentId>&failure_redirect_url=https://api.acquiring.averspay.kg/v1/redirect?…&status=failed&lang=ru`.
- **What the page shows:**
  - «ИП Нурайым Бекиева», then `name_en`, the amount, the description, «Количество» and «Дата окончания» (`endDate`);
  - «Выберите способ оплаты» with two tabs: «Приложение» (about 20 Kyrgyz bank apps: MBANK, Optima24, О!Деньги,
    Bakai, DemirBank, KICB, Элдик, Компаньон, MegaPay…) and «QR»;
  - Finik's own support phones, which `Data.support` could replace with the shop's WhatsApp later.
- **No card option yet:** Visa is not enabled on her account.
- **Failure redirect:** the `failure_redirect_url` means Finik also sends customers back after a failed or cancelled
  payment, so `/payment/{id}` must never assume success and must rely only on our own status.

### 2.3 Signing a request

Every call to Finik carries these headers (names in lower case):

| Header            | Value                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| `content-type`    | `application/json`                                                            |
| `x-api-key`       | the API key                                                                   |
| `x-api-timestamp` | `Date.now().toString()` (UNIX ms), the same value as in the signature         |
| `signature`       | Base64 of RSA-SHA256 (PKCS#1 v1.5) over the canonical string, our private key |

`Host` is set by `fetch` from the URL and is part of the signature, so the URL host and the signed host must match.

Canonical string: these parts joined with `\n`:

```
post                                   lower-case HTTP method
/v1/payment                            decodeURI(path), no query string
host:<Host>&x-api-key:<key>&x-api-timestamp:<ts>
<query>                                only when the request has query parameters; omitted otherwise (no empty line)
{"Amount":5900,...}                    JSON.stringify(body with its TOP-LEVEL keys sorted)
```

Rules, taken from Finik's reference implementation (`@mancho.devs/authorizer` 2.12.8) and their PHP port:

- **Headers part**: `host:` + Host first, then every header whose name starts with `x-api-` (case-insensitive),
  names lower-cased, sorted by name, as `name:value`, all joined with `&`. Nothing else is signed.
- **Query part**: keys sorted; `encodeURI(decodeURI(key)) + '=' + encodeURI(decodeURI(value ?? ''))`, joined with `&`.
  We never send a query.
- **Body**: sort **only the top-level keys**, with `localeCompare`; nested objects keep their key order. A deep sort
  breaks the signature, which Finik names as the most common cause of `401`. No body → empty string.
- Send exactly the JSON string you signed as the request body.
- Sign right before sending and **re-sign on every attempt**: the timestamp is checked (Finik's Payments Gateway docs
  say it is valid for 10 seconds; the Web SDK docs do not say, so assume the same).

Reference implementation (verified against §2.8; adapt names and placement to the repo):

```ts
import { sign, verify, type KeyObject } from 'node:crypto';

export interface CanonicalRequest {
  method: string;
  /** Path without the query string: "/v1/payment", "/v1/webhooks/finik". */
  path: string;
  /** Host header value exactly as sent or received. */
  host: string;
  /** Request headers; only names starting with "x-api-" are used. */
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | undefined> | null;
  body: Record<string, unknown> | null;
}

/** Top-level keys sorted like Finik's signer; nested objects keep their order. */
export function sortTopLevel(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b, 'en')));
}

export function canonicalString(request: CanonicalRequest): string {
  const apiHeaders = Object.keys(request.headers)
    .filter((name) => name.toLowerCase().startsWith('x-api-'))
    .sort()
    .map((name) => {
      const value = request.headers[name];
      if (typeof value !== 'string') throw new Error(`Header ${name} has no single value`);
      return `${name.toLowerCase()}:${value}`;
    });
  const query = Object.keys(request.query ?? {})
    .sort()
    .map((key) => `${encodeURI(decodeURI(key))}=${encodeURI(decodeURI(request.query?.[key] ?? ''))}`)
    .join('&');
  return [
    request.method.toLowerCase(),
    decodeURI(request.path),
    [`host:${request.host}`, ...apiHeaders].join('&'),
    ...(query ? [query] : []),
    request.body ? JSON.stringify(sortTopLevel(request.body)) : '',
  ].join('\n');
}

export const signCanonical = (data: string, privateKey: KeyObject): string =>
  sign('sha256', Buffer.from(data, 'utf8'), privateKey).toString('base64');

export function verifyCanonical(data: string, signature: string, publicKey: KeyObject): boolean {
  try {
    return verify('sha256', Buffer.from(data, 'utf8'), publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
```

### 2.4 Why not the npm package

`@mancho.devs/authorizer` 2.12.8 (the package Finik's docs install) calls `console.log('request data:', requestData)`
in its constructor (that prints the API key and the whole body) and logs the canonical string on every `sign` and
`verify`. It also pulls in `node-jose` and carries a custom "Mancho" licence. The logging alone breaks CLAUDE.md's
rule. The ~50 lines above produce the same bytes (§2.8) with no new dependency. Do **not** add the package.

### 2.5 Create a payment

`POST {base}/v1/payment`, signed as in §2.3.

Request body (documented):

| Field                 | Type   | Req. | Notes                                                                                        |
| --------------------- | ------ | ---- | -------------------------------------------------------------------------------------------- |
| `Amount`              | Number | no   | Fixed amount; without it the customer types any amount. We always send it. > 0, ≤ 2 decimals |
| `CardType`            | String | yes  | Always `FINIK_QR`                                                                            |
| `PaymentId`           | String | yes  | Unique, ≤ 36 characters; "prevents duplicate payments". Our `payments.id` (UUIDv7)           |
| `RedirectUrl`         | String | yes  | Where Finik sends the customer **after a successful payment**                                |
| `Lang`                | String | no   | `ky`, `ru` (default), `en`. We send `ru`                                                     |
| `Data.accountId`      | String | yes  | Account that receives the money                                                              |
| `Data.name_en`        | String | yes  | Name of the QR shown to the customer. We send the shop name (`settings.shop.name`)           |
| `Data.webhookUrl`     | String | yes  | Our webhook endpoint                                                                         |
| `Data.description`    | String | no   | Shown on the payment page and echoed in the webhook: `Заказ №1042`                           |
| `Data.startDate`      | Number | no   | QR valid from (ms). Not sent (clock skew could make a fresh QR "not yet valid")              |
| `Data.endDate`        | Number | no   | QR valid until (ms). We send `expiresAt` (§5.5)                                              |
| `Data.additionalData` | Array  | no   | Up to 20 `{ fieldId, name, isHidden?, value? }`; without `value` the customer fills a form   |
| `Data.currencies`     | Array  | no   | Up to 6 `{ currency, amount }` shown for reference only                                      |
| `Data.support`        | Array  | no   | Up to 4 `{ phone, operator: BEELINE \| MEGA \| O \| WHATSAPP, enabled? }`                    |

Not sent in M9: `startDate`, `additionalData`, `currencies`, `support`, `Currency`, `CustomerIp`, `Data.images`,
`Data.merchantCategoryCode`. `Currency`, `CustomerIp` and `Data.images` appear only in Finik's error tables,
`merchantCategoryCode` only in a PHP sample, and Finik's own playground sends none of them.

What we send (top level sorted, `Data` in insertion order):

```json
{
  "Amount": 5900,
  "CardType": "FINIK_QR",
  "Data": {
    "accountId": "<FINIK_ACCOUNT_ID>",
    "name_en": "Bom Beauty",
    "webhookUrl": "https://api.bom-beauty.com/v1/webhooks/finik",
    "description": "Заказ №1042",
    "endDate": 1792656000000
  },
  "Lang": "ru",
  "PaymentId": "0199f1c2-5d3e-7a10-9b2c-3d4e5f607182",
  "RedirectUrl": "https://bom-beauty.com/payment/0199f1c2-5d3e-7a10-9b2c-3d4e5f607182"
}
```

Call it with `fetch(url, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10_000), ... })`. With
redirects followed, the client would download the payment page's HTML instead of reading its address.

Responses:

| Response                                                                          | Meaning                                                                                        | Handling                            |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| `302` + `Location`                                                                | Success; `Location` is the payment page                                                        | `url = Location`                    |
| `201`/`200` JSON `{ paymentId, paymentUrl, status }`                              | Success in the newer format (Finik's Python sample says the API may switch to it)              | `url = body.paymentUrl`             |
| `400` `{ "StatusCode" or "statusCode": 400, "ErrorMessage" }`                     | Validation, e.g. "A valid UNIX timestamp must be provided in the header", "An invalid amount…" | attempt `failed`, error kept        |
| `401` `{ "statusCode": 401, "ErrorMessage": "An invalid signature is provided" }` | Signature, key or body mismatch                                                                | `failed`, error log                 |
| `403` `{ "message": "Forbidden" }`                                                | Wrong or missing API key, or a key from the other environment (seen on beta)                   | `failed`, error log                 |
| `502`, other `5xx`                                                                | Acquirer or gateway failure                                                                    | `failed`                            |
| network error, no answer in 10 s                                                  | Unknown whether Finik created it                                                               | `failed` (a retry is a new attempt) |

Accept only an `https:` URL from `Location` or `paymentUrl`; anything else is a failure. Log the host of the URL, never
the full URL (it is a bearer link).

Documented validation messages worth recognising: "Payment ID must be less than or equal to 36 characters long", "An
invalid amount is provided. Amount must be greater than 0", "An unrecognizable card type is provided", "RedirectUrl is
required", "\"FINIK_QR\" payment method currently does not support {Currency} currency" (KGS only), "Account ID is
required in the payment data", "Item name is required in the payment data", "End Date invalid in the payment data",
"Account status must be \"Enabled\"", "The fixedAmount must be a greater than or equal to 0.01".

### 2.6 Webhook

- Finik POSTs to `Data.webhookUrl` after a **successful** payment ("If the payment fails, no webhook is sent"). Finik's
  older callback document also lists status `FAILED`, so handle it anyway.
- **At least once.** Without a `200` Finik retries: the first 5 attempts every 30 s, then a delay doubling from 60 s up
  to 24 h, then daily. Deliveries are signed when sent: in the production sample of §2.8 the `x-api-timestamp` is 18
  hours after `transactionDate`, so a late retry still passes a 5-minute freshness window.
- Headers: `signature`, `x-api-timestamp`, `content-type: application/json`, `Host` = the webhook URL's host. The
  samples have no `x-api-key`.
- Payload: documented fields plus those seen in Finik's signed samples:

| Field                                                                    | Notes                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                     | Finik operation id, e.g. `320259584_aaa76e79-…_DEBIT`. Unique per payment operation and, being the operation id, the same on every retry: **our deduplication key**                |
| `transactionId`                                                          | Docs suggest it for deduplication, but in the production sample it **equals our PaymentId** and in the beta sample it is the QR transaction id. Store it; no unique index on it    |
| `status`                                                                 | `success`, `succeeded`, `SUCCEEDED`: compare case-insensitively. `success`/`succeeded` = paid; `failed` = failed; anything else is ignored                                         |
| `amount`                                                                 | Paid amount (сом, number, may have decimals)                                                                                                                                       |
| `fields.paymentId`                                                       | The `PaymentId` we sent: **how we find our payment**. Fall back to `transactionId` when it is missing                                                                              |
| `fields.*`                                                               | Payment form fields: `amount`, `name`, `qrTransactionId`, `success_redirect_url`, `url`, … `fields.name` may hold the payer's name or phone: personal data, never logged or stored |
| `data`                                                                   | Echo of our `Data` (`accountId`, `description`, `webhookUrl`, `name_en`)                                                                                                           |
| `requestDate`, `transactionDate`                                         | UNIX ms                                                                                                                                                                            |
| `receiptNumber`                                                          | Receipt number, keep it                                                                                                                                                            |
| `transactionType`, `accountId`, `clientId`, `deviceId`, `item.id`, `net` | Optional, seen in samples or the older document                                                                                                                                    |
| `service.id`                                                             | `VISA` when the merchant has card acceptance                                                                                                                                       |

- **Verification**: build the canonical string of the incoming request with §2.3: method `post`; path and host of our
  webhook URL **as Finik called it** (`FINIK_WEBHOOK_URL`; also try the request's own `Host` header and path, and
  accept if either verifies); every `x-api-*` header of the request; no query; the body parsed with `JSON.parse` from
  the raw bytes and sorted at the top level. Verify the `signature` header with Finik's public key for the configured
  environment. Then require `|now − x-api-timestamp| ≤ 5 minutes` (Finik's recommendation).
- **Never run the body through zod or a DTO before verifying**: zod rebuilds objects in schema order and drops unknown
  keys, so the canonical string changes. Validate the shape only after the signature checks out.
- Answer `200` quickly; Finik reads only the status code.

### 2.7 Finik public keys (webhook verification)

Production:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF/PUmhMPPidcMxhZBPb
BSGJoSphmCI+h6ru8fG8guAlcPMVlhs+ThTjw2LHABvciwtpj51ebJ4EqhlySPyT
hqSfXI6Jp5dPGJNDguxfocohaz98wvT+WAF86DEglZ8dEsfoumojFUy5sTOBdHEu
g94B4BbrJvjmBa1YIx9Azse4HFlWhzZoYPgyQpArhokeHOHIN2QFzJqeriANO+wV
aUMta2AhRVZHbfyJ36XPhGO6A5FYQWgjzkI65cxZs5LaNFmRx6pjnhjIeVKKgF99
4OoYCzhuR9QmWkPl7tL4Kd68qa/xHLz0Psnuhm0CStWOYUu3J7ZpzRK8GoEXRcr8
tQIDAQAB
-----END PUBLIC KEY-----
```

Beta:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwlrlKz/8gLWd1ARWGA/8
o3a3Qy8G+hPifyqiPosiTY6nCHovANMIJXk6DH4qAqqZeLu8pLGxudkPbv8dSyG7
F9PZEAryMPzjoB/9P/F6g0W46K/FHDtwTM3YIVvstbEbL19m8yddv/xCT9JPPJTb
LsSTVZq5zCqvKzpupwlGS3Q3oPyLAYe+ZUn4Bx2J1WQrBu3b08fNaR3E8pAkCK27
JqFnP0eFfa817VCtyVKcFHb5ij/D0eUP519Qr/pgn+gsoG63W4pPHN/pKwQUUiAy
uLSHqL5S2yu1dffyMcMVi9E/Q2HCTcez5OvOllgOtkNYHSv9pnrMRuws3u87+hNT
ZwIDAQAB
-----END PUBLIC KEY-----
```

They are public; commit them as constants (e.g. `backend/src/payments/finik/finik-keys.ts`).

### 2.8 Test vectors (Finik's published signed webhooks)

Both verify with the §2.3 implementation and the stated key; both fail with the other key. Use them as unit tests.
Their timestamps are old, so keep the freshness check out of the pure verify function (or inject the clock).

**Vector A: production key.** `POST /finik-callback`, headers `Content-Type: application/json`, `Host: huntpro.kg`,
`x-api-timestamp: 1781763261255`, no query. Body (key order as published):

```json
{
  "fields": {
    "amount": 1,
    "webhook_url": "https://huntpro.kg/finik-callback",
    "paymentId": "141fc797-0366-480e-8ba7-2982632b2b2c",
    "success_redirect_url": "https://api.acquiring.averspay.kg/v1/redirect?paymentId=141fc797-0366-480e-8ba7-2982632b2b2c&clientId=1295102413&status=succeeded",
    "name": "HuntPro",
    "qrTransactionId": "aaa76e79-f808-4ac5-b88e-76a9b4055832"
  },
  "amount": 1,
  "transactionDate": 1781697937466,
  "clientId": "25c1aabe-fc4a-4968-85d9-90600466e9a5",
  "id": "320259584_aaa76e79-f808-4ac5-b88e-76a9b4055832_DEBIT",
  "status": "succeeded",
  "transactionId": "141fc797-0366-480e-8ba7-2982632b2b2c",
  "data": {
    "accountId": "8d4e1d11-e50c-4278-a5e2-4e55de196c6a",
    "description": "Order 2606",
    "webhookUrl": "https://huntpro.kg/finik-callback",
    "name_en": "HuntPro"
  }
}
```

Signature:

```
jS1a8HW4BTIea8iCmoW/EF7FXUA0JSsHe/kSRBfCYdxFwvyrMe0SOfU9pAKzOOO0bIsa9FW+WqAzqxExHjcscmG8k/vwgB+dCMcM04K91vTL6eZAVOE/Hcx2iALNZnG6UVnP/jnUt8MjK+xwBhamwFktxdUovf+cVFZ2io10RAT1pOEIHtZceXbQeg7XlhcPuTAKmOuF1B4gGoksRtGglGwwyvYaa9ml8OPMP3uoCaauYqT0aUKLTNsJdFfO0Q3Dvsy9uyWvuVa5t6adbIm+SHlbz9VGSZ2xrwgETUBVj86dfA3oiAgERLKhQTBSMTxRYlUKhPVHGfR3kjAhD3g4JQ==
```

Expected canonical string (four lines; the last is one long line):

```
post
/finik-callback
host:huntpro.kg&x-api-timestamp:1781763261255
{"amount":1,"clientId":"25c1aabe-fc4a-4968-85d9-90600466e9a5","data":{"accountId":"8d4e1d11-e50c-4278-a5e2-4e55de196c6a","description":"Order 2606","webhookUrl":"https://huntpro.kg/finik-callback","name_en":"HuntPro"},"fields":{"amount":1,"webhook_url":"https://huntpro.kg/finik-callback","paymentId":"141fc797-0366-480e-8ba7-2982632b2b2c","success_redirect_url":"https://api.acquiring.averspay.kg/v1/redirect?paymentId=141fc797-0366-480e-8ba7-2982632b2b2c&clientId=1295102413&status=succeeded","name":"HuntPro","qrTransactionId":"aaa76e79-f808-4ac5-b88e-76a9b4055832"},"id":"320259584_aaa76e79-f808-4ac5-b88e-76a9b4055832_DEBIT","status":"succeeded","transactionDate":1781697937466,"transactionId":"141fc797-0366-480e-8ba7-2982632b2b2c"}
```

**Vector B: beta key.** `POST /payments-callback`, headers `Content-Type: application/json`,
`Host: beta.api.averspay.kg`, `x-api-timestamp: 1776424627146`, no query. Body:

```json
{
  "id": "3601266827_deb2bb99-843d-4dbe-8278-378e5d5cbee8_DEBIT",
  "accountId": "5ec90dc6-e89d-424e-b3ca-48d1e5adb542",
  "amount": 1,
  "clientId": "79ba7a09-3365-4c5a-b0b4-10905e368698",
  "deviceId": "060354a4-f82b-440d-8eed-868699e13218",
  "fields": {
    "transactionType": "20",
    "amount": 1,
    "paymentId": "1241932578574150354",
    "success_redirect_url": "https://beta.api.acquiring.averspay.kg/v1/redirect?paymentId=1241932578574150354&clientId=3551560937&status=succeeded",
    "qrComment": "",
    "name": "79366240695",
    "qrTransactionId": "deb2bb99-843d-4dbe-8278-378e5d5cbee8",
    "url": "https://beta.qr.finik.kg/#00020101021232810011qr.finik.kg0114averspay-items1032509149e544bf4a31ab4974b21e5cc2e712021213021252044829530341754031005908Finik-QR63047de4"
  },
  "receiptNumber": "291831989813",
  "requestDate": 1776424624350,
  "status": "SUCCEEDED",
  "transactionDate": 1776424624711,
  "transactionId": "deb2bb99-843d-4dbe-8278-378e5d5cbee8",
  "transactionType": "DEBIT",
  "item": { "id": "999248699_1241932578574150354" }
}
```

Signature:

```
ZPqSA5LWRsw4nFNP0iOuUETggqP0joatjpWuQ1th52u2lf0jWj045Y4b1K0N0uGiqtnteMDmaXsXjRlWjb29lgjuICLs2zmUjwYUgGJZR+4cGFi8N0FfmXPBJUcxDExSRmclUngUzsKTQYyzmhq7fXsAqG+/NzB2QKqEOb5FCtS8Q1iDMPP3RldcbD9v2E154safALwCbMWEVcriSB1YnPY9yshlQZHTSoI9un5IRFMsgfjRlPBPU2E9AEffKEmlzNzuuruzHXuUw2E1Nu9SyEnwl6os1Ytfpgy5AD6OXKKE6pcjF3MigYe1vW/+dMZ0ZggGCPCqYSV5i1Q8SVzciA==
```

Expected canonical string:

```
post
/payments-callback
host:beta.api.averspay.kg&x-api-timestamp:1776424627146
{"accountId":"5ec90dc6-e89d-424e-b3ca-48d1e5adb542","amount":1,"clientId":"79ba7a09-3365-4c5a-b0b4-10905e368698","deviceId":"060354a4-f82b-440d-8eed-868699e13218","fields":{"transactionType":"20","amount":1,"paymentId":"1241932578574150354","success_redirect_url":"https://beta.api.acquiring.averspay.kg/v1/redirect?paymentId=1241932578574150354&clientId=3551560937&status=succeeded","qrComment":"","name":"79366240695","qrTransactionId":"deb2bb99-843d-4dbe-8278-378e5d5cbee8","url":"https://beta.qr.finik.kg/#00020101021232810011qr.finik.kg0114averspay-items1032509149e544bf4a31ab4974b21e5cc2e712021213021252044829530341754031005908Finik-QR63047de4"},"id":"3601266827_deb2bb99-843d-4dbe-8278-378e5d5cbee8_DEBIT","item":{"id":"999248699_1241932578574150354"},"receiptNumber":"291831989813","requestDate":1776424624350,"status":"SUCCEEDED","transactionDate":1776424624711,"transactionId":"deb2bb99-843d-4dbe-8278-378e5d5cbee8","transactionType":"DEBIT"}
```

Negative cases that must fail: amount changed to 2; a nested key order changed (e.g. `fields.paymentId` moved
first); a different host or path; the other environment's key. Changing only the **top-level** key order must still
verify.

### 2.9 Testing against beta

- With beta credentials, the create call returns a `beta.qr.finik.kg/#…` link.
- To "pay" it without a bank app: Finik docs → Playground (`https://www.finik.kg/documentation/web-sdk/playground/`) →
  «Try a payment»: paste the `beta.qr.finik.kg` link and press pay. Finik then sends the webhook to `Data.webhookUrl`,
  which must be public HTTPS: in development use a tunnel (`cloudflared tunnel --url http://localhost:4000`) and set
  `FINIK_WEBHOOK_URL` to it.
- The same Playground's «Test Create Payment API» form signs in the browser with your key: a quick way to check
  credentials without our code (use a throwaway browser profile; it stores the key in `localStorage`).

### 2.10 Things Finik does not document

No status-check endpoint for acquiring payments (the Payments Gateway product has `GET /v2/payments/{id}`, a different
API and host: do not call it); no refund API; unknown whether a FINIK_QR link can be paid twice before `endDate`, and
what a repeated `PaymentId` returns. The design below survives all of these (§5.7), and §11 lists the questions for
Finik.

### 2.11 Sources

- https://www.finik.kg/for-developers/ and https://www.finik.kg/documentation/web-sdk/ (getting started)
- https://www.finik.kg/documentation/web-sdk/integration/ (keys, signing, create payment, errors; the Python, PHP and
  "other languages" tabs live in the page's JavaScript bundle, not in its HTML)
- https://www.finik.kg/documentation/web-sdk/webhooks/ (payload, retries, verification samples)
- https://www.finik.kg/documentation/web-sdk/reference/ (endpoints, common errors, public keys, FAQ)
- https://www.finik.kg/documentation/web-sdk/playground/ (beta tester)
- https://quip.com/fyLzAt6TDMtH ("Finik Payments Status Webhook (Callback)", the older callback document)
- https://www.npmjs.com/package/@mancho.devs/authorizer (2.12.8, reference signer)
- Finik's Telegram guides: https://t.me/finik_pay/85 (API keys), https://t.me/finik_pay/108 (account for ИП)

## 3. Decisions (add to ARCHITECTURE §15)

| #   | Decision                                                                                                                                                                                                                                                      | Why                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| D28 | Online payment through Finik's Web SDK (hosted payment page, `FINIK_QR`, KGS only) **next to** the WhatsApp flow. The owner switches it on in «Настройки → Оплата»; it is off by default and hidden while the server has no Finik keys                        | Kyrgyz banking apps pay by QR; customers abroad still need WhatsApp and bank details                      |
| D29 | Finik's signed webhook is the only proof of payment. The redirect back shows `/payment/{id}`, which polls our API; no status-check API exists for acquiring                                                                                                   | Finik's docs: "the webhook is the source of truth"; the redirect URL can be opened by anyone              |
| D30 | Own RSA-SHA256 signer on `node:crypto`, not `@mancho.devs/authorizer`                                                                                                                                                                                         | The package `console.log`s the API key and request bodies; verified byte-for-byte against Finik's samples |
| D31 | Payment state lives beside fulfilment: `orders.payment_status` (`unpaid`, `pending`, `paid`, `refunded`) next to `status` (`new`, `sent`, `cancelled`); attempts in `payments`, verified webhooks in `payment_events`, deduplicated by Finik's operation `id` | An order can be paid and not yet sent; the two lifecycles stay simple                                     |
| D32 | The order is stored before the payment exists; every attempt is a new `payments` row whose id is Finik's `PaymentId`; a successful webhook for **any** attempt pays the order, a second one is flagged as a double payment                                    | Retries never reuse a Finik link; no webhook can arrive before its row exists                             |
| D33 | Online orders notify the owner when paid, and once if still unpaid after the link expired; not at creation                                                                                                                                                    | One message per online order instead of two                                                               |
| D34 | The amount is the order's server total in сом; the display currency stays display-only; the pay button names the сом amount (`formatKgs`, not `<Price>`)                                                                                                      | FINIK_QR charges KGS only; the button must say what will be charged                                       |
| D35 | `FINIK_ENV=mock` (development and tests only) replaces Finik with a local payment page that sends a correctly signed webhook                                                                                                                                  | `pnpm dev`, the browser check and e2e need the whole flow without Finik credentials                       |
| D36 | When online payment is on, the site's payment wording gets online variants (programs page "Как это работает", catalog note, order sheet); with it off the design's text stays verbatim                                                                        | The design is silent on online payment (D1)                                                               |

## 4. Data model

### 4.1 Prisma

```prisma
enum PaymentMethod      { whatsapp finik }
enum OrderPaymentStatus { unpaid pending paid refunded }
enum PaymentStatus      { created pending succeeded failed expired }
enum PaymentPurpose     { order check }

model Order {
  // ... existing fields
  paymentMethod    PaymentMethod      @default(whatsapp)  @map("payment_method")
  paymentStatus    OrderPaymentStatus @default(unpaid)    @map("payment_status")
  paidAt           DateTime?          @map("paid_at") @db.Timestamptz(3)
  unpaidNotifiedAt DateTime?          @map("unpaid_notified_at") @db.Timestamptz(3)  // "не оплачен" sent once
  payments         Payment[]

  @@index([paymentStatus, createdAt])
}

/** One attempt to collect money through Finik. `id` is sent to Finik as PaymentId. */
model Payment {
  id              String         @id @default(uuid(7)) @db.Uuid
  orderId         String?        @map("order_id") @db.Uuid
  order           Order?         @relation(fields: [orderId], references: [id], onDelete: SetNull)
  purpose         PaymentPurpose @default(order)        // check = the admin's 1 сом connection test, no order
  provider        String         @default("finik")
  environment     String                                // "mock" | "beta" | "prod" at creation
  status          PaymentStatus  @default(created)
  amountKgs       Int            @map("amount_kgs")
  paymentUrl      String?        @map("payment_url")    // Finik page; a bearer link: never logged
  expiresAt       DateTime       @map("expires_at") @db.Timestamptz(3)  // = Data.endDate
  error           String?                               // short reason: "finik 403", "timeout", "bad url"
  transactionId   String?        @map("transaction_id") // from the webhook; NOT unique (§2.6)
  operationId     String?        @map("operation_id")   // webhook "id"
  receiptNumber   String?        @map("receipt_number")
  paidAmountTyiyn Int?           @map("paid_amount_tyiyn")  // webhook amount × 100 (1 сом = 100 тыйын)
  channel         String?                               // "visa" when the webhook has service.id = "VISA", else "qr"
  paidAt          DateTime?      @map("paid_at") @db.Timestamptz(3)
  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)
  events          PaymentEvent[]

  @@index([orderId, createdAt])
  @@index([status, expiresAt])
  @@map("payments")
}

/** Every verified Finik webhook, once. No personal data. */
model PaymentEvent {
  id         String   @id @default(uuid(7)) @db.Uuid
  paymentId  String?  @map("payment_id") @db.Uuid
  payment    Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  dedupeKey  String   @unique @map("dedupe_key")        // webhook id, else transactionId, else sha256(raw body)
  status     String                                     // as Finik sent it: "SUCCEEDED"
  outcome    String                                     // applied · duplicate_payment · amount_mismatch · paid_cancelled · paid_deleted · check_paid · failed · unknown_payment · ignored
  data       Json                                       // whitelist: id, transactionId, status, amount, requestDate, transactionDate, receiptNumber, transactionType, service.id, item.id, fields.paymentId
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([paymentId])
  @@map("payment_events")
}
```

- Migration via `pnpm db:migrate --name finik_payments`. It is additive (DEPLOY §4): existing orders become
  `payment_method = whatsapp`, `payment_status = unpaid`; old images keep running on the new schema. Add CHECKs in raw
  SQL: `amount_kgs > 0`, `paid_amount_tyiyn >= 0`.
- Deleting an order (privacy request) keeps its payments with `order_id = null`: they hold amounts and Finik ids only.
- Mirror the enums in `packages/shared/src/enums.ts` (`PAYMENT_METHODS`, `ORDER_PAYMENT_STATUSES`, `PAYMENT_STATUSES`);
  the enum parity test covers them. Labels in `packages/shared/src/labels.ts` (§7.3).

### 4.2 Order payment lifecycle

```
WhatsApp order:  unpaid ──(owner: «Оплачен»)──► paid ──(owner: «Возврат»)──► refunded
                   ▲                               │
                   └─────(owner: «Не оплачен»)─────┘

Online order:    pending ──(verified webhook)──► paid ──(owner)──► refunded
                   │  ▲
  link failed or   │  └── retry creates a new attempt
  expired (+10 min)▼
                 unpaid ──(late webhook still pays)──► paid
```

`status` (`new` → `sent` / `cancelled`) is untouched by payments. A late webhook always pays the order, whatever its
attempt or order state (§5.7). Every change writes AuditLog (`entity: "order"`, `action: "payment"`,
`diff: { from, to, source: "finik" | "manual", paymentId? }`, `userId` null for Finik).

### 4.3 Setting `payments` (owner only, DATA-MODEL §3)

```ts
{
  finikEnabled: boolean,                 // show online payment on the site
  defaultMethod: 'finik' | 'whatsapp',   // preselected in the order sheet
  linkTtlMinutes: number,                // 10..1440, Data.endDate = now + this
  visa: boolean,                         // Finik enabled Visa for the account → wording «или карта Visa»
  notifyUnpaid: boolean,                 // Telegram when an online order stays unpaid
}
```

Defaults: `{ finikEnabled: false, defaultMethod: 'finik', linkTtlMinutes: 60, visa: false, notifyUnpaid: true }`.
Public part (`publicSettingsSchema`): `payments: { finik: boolean, defaultMethod, visa }`, where `finik` =
`finikEnabled && Finik configured on the server`. Saving it revalidates the `settings` tag (existing settings code).
Not in `MANAGER_SETTINGS`, so owner only.

The dev seed (demo data only) stores `{ finikEnabled: true, defaultMethod: 'whatsapp' }`, so `pnpm dev` shows the
picker with mock Finik while the existing WhatsApp e2e specs keep their default, plus two demo online orders (one
paid, one waiting for payment) for the admin views. The production seed leaves the defaults (off).

## 5. Backend

### 5.1 Layout

A `payments` module (one Nest module per domain), for example:

```
backend/src/payments/
  finik/finik-keys.ts           Finik public keys (§2.7)
  finik/finik-signer.ts         §2.3, pure functions
  finik/finik-signer.test.ts    §2.8 vectors + round trips
  finik/finik.config.ts         Env → FinikConfig (mode, base URL, host, keys, webhook URL), built once at boot
  finik/finik.client.ts         createPayment() → { url } or a typed failure (§2.5)
  finik/finik.client.test.ts    request shape and response handling, fetch stubbed
  finik/finik-webhook.ts        raw body + headers → verified payload or a rejection reason
  finik/finik-mock.controller.ts  FINIK_ENV=mock only (§5.11)
  payments.service.ts           attempts, retry, webhook application, expiry, public and admin views
  payments.controller.ts        GET /payments/:id, POST /payments/:id/retry
  finik-webhook.controller.ts   POST /webhooks/finik
  admin-payments.controller.ts  admin endpoints (§5.10)
  payments.module.ts            PaymentsModule.forRoot(env), exported PaymentsService
```

`OrdersModule` imports `PaymentsModule`. Register the module in `AppModule.forRoot`. Logic in services, thin
controllers, `select` in every Prisma query.

### 5.2 Environment

Add to `backend/src/config/env.ts`, `infra/.env.example`, `backend/test/env.ts` (off by default) and DEPLOY §2.5:

```sh
# ── Online payment: Finik (M9). Empty FINIK_ENV = online payment off.
# mock: local fake Finik for development and tests (refused in production) · beta: no real money · prod
FINIK_ENV=mock
# x-api-key from the Finik cabinet («Ключи», «Веб-клиент»); beta and prod keys differ
FINIK_API_KEY=
# Finik account that receives the money («Счета»)
FINIK_ACCOUNT_ID=
# Our private key on one line: base64 < finik_private.pem | tr -d '\n'
FINIK_PRIVATE_KEY_BASE64=
# Where Finik sends payment webhooks. Prod: https://api.bom-beauty.com/v1/webhooks/finik; dev: http://localhost:4000/v1/webhooks/finik (mock) or a tunnel (beta)
FINIK_WEBHOOK_URL=http://localhost:4000/v1/webhooks/finik
# Optional: Finik's webhook public key as base64 PEM; empty = the built-in key of FINIK_ENV
FINIK_PUBLIC_KEY_BASE64=
```

Validation (boot fails with a readable message, like the rest of `env.ts`):

- `FINIK_ENV` ∈ `mock | beta | prod`, optional. `mock` is refused when `NODE_ENV=production`.
- `beta`/`prod` need `FINIK_API_KEY`, `FINIK_ACCOUNT_ID`, `FINIK_PRIVATE_KEY_BASE64` and `FINIK_WEBHOOK_URL`; the
  private key must load with `crypto.createPrivateKey`, the optional public key with `createPublicKey`.
- `FINIK_WEBHOOK_URL`: absolute URL without a query string; `https:` required when `NODE_ENV=production`.
- **Configured** = `FINIK_ENV` set and valid. Not configured → online payment is hidden, `paymentMethod: 'finik'` gets
  409, the admin says «Не настроено».
- `RedirectUrl` = `${WEB_ORIGIN}/payment/{paymentId}` (orders) or `${ADMIN_ORIGIN}/settings/payments?check={id}`
  (connection checks).
- After adding the variables, existing dev machines must copy the new lines into their root `.env` (`pnpm dev` copies
  `.env.example` only on first run). CI copies `.env.example`, so mock mode is on there too; tests set what they need.

### 5.3 Shared schemas (`packages/shared`)

- `createOrderSchema`: `paymentMethod: z.enum(PAYMENT_METHODS).default('whatsapp')`. Outbox entries without it stay
  WhatsApp orders.
- `createOrderResponseSchema`: add `payment: paymentStartSchema.nullable()` (null for WhatsApp orders and the
  honeypot's fake answer), with

  ```ts
  export const paymentStartSchema = z.object({
    id: z.uuid(),
    /** pending: url is ready; failed: Finik refused or did not answer, offer a retry or WhatsApp. */
    status: z.enum(['pending', 'failed']),
    url: z.url().nullable(),
    expiresAt: z.iso.datetime().nullable(),
  });
  ```

- `publicPaymentSchema` for `GET /payments/:id`:

  ```ts
  z.object({
    id: z.uuid(),
    status: z.enum(['pending', 'paid', 'expired', 'failed']), // order-level view, see §5.6
    orderNumber: z.number().int(),
    amountKgs: z.number().int(),
    paidAt: z.iso.datetime().nullable(),
    canRetry: z.boolean(),
  });
  ```

- Admin:
  - `orderRowSchema` gains `paymentMethod` and `paymentStatus`;
  - `orderDetailSchema` gains a `payment` block: `method`, `status`, `paidAt` and `attempts[]`, each with `id`,
    `status`, `amountKgs`, `createdAt`, `expiresAt`, `paidAt`, `paidAmountKgs` (number or null), `channel`
    (`qr`, `visa` or null), `transactionId`, `receiptNumber`, `error`;
  - `updateOrderSchema` gains `paymentStatus?: 'unpaid' | 'paid' | 'refunded'`;
  - history entries can describe payment changes (from/to payment statuses and the source), not only order statuses.
- Settings: `paymentsSettingSchema`, `SETTING_DEFAULTS.payments`, public `payments`.
- `ERROR_CODES` + `payment_unavailable` (409): online payment off or not configured. Map it in both `copy.ts` files.
- Run `pnpm gen:api` and commit `backend/openapi.json` and `packages/shared/src/api/schema.d.ts`.

### 5.4 Finik client

`createPayment({ paymentId, amountKgs, description, redirectUrl, expiresAt })`:

1. Body as in §2.5 (`Data.name_en` = `settings.shop.name`, `Data.endDate` = `expiresAt.getTime()`), sorted at the top
   level, serialised once; that exact string is signed and sent.
2. Headers and signature per §2.3, fresh timestamp.
3. `fetch` with `redirect: 'manual'` and a 10 s timeout; parse per the table in §2.5; return `{ url }` or a failure
   `{ reason: 'http' | 'timeout' | 'network' | 'bad_url', status?, message? }`. `message` is Finik's `ErrorMessage`
   or `message`, trimmed to 200 characters.
4. No automatic retry inside the client: a retry is a new attempt with a new `PaymentId` (D32).
5. Logs: `finik create <paymentId> → 302 (host beta.qr.finik.kg)` or `→ 403 Forbidden`; never the key, signature,
   body or URL.

`FINIK_ENV=mock`: no HTTP; the URL is `<origin of FINIK_WEBHOOK_URL>/v1/dev/finik/pay/<paymentId>` (§5.11).

### 5.5 `POST /orders` with `paymentMethod: 'finik'`

1. Honeypot, `clientRef` replay, Turnstile and validation exactly as today.
2. Online payment unavailable (setting off or not configured) → `409 payment_unavailable`, nothing stored.
3. Prices and lines from the DB (unchanged), then **one transaction**: create the order (`paymentMethod: finik`,
   `paymentStatus: pending`, `message` built with the online closing, §7.3) and its first `Payment`
   (`status: created`, `amountKgs = totalKgs`, `environment`, `expiresAt = now + linkTtlMinutes`).
4. After the commit, call the client. Success → payment `pending` with `paymentUrl`; failure → payment `failed` with
   `error`, order `unpaid`.
5. **No owner notification now** (D33); WhatsApp orders still notify at creation.
6. `201 { id, number, payment: { id, status, url, expiresAt } }`.
7. Replaying the same `clientRef` returns the same order and its **latest** attempt without calling Finik again
   (a pending, unexpired attempt keeps its URL; otherwise `status: 'failed', url: null`, and the site offers a retry).
   Two racing requests resolve as today (`isDuplicateClientRef`).

### 5.6 Public payment endpoints

| Method & path              | Limit (per IP)     | Notes                                                                                                                          |
| -------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /payments/:id`        | 60 / min           | `publicPaymentSchema`; `Cache-Control: no-store`; 404 for unknown ids and `check` payments. No personal data                   |
| `POST /payments/:id/retry` | 6 / min, 30 / hour | `paymentStartSchema`; 404 unknown; 409 `conflict` when the order is paid; 409 `payment_unavailable` when online payment is off |

`status` mapping for `GET`: the order is `paid` (by any attempt or by hand) → `paid`; this attempt `created`/`pending`
and not past `expiresAt` → `pending`; `failed` → `failed`; otherwise `expired`. `canRetry` = online payment available
and the order is not paid. This answer never contains the payment URL; only the create and retry answers do (the
payment id in the status page's address is what lets a visitor retry).

Retry: the order's latest attempt is still `pending` and unexpired → return it; otherwise create a new attempt (new
`PaymentId`, new `expiresAt`) and call Finik; order back to `pending` on success.

The site's server-side read of this endpoint sends `X-Internal-Secret` like every other server read (exempt from the
per-IP limit).

### 5.7 `POST /webhooks/finik`

Enable `rawBody: true` in `NestFactory.create` (`main.ts`) and in `backend/test/app.ts`, and read `req.rawBody` through
`@Req()`, with no `@Body()` DTO, so the global zod pipe never touches the payload. Steps:

1. No `req.rawBody`, invalid JSON, or not a JSON object → `400`.
2. Missing `signature` or `x-api-timestamp`, signature not valid for any host/path candidate (§2.6), or timestamp older
   or newer than 5 minutes → `401`, nothing stored, `warn` log with the reason and the request id only.
3. Parse the verified body with a permissive zod schema (`passthrough`; `status`, `amount`, `id`, `transactionId`,
   `fields.paymentId`, … all optional).
4. `dedupeKey` = `id` ?? `transactionId` ?? `sha256(rawBody)`. A `PaymentEvent` with that key already exists → this
   delivery was handled before → `200`, nothing else.
5. Find the payment by `fields.paymentId`, then by `transactionId` (both only when they are UUIDs).
6. In **one transaction**: lock the payment row (or update conditionally, so two different deliveries cannot both pay
   the order), decide the outcome below, insert the `PaymentEvent` (a unique violation here is a concurrent duplicate:
   roll back and answer `200`) and apply the changes. Enqueue notifications after the commit. A failure before the
   commit rolls everything back and answers `500`, so Finik delivers again.

| Situation                                                    | Payment                                                                     | Order                                                      | Event outcome       | Notify (D33)              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------- | ------------------------- |
| Paid status, amount = `amountKgs`, order not paid            | `succeeded`; `paidAt` = `transactionDate` or now; ids, receipt, paid amount | `paid`, `paidAt`; AuditLog                                 | `applied`           | `paid`                    |
| Same, but the order is `cancelled`                           | `succeeded`                                                                 | `paid` (money arrived), status stays `cancelled`           | `paid_cancelled`    | `paid_review` (cancelled) |
| Paid status, order already paid (another attempt or by hand) | `succeeded`                                                                 | unchanged                                                  | `duplicate_payment` | `paid_review` (double)    |
| Paid status, amount differs                                  | `succeeded`, paid amount kept                                               | unchanged (owner decides)                                  | `amount_mismatch`   | `paid_review` (amount)    |
| Paid status, order deleted                                   | `succeeded`                                                                 | none                                                       | `paid_deleted`      | `paid_review` (deleted)   |
| Paid status, `check` payment                                 | `succeeded`                                                                 | none                                                       | `check_paid`        | `check_paid`              |
| `failed`                                                     | `failed` unless already `succeeded`                                         | `unpaid` when it has no other live attempt and is not paid | `failed`            | none                      |
| Unknown payment                                              | none                                                                        | none                                                       | `unknown_payment`   | none (`warn` log)         |
| Any other status                                             | none                                                                        | none                                                       | `ignored`           | none (`info` log)         |

7. Answer `200` with an empty JSON object in every row of that table (Finik stops retrying; we keep the event).
   Amounts compare as `Math.round(Number(amount) * 100) === amountKgs * 100`. A paid webhook wins over `expired` and
   `failed` attempts and over the order's `unpaid`.

The endpoint is public (no CSRF, no CORS), throttled by the global default limit, and must answer within a few seconds
(the work is one transaction plus a job enqueue).

### 5.8 Expiry job

New queue `payments` with the scheduled job `payments.expire` every 5 minutes (follow `JobsService.schedule`, the
`DEFAULTS` table and one processor per queue with the logic in a service):

- Attempts `created`/`pending` with `expiresAt` more than 10 minutes ago → `expired`.
- Online orders not paid, with no live attempt, whose latest attempt ended (expired, or failed more than 10 minutes
  ago), and `unpaidNotifiedAt` empty → `paymentStatus = unpaid`, `unpaidNotifiedAt = now`, notify `unpaid` when
  `settings.payments.notifyUnpaid` is on.
- Idempotent, takes `now` as a parameter (tests call the service directly, like `MaintenanceService`).

### 5.9 Notifications

Extend the notify job payload (e.g. `{ entity: 'order' | 'lead' | 'payment', id, event?, reason? }`) and
`backend/src/notifications/messages.ts`. Same channels and fallback as orders (Telegram, then email). Texts are ours:
no em-dashes, customer input escaped.

| Event         | Subject                         | Body                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paid`        | `Заказ №1042 оплачен онлайн`    | The order lines as in the new-order message, `Итого: 5 900 сом · Finik`, name · phone, address, comment, «Пришла из теста» when set, link «Открыть в админке»                                                                                                                                                                   |
| `paid_review` | `Проверьте оплату заказа №1042` | One reason line, then the amount and the link. Reasons: «Пришло 5 000 сом, а заказ на 5 900 сом.» · «Заказ уже был оплачен, это второй платёж. Лишнее можно вернуть в кабинете Finik.» · «Заказ отменён, а оплата пришла. Верните деньги в кабинете Finik или восстановите заказ.» · «Заказ удалён, а оплата пришла.» (no link) |
| `unpaid`      | `Заказ №1042 не оплачен`        | «Ссылка на оплату истекла, а оплаты нет. Если заказ ещё нужен, напишите клиенту в WhatsApp.», the lines and total, name · phone, link                                                                                                                                                                                           |
| `check_paid`  | `Проверка Finik прошла`         | «Платёж 1 сом получен: онлайн-оплата работает.»                                                                                                                                                                                                                                                                                 |

### 5.10 Admin endpoints

| Method & path                      | Role | Notes                                                                                                                                                                     |
| ---------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/orders`                | M    | rows + `paymentMethod`, `paymentStatus`                                                                                                                                   |
| `GET /admin/orders/:id`            | M    | + `payment` block (§5.3) and payment entries in the history                                                                                                               |
| `PATCH /admin/orders/:id`          | M    | + `paymentStatus?: unpaid \| paid \| refunded`; `paid` sets `paidAt` when empty, `unpaid` clears it; AuditLog `payment` with `source: manual`                             |
| `GET /admin/orders/export.csv`     | O    | + columns «Оплата», «Статус оплаты», «Дата оплаты», «Операция Finik»                                                                                                      |
| `GET /admin/payments/finik`        | O    | `{ configured, environment: mock \| beta \| prod \| null, accountId: masked "8d4e…6a", webhookUrl }`                                                                      |
| `POST /admin/payments/finik/check` | O    | Creates a `check` payment of **1 сом** (description «Проверка подключения», `linkTtlMinutes` 15) → `paymentStartSchema`; works even while `finikEnabled` is off; AuditLog |
| `GET /admin/payments/:id`          | O    | Status of a check payment (polled by the settings screen)                                                                                                                 |

### 5.11 Mock mode (`FINIK_ENV=mock`, development and tests only)

- At boot, generate an RSA key pair in memory: its private half plays Finik's key, its public half replaces Finik's
  public key in the webhook verifier.
- The client returns `{origin of FINIK_WEBHOOK_URL}/v1/dev/finik/pay/{paymentId}` (§5.4).
- `GET /v1/dev/finik/pay/:id`: a tiny server-rendered HTML page, no scripts: «Finik · тестовая оплата», the amount and
  description, a «Оплатить» form button and a «Вернуться в магазин» link to `WEB_ORIGIN`.
- `POST /v1/dev/finik/pay/:id`: builds a payload shaped like vector A (`id: mock_<uuid>_DEBIT`,
  `transactionId: paymentId`, `status: SUCCEEDED`, `amount`, `fields: { paymentId, amount }`, `data`,
  `transactionDate`), signs it with §2.3 for the host and path of `FINIK_WEBHOOK_URL`, **POSTs it over HTTP to this
  API's own `/v1/webhooks/finik`** (the origin that served the mock page; in dev that is `FINIK_WEBHOOK_URL` itself),
  so the real verification path runs, then answers `303` to the payment's `RedirectUrl`. Tests on a random port work
  because the verifier tries the configured host and path first (§2.6).
- The controller is registered only in mock mode (`PaymentsModule.forRoot(env)`); otherwise the routes are 404.
  `env.ts` refuses mock in production.

### 5.12 Logging and security

- Never log: the private key, `x-api-key`, `signature`, payment URLs, webhook bodies (`fields.name` can be the
  payer), names, phones, addresses. Log ids, statuses, HTTP codes, amounts. Add
  `req.headers.signature` and `req.headers["x-api-key"]` to the pino redact list as a safety net.
- Prices and amounts only from the DB; a client can never set `paymentStatus`.
- `paymentUrl` goes only to the browser that created the order (create and retry answers).
- Webhook authentication is the signature plus the 5-minute window; there is no IP allowlist (Finik publishes none).
- Cloudflare proxies `api.bom-beauty.com`: make sure no WAF or bot rule challenges `POST /v1/webhooks/finik`
  (the 1 сом check in §10 proves it end to end).
- Payment responses are `no-store`; `/payment/*` pages are `noindex` and disallowed in `robots.ts`.

## 6. Site (frontend)

### 6.1 Order sheet (`frontend/src/components/overlays/order-sheet.tsx`)

The layout passes `settings.payments` to `SiteOverlays` → `OrderSheet` (next to `whatsapp` and `turnstileSiteKey`).

- `payments.finik` false: **no change at all** (no picker, today's texts and flow).
- `payments.finik` true: a «Способ оплаты» group after the comment field and before the total, two full-width option
  cards (native radio inputs, labelled, ≥ 44 px, visible focus; selected card: accent border with the input focus
  halo; look and spacing from the existing sheet fields and the wholesale sheet's chips). Preselect
  `payments.defaultMethod`; keep the visitor's choice while the sheet stays open.
- **WhatsApp selected**: today's flow exactly (WhatsApp opens inside the click, `keepalive` POST + outbox), with
  `paymentMethod: 'whatsapp'`.
- **Online selected**:
  - Under the total: «Оплата в сомах через Finik · отправим сразу после оплаты»; when the display currency is not сом,
    the existing «В сомах: …» line stays.
  - The phone field is the only way to reach an online customer, who never writes to the shop first: the bot's
    «Написать о доставке» button opens WhatsApp on this number. Keep the design's label «Телефон» and, while online
    payment is selected, show a hint under the field: «Номер с WhatsApp: сюда напишем об оплате и доставке».
    Validation stays as it is (required, normalised to E.164, foreign numbers accepted). WhatsApp cannot be checked
    in advance; if a number has no WhatsApp, the owner calls it (Telegram makes the number in the message tappable).
  - Button: «Оплатить 5 900 сом» (`formatKgs(total)`, D34); while waiting «Переходим к оплате…»; hint under it:
    «Откроется страница оплаты Finik. После оплаты вы вернётесь на сайт». The consent line stays.
  - Submit: validate as today, build the record message (§7.3), `await` the `POST /orders` (no outbox, 25 s timeout,
    `clientRef` kept for this submission so a retry after a network error returns the same order), then save the
    pending record (§6.3) and `window.location.assign(payment.url)`.
  - `409 payment_unavailable`: switch the picker to WhatsApp and show «Онлайн-оплата сейчас недоступна. Отправьте заказ
    в WhatsApp, Нурайым пришлёт реквизиты.» (the visitor presses the WhatsApp button themselves, so the pop-up rule
    holds).
  - Network error or no answer: «Не получилось оформить заказ. Проверьте интернет и попробуйте ещё раз.» with
    «Попробовать ещё раз» (same `clientRef`) and «Отправить в WhatsApp» (today's WhatsApp flow with the same
    `clientRef`, so a half-created order is never duplicated).
  - `payment.status = failed`: «Не получилось открыть оплату» / «Заказ №1042 сохранён. Попробуйте ещё раз или
    отправьте его в WhatsApp: Нурайым пришлёт реквизиты.» with «Попробовать ещё раз» (`POST /payments/:id/retry`, then
    redirect) and «Отправить в WhatsApp» (opens WhatsApp with the order message plus «Номер заказа на сайте: №1042»;
    no second POST, the order exists).
  - Back from Finik through the browser's back button (`pageshow` with `persisted`): replace the frozen «Переходим к
    оплате…» with «Заказ ещё не оплачен» / «Заказ №1042 ждёт оплаты. Можно вернуться к оплате или отправить заказ в
    WhatsApp.», buttons «Перейти к оплате» (same URL while unexpired, else retry) and «Отправить в WhatsApp».
  - The cart is **not** emptied here (§6.3); a direct program order never touches the cart.
- Analytics (Umami): `payment-start` (`method`), `payment-error` (`reason`); `payment-paid` on the status page.

### 6.2 Payment status page: `frontend/src/app/payment/[id]/page.tsx`

- Server component: `notFound()` for a non-UUID or a 404; a fresh read of `GET /payments/:id` (add a no-store helper
  next to `apiGet` in `lib/api.ts`: internal URL, `X-Internal-Secret`, `cache: 'no-store'`, no tags);
  `robots: { index: false }`; title «Оплата заказа». It renders the current state, so it works without JavaScript
  (with a plain «Обновить» link while pending).
- Client leaf polls while `pending`: every 2 s for 2 minutes, then every 10 s up to 15 minutes, then stops on the
  «late» state. A polite live region announces changes. Loading and error states exist.
- Layout: the sent-screen language (round icon badge, heading, muted text, full-width buttons), centered, max 480 px
  wide inside the 1100 px desktop container; side padding as other pages on phones.

| State                          | Heading                        | Text                                                                                   | Buttons                                                |
| ------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| first load / `pending` < 2 min | «Проверяем оплату»             | «Это займёт несколько секунд»                                                          | none                                                   |
| `pending` after 2 min          | «Ждём подтверждение от банка»  | «Обычно это занимает до минуты. Страница обновится сама.»                              | «Написать Нурайым»                                     |
| `pending` after 15 min         | «Оплата пока не подтвердилась» | «Если деньги списались, напишите Нурайым: проверим и подтвердим заказ.»                | «Написать Нурайым», «Оплатить ещё раз» (if `canRetry`) |
| `paid`                         | «Оплата прошла»                | «Заказ №1042 оплачен: 5 900 сом. Нурайым свяжется с вами и отправит заказ.»            | «Написать Нурайым», «Вернуться в магазин»              |
| `expired` / `failed`           | «Оплата не завершена»          | «Ссылка на оплату заказа №1042 устарела. Можно оплатить ещё раз или написать Нурайым.» | «Оплатить ещё раз» (if `canRetry`), «Написать Нурайым» |
| request error                  | «Оплата заказа»                | «Не удалось проверить оплату. Обновите страницу через минуту.»                         | «Обновить»                                             |

«Написать Нурайым» opens `waLink(shop.whatsapp, …)` with `buildPaidMessage` when paid and `buildPaymentHelpMessage`
otherwise (§7.3). «Оплатить ещё раз» calls retry and redirects. Paid icon: success tint with the check icon, as in the
sent screen; others: the neutral surface tint.

### 6.3 Pending payment record and the cart

- Before redirecting, store `bb-pending-payment` in `localStorage`: `{ paymentId, orderNumber, fromCart, at }`
  (try/catch like the outbox helpers).
- On the status page, when the state becomes `paid`: if the record matches and `fromCart`, empty the cart; remove the
  record.
- On any later page load (next to `flushOutbox`), a record younger than 7 days is checked once with
  `GET /payments/:id`; `paid` → empty the cart if `fromCart` and drop the record; `expired`/`failed` → drop it.

### 6.4 Wording that depends on online payment (D36)

`payments.finik` true → our variant; false → the design's text, verbatim.

| Place                                       | Design text (kept when off)                                               | Online variant                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/programs` «Как это работает», step 3      | «Закажите в WhatsApp» / «Короткая форма, оплата по реквизитам в WhatsApp» | «Оформите заказ» / «Короткая форма, оплата онлайн или по реквизитам в WhatsApp» |
| `/catalog` note                             | «Заказ придёт Нурайым в WhatsApp, отправка после 100% оплаты»             | «Оплата онлайн или по реквизитам в WhatsApp, отправка после 100% оплаты»        |
| Order sheet note under the total (WhatsApp) | «Реквизиты для оплаты придут в WhatsApp · отправка после 100% оплаты»     | unchanged                                                                       |

Owner-editable texts (delivery page, program facts «Оплата», footer note, offer, privacy) are changed by the owner in
the admin; list them in HANDOFF (§9). Do not edit them in a migration.

### 6.5 New site copy (`frontend/src/content/copy.ts`)

All strings above, plus: «Способ оплаты»; «Онлайн-оплата» with «QR-код или приложение банка Кыргызстана» (or «QR-код,
приложение банка или карта Visa» when `payments.visa`); «Через WhatsApp» with «Нурайым пришлёт реквизиты для
оплаты»; error texts for `payment_unavailable` and `conflict`. Russian, «вы», short sentences, no em-dashes.

## 7. Admin

### 7.1 Orders (`admin/src/features/orders`, `admin/src/api/orders.ts`)

- List rows: a small payment chip after the status select when `paymentMethod = finik` or `paymentStatus ≠ unpaid`:
  «Оплачен» (the admin green `#137a55` on its tint, D18), «Ждёт оплаты» (amber), «Не оплачен» (grey), «Возврат»
  (grey). WhatsApp orders that nobody marked look exactly as today.
- Drawer: an «Оплата» section after the order lines: «Способ» («Онлайн (Finik) · Visa» or «Онлайн (Finik) · QR» once
  paid), «Статус», «Оплачен» (date, Asia/Bishkek), «Сумма», «Чек Finik», «Операция Finik», and the attempts (status,
  amount, time, error) for online orders. A «Статус оплаты»
  select (Не оплачен / Оплачен / Возврат) with a confirmation for «Возврат» («Отметить возврат? Деньги возвращаются в
  кабинете Finik, здесь только отметка.») and for un-paying an order Finik confirmed («Finik подтвердил оплату этого
  заказа. Всё равно отметить как неоплаченный?»). Optimistic with rollback, toast «Статус оплаты изменён», history
  shows payment changes («Оплачен · Finik», «Оплачен · Нурайым»).
- Query keys from `admin/src/api/keys.ts` (add `payments`).

### 7.2 Settings → «Оплата» (owner only, new tab in `settings-page.tsx`)

- Connection card: «Подключение»: «Боевой режим» / «Бета Finik, без реальных денег» / «Тестовый режим, без Finik» /
  «Не настроено: на сервере нет ключей Finik»; «Счёт» (masked); «Адрес для уведомлений» (webhook URL).
- Switch «Принимать онлайн-оплату на сайте» (hint «Покупатель выберет: онлайн или через WhatsApp»), disabled with an
  explanation while not configured.
- «Способ по умолчанию»: «Онлайн» / «WhatsApp».
- «Ссылка на оплату действует», minutes (10 to 1440).
- Switch «Карты Visa подключены в Finik» (hint «Тогда на сайте будет написано «или карта Visa»»).
- Switch «Сообщать о неоплаченных заказах» (hint «Придёт сообщение в Telegram, если клиент не оплатил за это время»).
- Button «Проверить подключение» → `POST /admin/payments/finik/check` → «Finik принял запрос. Оплатите 1 сом по
  ссылке, чтобы проверить уведомление об оплате.» + link «Открыть страницу оплаты»; then polls the check payment:
  «Ждём оплату…» → «Платёж получен: всё работает» (or «Finik ответил ошибкой: …»).
- Saving shows a toast and writes AuditLog (existing settings code).

### 7.3 Labels and texts

`packages/shared/src/labels.ts`:

- `PAYMENT_METHOD_LABELS`: `whatsapp` «WhatsApp», `finik` «Онлайн (Finik)».
- `ORDER_PAYMENT_STATUS_LABELS`: `unpaid` «Не оплачен», `pending` «Ждёт оплаты», `paid` «Оплачен», `refunded`
  «Возврат».
- `PAYMENT_STATUS_LABELS`: `created` «Создаётся», `pending` «Ссылка выдана», `succeeded` «Оплачен», `failed`
  «Ошибка», `expired` «Истекла».

`packages/shared/src/whatsapp.ts` (WhatsApp texts live only here; test them):

- `buildOrderMessage(order, options?)`: unchanged by default. `closing: 'online'` ends with «Оплата онлайн через
  Finik.» instead of «Пришлите, пожалуйста, реквизиты для оплаты.» (the stored `message` of online orders);
  `number: 1042` adds «Номер заказа на сайте: №1042» before the closing line (WhatsApp fallback after a failed online
  payment).
- `buildPaidMessage({ number, total })` → «Здравствуйте! Заказ №1042 на сайте оплачен: 5 900 сом.»
- `buildPaymentHelpMessage({ number })` → «Здравствуйте! По заказу №1042 на сайте оплата не подтвердилась.
  Проверьте, пожалуйста.»

## 8. Tests

A bug fix comes with a failing test; the vectors come first, before the client.

**Unit (backend)**

- `finik-signer.test.ts`: vectors A and B verify with the right key and fail with the other; their canonical strings
  equal §2.8 exactly; the negative cases of §2.8 fail; top-level reordering still verifies; sign → verify round trip
  with fresh PKCS#1 and PKCS#8 keys; the create-payment canonical string for a fixed input (host, key, timestamp,
  body) equals a hard-coded expected string.
- `finik.client.test.ts` (fetch stubbed with `vi.spyOn(globalThis, 'fetch')`, as in `backend/test/jobs.test.ts`): URL
  per environment; headers; the sent body equals the signed JSON; the signature verifies with the test public key;
  `302` → `Location`; `201` JSON → `paymentUrl`; `400`/`401`/`403 {"message":"Forbidden"}`/`502`/timeout → typed
  failures; non-https URL rejected; fresh timestamp per call.
- `env.test.ts`: mock refused in production; beta without a key fails; a broken private key fails; `https` webhook
  URL required in production.

**Integration (`backend/test/payments.test.ts`, real app, test DB)** with `FINIK_ENV=beta` overrides, a key pair
generated in the test (our private key for the client, a second pair as "Finik" via `FINIK_PUBLIC_KEY_BASE64`), and
fetch stubbed for the Finik host:

- `POST /orders` online: one Finik call, amount = server total (client prices ignored), order `pending`, payment
  `pending` with URL, response shape; no notification enqueued.
- Same `clientRef` again → same order and URL, Finik called once.
- Finik `403` → `201` with `payment.status = failed`, order `unpaid`; retry → new attempt with a new id and URL.
- Setting off or not configured → `409 payment_unavailable`, nothing stored. WhatsApp orders unchanged (existing tests
  stay green) and still notify at creation.
- A paid webhook with `service: { id: "VISA" }` stores `channel = visa`, one without it `qr`.
- Webhook signed by the test "Finik" key: order paid, AuditLog entry, `paid` notification once; the same delivery again
  → `200`, nothing new; bad signature, wrong host, stale timestamp, unsigned → `401`, nothing stored; invalid JSON →
  `400`; unknown payment → `200` + `unknown_payment`; amount mismatch, double payment, cancelled order, deleted order,
  check payment → the outcomes and notifications of §5.7; `FAILED` → attempt failed; a paid webhook after expiry
  still pays.
- `GET /payments/:id` mapping and no personal data; `no-store`; retry rules (paid → 409).
- `payments.expire` with an injected `now`: attempts expire, the order turns `unpaid`, one `unpaid` notification,
  never twice; respects `notifyUnpaid`.
- Admin: manual payment status with AuditLog and history; manager may change it, only the owner reads Finik config
  and runs the check; CSV columns; rows and detail carry payment fields.
- Mock mode: create → mock page → `POST` pay → webhook verified through real HTTP → order paid.

**Shared (Vitest)**: schema defaults (`paymentMethod`), settings defaults, the three WhatsApp builders, labels, enum
parity.

**Playwright** (`pnpm dev` with `FINIK_ENV=mock`; the dev seed turns online payment on with `defaultMethod:
'whatsapp'`, so the existing WhatsApp specs keep their default):

- `frontend/e2e/payments.spec.ts`, phone and desktop: cart order online → mock Finik page → «Оплатить» →
  `/payment/{id}` shows «Оплата прошла» with the number → the cart is empty; a direct program order online leaves the
  cart alone; status page states with `page.clock` to fast-forward polling; axe WCAG 2.2 AA on the sheet with the
  picker and on the status page; with online payment off the sheet has no picker and today's button (switch it off
  through the admin API inside this file, which runs serially, and switch it back in `afterAll`; other spec files keep
  working either way because the dev default method is WhatsApp).
- `admin/e2e/admin.spec.ts`: the paid chip in the list, the drawer's «Оплата» section, marking a WhatsApp order paid
  (confirm, toast, history), the «Оплата» settings tab (owner).

## 9. Docs to update (same commit as the code)

- **ARCHITECTURE.md**: §1 (online payment exists, optional), §2 diagram (Finik API and payment page), §6.1 modules
  (`payments`), §6.2 routes (`/payment/[id]`), order sheet and progressive enhancement note (online payment needs JS;
  the no-JS fallback stays the `wa.me` link), §6.3 settings tab, new §7.9 "Online payment (Finik)" flow, §8 webhook
  security, §14 (no new dependency; the rejected package and why), §15 D28–D36, §16 risks (webhook delivery through
  Cloudflare, undocumented status API and double payments, payment page host).
- **DATA-MODEL.md**: enums, Order fields, `Payment`, `PaymentEvent`, the `payments` setting, the payment lifecycle.
- **API.md**: `POST /orders` (`paymentMethod`, `payment`), `GET /payments/:id`, `POST /payments/:id/retry`,
  `POST /webhooks/finik` (auth row: Finik signature), admin endpoints, `payment_unavailable`, rate limits, the
  `payments.expire` job and the new notification events, mock routes (dev only).
- **TASKS.md**: M9 with the gate, checked as you go.
- **HANDOFF.md** (Russian, the owner reads it): §4 a Finik row («ID счёта, API-ключ «Веб-клиент» с нашим публичным
  ключом» ⬜); §3 texts to update when online payment goes live («Доставка и
  оплата», «Оплата» in program facts, the footer, the offer and the privacy policy mention Finik); §5 decisions from
  §11; §6 a line on how online payments show up in «Заказы» and how refunds work (in Finik's cabinet, then «Возврат»).
- **DEPLOY.md**: §2.4 Finik setup (keys: who generates and where they live, cabinet steps), §2.5 the env rows, §3 the
  1 сом check in the first-deploy list, §4 a release note for M9 (additive migration, how to switch beta → prod,
  pending beta attempts are orphaned by the switch, never copy `FINIK_ENV=mock` from `.env.example` to the
  server: the API refuses to start), troubleshooting rows: create `403` (wrong key or environment),
  `401` (key pair, clock, body), our webhook answers `401` (wrong `FINIK_WEBHOOK_URL` host or path, wrong environment
  key), no webhook at all (Cloudflare rule, URL not https, ask Finik).
- **`infra/.env.example`**: §5.2.

## 10. Rollout

1. Merge with `finikEnabled: false`. Production has no `FINIK_*` yet: nothing changes on the site.
2. Beta, optional (only if Finik gives the developer beta credentials): developer machine with a tunnel, full flow
   with Finik's Playground «Try a payment» (§2.9). Optionally on the server with `FINIK_ENV=beta` and the site switch
   **off**: «Проверить
   подключение» in the admin, pay the beta link in the Playground, see «Платёж получен» (this proves Cloudflare,
   Caddy and the webhook path).
3. Production keys: `FINIK_ENV=prod` + production key, account and our private key in `/opt/bom/.env`,
   `docker compose up -d`. «Проверить подключение», pay 1 сом with a real banking app, see «Платёж получен» and the
   Telegram message. Once Finik has switched cards on: check that Finik's page offers a card, pay one more 1 сом link
   with a Visa card, see «Visa» in the admin, then turn on «Карты Visa подключены в Finik».
4. The owner updates the texts (HANDOFF), then switches «Принимать онлайн-оплату на сайте» on.
5. Watch the first real payments: `docker compose logs api worker | grep -i finik`.

## 11. Questions for the owner and for Finik

Ask the owner (HANDOFF §5):

1. Online payment as the default choice, or WhatsApp first?
2. Delivery: is it included in what the customer pays online, or paid separately? (The order total has no delivery
   line today.)

Not asked as questions (decided 2026-10-22):

- **Visa**: wanted (decided 2026-10-22); the owner asks her Finik manager to switch card acceptance on for her
  account, and the card fee. On 2026-10-23 her payment page offered bank apps and QR only, so it is not on yet. It is not something we build: once Finik enables it, a card option appears on Finik's
  own payment page and the create-payment call stays the same. Our part: the `visa` setting (adds «или карта Visa» to
  our wording), storing `channel` from the webhook's `service.id` and showing it in the admin, and a 1 сом card
  payment in the go-live check. Customers abroad pay in сом and their bank converts; cards issued in Russia will not
  work.
- **Online-KKM** (600 сом a month at Finik): left out. If her accountant ever says she needs fiscal receipts, she
  switches it on in Finik; nothing changes in our code (the webhook already carries `receiptNumber`).
- **Fee**: her Finik contract rate (standard 4%); she knows it from her contract.

Ask Finik (finik@quickpay.kg, WhatsApp +996 995 901 109), the developer directly:

1. Can we get beta credentials (API key and account) for the Web SDK? Optional.
2. Is there an API to read a payment's status, for when a webhook is lost?
3. Can one FINIK_QR link with a fixed `Amount` be paid twice before `endDate`? What does a repeated `PaymentId` return?
4. Are failed payments ever sent to the webhook (the older document mentions `FAILED`)? Does the
   `failure_redirect_url` add anything to our `RedirectUrl` (a status parameter)?
5. Is there a refund API, or only the cabinet?

## 12. Acceptance checklist

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` green; `pnpm gen:api` committed; `pnpm format:check` clean.
- [ ] Signer unit tests pass on Finik's vectors A and B; no `@mancho.devs/authorizer` in any `package.json`.
- [ ] Migration is additive; existing orders read as WhatsApp / «Не оплачен».
- [ ] With online payment off or `FINIK_*` empty, the order sheet and every page look and behave as before (existing
      e2e green; compare the sheet with `main` side by side).
- [ ] With it on (mock): cart and program orders pay through the mock page and land on «Оплата прошла»; the order shows
      «Оплачен» in the admin within 15 s; the `paid` notification goes out once (switch on email notifications in the dev
      admin to see it in Mailpit).
- [ ] Failure paths in the browser: Finik error → retry and WhatsApp fallback; back button from Finik; expired link →
      «Оплатить ещё раз»; no duplicate orders in any of them.
- [ ] Webhook: duplicate deliveries do nothing; bad signatures get 401 and change nothing; every outcome of §5.7 is
      covered by a test.
- [ ] Admin: payment chip, drawer section, manual status with confirm, toast, rollback and history; «Оплата» settings
      tab with the connection check (mock).
- [ ] Logs contain no key, signature, payment URL, webhook body or personal data (grep the dev log after a full run).
- [ ] Compared at 390 px and 1280 px: order sheet with the picker, every status page state, admin drawer and settings
      tab; same visual language as the sheet and the sent screen.
- [ ] Docs updated (§9); HANDOFF in Russian; DEPLOY has the env rows, the go-live steps and troubleshooting.
- [ ] Conventional commit `feat: online payment with Finik (M9)` and the 5-line status.
