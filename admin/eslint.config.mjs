import { baseConfig } from '@bom/config/eslint/base';
import { reactConfig } from '@bom/config/eslint/react';

export default [...baseConfig({ tsconfigRootDir: import.meta.dirname }), ...reactConfig];
