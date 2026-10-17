import Script from 'next/script';
import { env } from '@/env';

/**
 * Umami (cookie-free, proxied as /s/* by Caddy so ad blockers leave it alone) and the optional Meta Pixel.
 * Both stay off until their ids are set in the admin.
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
        <Script
          src="/s/script.js"
          data-website-id={umamiWebsiteId}
          data-host-url={`${env.NEXT_PUBLIC_SITE_URL}/s`}
          strategy="afterInteractive"
        />
      )}
      {metaPixelId && /^\d{5,20}$/.test(metaPixelId) && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
