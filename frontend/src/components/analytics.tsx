import Script from 'next/script';
import { env } from '@/env';

/**
 * Payment pages are personal links (/pay/<token>): Umami records them as "/pay", without the token. Umami calls this
 * before every send (data-before-send); it is defined inline so it exists before the tracker loads.
 */
const UMAMI_BEFORE_SEND = `window.bbUmamiBeforeSend=function(type,payload){if(payload){['url','referrer'].forEach(function(key){var value=payload[key];if(typeof value==='string')payload[key]=value.replace(/\\/pay\\/[^/?#]+/,'/pay');});}return payload;};`;

/**
 * Umami (cookie-free, proxied as /s/* by Caddy so ad blockers leave it alone) and the optional Meta Pixel.
 * Both stay off until their ids are set in the admin. The pixel never loads on a payment page.
 */
export function Analytics({
  umamiWebsiteId,
  metaPixelId,
}: {
  umamiWebsiteId: string | null;
  metaPixelId: string | null;
}) {
  return (
    <>
      {umamiWebsiteId && (
        <>
          <script dangerouslySetInnerHTML={{ __html: UMAMI_BEFORE_SEND }} />
          <Script
            src="/s/script.js"
            data-website-id={umamiWebsiteId}
            data-host-url={`${env.NEXT_PUBLIC_SITE_URL}/s`}
            data-before-send="bbUmamiBeforeSend"
            strategy="afterInteractive"
          />
        </>
      )}
      {metaPixelId && /^\d{5,20}$/.test(metaPixelId) && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`if(location.pathname.indexOf('/pay/')!==0){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');}`}
        </Script>
      )}
    </>
  );
}
