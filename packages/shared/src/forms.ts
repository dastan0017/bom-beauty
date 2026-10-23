// Entry for the site's order form (`@bom/shared/forms`): the order schema and phone parsing only, so the form's
// background load does not also build every admin and content schema. The payment page reuses it.
export * from './schemas/orders';
export * from './schemas/payments';
export * from './phone';
