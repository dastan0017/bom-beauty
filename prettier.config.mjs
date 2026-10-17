import base from '@bom/config/prettier';

/** @type {import('prettier').Config} */
export default {
  ...base,
  overrides: [
    { files: 'frontend/**', options: { tailwindStylesheet: './frontend/src/app/globals.css' } },
    { files: 'admin/**', options: { tailwindStylesheet: './admin/src/index.css' } },
  ],
};
