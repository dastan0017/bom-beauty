// Light entry for browser bundles (`@bom/shared/web`): helpers without zod schemas or the phone-number library, so
// pages that never open a form stay small. Forms import the full `@bom/shared` and are loaded on demand.
export * from './enums';
export * from './limits';
export * from './labels';
export * from './money';
export * from './currency';
export * from './theme';
export * from './quiz';
export * from './whatsapp';
export * from './plural';
export * from './slug';
export * from './text';
export * from './search';
export * from './time';
