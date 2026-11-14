// Limits shared by the site and the API (no zod here, so browser bundles can import them from `@bom/shared/web`).

/** Quantity range of one cart or order line (design/updates-2026-10/README.md §7.1). */
export const LINE_QTY_MAX = 20;
/** Distinct lines one order may carry. */
export const ORDER_LINES_MAX = 30;
/** Photos one product may have; the first is the main one (owner request 2026-10-26: more than three). */
export const PRODUCT_IMAGES_MAX = 10;

/** «С этим средством ещё берут»: cards on the product page, chosen by the owner or picked by the site (D49). */
export const PRODUCT_RELATED_MAX = 6;
