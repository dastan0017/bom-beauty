/** The order's payment page on the site: `https://bom-beauty.com/pay/<token>` (docs/finik/SPEC.md §0.1). */
export const payPageUrl = (webOrigin: string, token: string): string => `${webOrigin}/pay/${token}`;
