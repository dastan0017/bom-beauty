import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** React rules on top of the base config (admin). The site uses eslint-config-next instead. */
export const reactConfig = [
  reactHooks.configs.flat['recommended-latest'],
  { languageOptions: { globals: globals.browser } },
];
