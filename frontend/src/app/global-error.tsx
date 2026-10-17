'use client';

import { DEFAULT_SHOP_WHATSAPP, GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared/web';
import { copy } from '@/content/copy';

// Last resort when the root layout itself fails: no theme, no header, just a way out.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#FAF7F8', color: '#14142B' }}
      >
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>{copy.error.title}</h1>
          <p style={{ color: '#5B5F7A', lineHeight: 1.5 }}>{copy.error.text}</p>
          <p style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                height: 52,
                border: 0,
                borderRadius: 14,
                background: '#D12F63',
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {copy.error.retry}
            </button>
            <a
              href={waLink(DEFAULT_SHOP_WHATSAPP, GENERIC_QUESTION_MESSAGE)}
              style={{ color: '#B3264F', fontWeight: 600 }}
            >
              {copy.programs.writeNurai}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
