// Demo catalog and texts taken verbatim from design/Bom Beauty Prototype.dc.html (P, PROGRAMS, page copy) and
// design/BomAdmin.dc.html (PROGRAMS0 descriptions). The owner replaces it in the admin (docs/HANDOFF.md).
import type { ContentValue, QuizGoal, SkinType } from '@bom/shared';

export const CATEGORIES = [
  { slug: 'cleansing', name: 'Очищение' },
  { slug: 'toners', name: 'Тонеры' },
  { slug: 'serums', name: 'Сыворотки' },
  { slug: 'creams', name: 'Кремы' },
  { slug: 'spf', name: 'SPF' },
] as const;

export const BRANDS = [
  { slug: 'dr-sgn', name: 'Dr. SGN' },
  { slug: 'dr-sgnbio', name: 'Dr. SGNBIO' },
  { slug: 'merikit', name: 'Merikit' },
  { slug: 'tups-laboratories', name: 'TUPS Laboratories' },
  { slug: 'ronas', name: 'Ronas' },
] as const;

type CategorySlug = (typeof CATEGORIES)[number]['slug'];
type BrandSlug = (typeof BRANDS)[number]['slug'];

export interface SeedProduct {
  key: string;
  slug: string;
  category: CategorySlug;
  brand: BrandSlug;
  name: string;
  shortName: string;
  volume: string;
  priceKgs: number;
  purpose: string;
  description: string;
  howToUse: string;
  badge?: string;
}

export const PRODUCTS: SeedProduct[] = [
  {
    key: 'foam',
    slug: 'dr-sgn-centella-cleansing-foam',
    category: 'cleansing',
    brand: 'dr-sgn',
    name: 'Пенка для умывания с центеллой',
    shortName: 'Пенка для умывания',
    volume: '150 мл',
    priceKgs: 1100,
    purpose: 'Мягко очищает, не стягивает',
    description:
      'Нежная пенка с экстрактом центеллы азиатской. Убирает себум и загрязнения, не нарушая защитный барьер кожи. Подходит для ежедневного умывания утром и вечером.',
    howToUse:
      'Вспеньте небольшое количество с водой, помассируйте влажную кожу 30–40 секунд и смойте тёплой водой.',
  },
  {
    key: 'oil',
    slug: 'merikit-cleansing-oil',
    category: 'cleansing',
    brand: 'merikit',
    name: 'Гидрофильное масло',
    shortName: 'Гидрофильное масло',
    volume: '200 мл',
    priceKgs: 1400,
    purpose: 'Растворяет макияж и SPF',
    description:
      'Лёгкое масло для первого этапа очищения. Растворяет стойкий макияж, солнцезащитный крем и себум, после смывания не оставляет плёнки.',
    howToUse:
      'Нанесите 2–3 нажатия на сухую кожу и помассируйте. Добавьте немного воды до эмульсии, смойте и умойтесь пенкой.',
  },
  {
    key: 'bha',
    slug: 'tups-bha-toner',
    category: 'toners',
    brand: 'tups-laboratories',
    name: 'Тонер с BHA-кислотой',
    shortName: 'Тонер с BHA',
    volume: '200 мл',
    priceKgs: 1600,
    purpose: 'Помогает очистить поры',
    description:
      'Тонер с салициловой кислотой мягко отшелушивает и помогает очистить поры. Подходит для жирной и комбинированной кожи.',
    howToUse:
      'Вечером после умывания нанесите на ватный диск и протрите кожу, избегая области вокруг глаз. Начинайте с 2–3 раз в неделю, утром — обязательно SPF.',
  },
  {
    key: 'aquatoner',
    slug: 'merikit-hydrating-toner',
    category: 'toners',
    brand: 'merikit',
    name: 'Увлажняющий тонер',
    shortName: 'Увлажняющий тонер',
    volume: '200 мл',
    priceKgs: 1500,
    purpose: 'Снимает стянутость после умывания',
    description:
      'Увлажняющий тонер с гиалуроновой кислотой. Возвращает коже комфорт после умывания и готовит её к следующим шагам ухода.',
    howToUse:
      'Нанесите ладонями на чистую кожу лёгкими похлопывающими движениями. Для сухой кожи — в 2–3 слоя.',
  },
  {
    key: 'wtoner',
    slug: 'dr-sgn-white-snow-return-toner',
    category: 'toners',
    brand: 'dr-sgn',
    name: 'White Snow Return Toner',
    shortName: 'Осветляющий тонер',
    volume: '150 мл',
    priceKgs: 1700,
    purpose: 'Выравнивает тон кожи',
    description:
      'Тонер с ниацинамидом помогает выровнять тон и придать коже сияние. Мягкая формула для ежедневного использования.',
    howToUse: 'Утром и вечером после умывания нанесите ладонями или ватным диском.',
  },
  {
    key: 'cica',
    slug: 'dr-sgn-cica-serum',
    category: 'serums',
    brand: 'dr-sgn',
    name: 'Успокаивающая cica-сыворотка',
    shortName: 'Cica-сыворотка',
    volume: '50 мл',
    priceKgs: 1900,
    purpose: 'Помогает уменьшить покраснения',
    description:
      'Сыворотка с центеллой и пантенолом успокаивает кожу и помогает уменьшить покраснения. Подходит для чувствительной и проблемной кожи.',
    howToUse: 'Нанесите 2–3 капли после тонера, распределите по лицу и дайте впитаться.',
    badge: 'Хит продаж',
  },
  {
    key: 'wserum',
    slug: 'dr-sgn-white-snow-return-serum',
    category: 'serums',
    brand: 'dr-sgn',
    name: 'White Snow Return Serum',
    shortName: 'Осветляющая сыворотка',
    volume: '50 мл',
    priceKgs: 3200,
    purpose: 'Помогает сделать пятна светлее',
    description:
      'Сыворотка для неровного тона: при регулярном использовании помогает сделать светлее пятна после солнца и следы постакне.',
    howToUse: 'Вечером после тонера нанесите 2–3 капли. Днём используйте SPF — без него пятна возвращаются.',
  },
  {
    key: 'pdrn',
    slug: 'dr-sgn-pdrn-perfect-ampoule',
    category: 'serums',
    brand: 'dr-sgn',
    name: 'PDRN Perfect Ampoule',
    shortName: 'PDRN-ампула',
    volume: '30 мл',
    priceKgs: 3900,
    purpose: 'Плотность и упругость',
    description: 'Ампула с PDRN помогает коже выглядеть более плотной, упругой и отдохнувшей.',
    howToUse: 'Вечером после тонера нанесите 2–3 капли и мягко вбейте подушечками пальцев.',
    badge: 'Выбор Нурайым',
  },
  {
    key: 'ronas',
    slug: 'ronas-stem-cell-z-serum',
    category: 'serums',
    brand: 'ronas',
    name: 'Stem Cell Z Serum',
    shortName: 'Сыворотка Stem Cell',
    volume: '50 мл',
    priceKgs: 4800,
    purpose: 'Упругость и сияние',
    description:
      'Сыворотка со стволовыми клетками растений для упругости и сияния кожи. Лёгкая текстура быстро впитывается.',
    howToUse: 'Утром или вечером после тонера нанесите небольшое количество на лицо и шею.',
  },
  {
    key: 'barrier',
    slug: 'dr-sgnbio-skin-barrier-therapy-serum',
    category: 'serums',
    brand: 'dr-sgnbio',
    name: 'Skin Barrier Therapy Serum',
    shortName: 'Барьерная сыворотка',
    volume: '50 мл',
    priceKgs: 2600,
    purpose: 'Помогает восстановить барьер',
    description:
      'Сыворотка с керамидами помогает восстановить защитный барьер кожи и уменьшить ощущение сухости и дискомфорта.',
    howToUse: 'Утром и вечером после тонера нанесите 2–3 капли.',
  },
  {
    key: 'gel',
    slug: 'merikit-moisture-cream-gel',
    category: 'creams',
    brand: 'merikit',
    name: 'Увлажняющий крем-гель',
    shortName: 'Крем-гель',
    volume: '50 мл',
    priceKgs: 1500,
    purpose: 'Увлажняет без жирной плёнки',
    description: 'Лёгкий крем-гель для жирной и комбинированной кожи. Увлажняет и не оставляет липкости.',
    howToUse: 'Последним шагом ухода нанесите на лицо небольшое количество крема.',
  },
  {
    key: 'cream',
    slug: 'dr-sgnbio-ceramide-cream',
    category: 'creams',
    brand: 'dr-sgnbio',
    name: 'Питательный крем с керамидами',
    shortName: 'Крем с керамидами',
    volume: '50 мл',
    priceKgs: 1800,
    purpose: 'Питает и смягчает сухую кожу',
    description:
      'Питательный крем для сухой и обезвоженной кожи. Помогает удерживать влагу и смягчает шелушения.',
    howToUse: 'Нанесите на завершающем этапе ухода. Вечером можно нанести слой потолще.',
  },
  {
    key: 'spf',
    slug: 'dr-sgnbio-sun-fluid-spf50',
    category: 'spf',
    brand: 'dr-sgnbio',
    name: 'Солнцезащитный флюид SPF 50+',
    shortName: 'Флюид SPF 50+',
    volume: '50 мл',
    priceKgs: 1300,
    purpose: 'Лёгкая защита на каждый день',
    description:
      'Лёгкий флюид с высокой защитой от UVA и UVB. Не оставляет белых следов и подходит под макияж.',
    howToUse: 'Утром последним шагом ухода, за 15 минут до выхода. На солнце обновляйте каждые 2–3 часа.',
  },
];

type ProductKey = (typeof PRODUCTS)[number]['key'];

export interface SeedProgram {
  slug: string;
  title: string;
  headline: string;
  symptom: string;
  description: string;
  course: string;
  priceKgs: number;
  quizGoal: QuizGoal;
  quizSkins: SkinType[];
  items: ProductKey[];
  fit: string[];
  am: [ProductKey, string][];
  pm: [ProductKey, string][];
}

export const PROGRAMS: SeedProgram[] = [
  {
    slug: 'acne',
    title: 'Акне и проблемная кожа',
    headline: 'акне и проблемной коже',
    symptom: 'Воспаления, чёрные точки, жирный блеск',
    description:
      'Готовая программа из 5 средств: утро и вечер, курс на 6–8 недель. Помогает уменьшить воспаления и чёрные точки без пересушивания.',
    course: 'Утро и вечер, курс на 6–8 недель',
    priceKgs: 5900,
    quizGoal: 'acne',
    quizSkins: ['oily', 'normal'],
    items: ['foam', 'bha', 'cica', 'gel', 'spf'],
    fit: [
      'Регулярно появляются воспаления и покраснения',
      'Кожа жирная или комбинированная',
      'Нужен мягкий уход без пересушивания',
    ],
    am: [
      ['foam', 'Мягко очищает и не стягивает кожу'],
      ['cica', 'Помогает уменьшить покраснения'],
      ['spf', 'Защищает от новых пятен постакне'],
    ],
    pm: [
      ['foam', 'Смывает SPF и себум за день'],
      ['bha', 'Помогает очистить поры'],
      ['gel', 'Увлажняет без жирной плёнки'],
    ],
  },
  {
    slug: 'dry-skin',
    title: 'Сухость и обезвоженность',
    headline: 'сухости и обезвоженности',
    symptom: 'Стянутость, шелушения, тусклый цвет лица',
    description: 'Программа из 5 средств для сухой и обезвоженной кожи: утро и вечер, курс на 6–8 недель.',
    course: 'Утро и вечер, курс на 6–8 недель',
    priceKgs: 6700,
    quizGoal: 'barrier',
    quizSkins: ['dry', 'normal'],
    items: ['foam', 'aquatoner', 'barrier', 'cream', 'spf'],
    fit: [
      'Кожа стягивает после умывания',
      'Есть шелушения и тусклый цвет лица',
      'Крем впитывается, а кожа снова сухая',
    ],
    am: [
      ['aquatoner', 'Утром достаточно умыться водой и нанести тонер'],
      ['cream', 'Питает и смягчает кожу на весь день'],
      ['spf', 'Защищает сухую кожу от солнца и ветра'],
    ],
    pm: [
      ['foam', 'Бережно очищает, не пересушивая'],
      ['barrier', 'Помогает восстановить защитный барьер'],
      ['cream', 'Питает кожу за ночь'],
    ],
  },
  {
    slug: 'pigmentation',
    title: 'Пигментация',
    headline: 'пигментации',
    symptom: 'Пятна после солнца и следы постакне',
    description: 'Программа из 5 средств для ровного тона: курс на 8 недель.',
    course: 'Утро и вечер, курс на 8 недель',
    priceKgs: 6900,
    quizGoal: 'pigment',
    quizSkins: ['dry', 'oily', 'normal'],
    items: ['foam', 'wtoner', 'wserum', 'gel', 'spf'],
    fit: [
      'Остались следы после высыпаний',
      'Появились пятна после солнца',
      'Хочется ровный тон без плотного тонального',
    ],
    am: [
      ['foam', 'Бережно очищает, не раздражая кожу'],
      ['wtoner', 'Выравнивает тон и готовит кожу к уходу'],
      ['spf', 'Главный шаг: без SPF пятна возвращаются'],
    ],
    pm: [
      ['foam', 'Смывает SPF и загрязнения за день'],
      ['wserum', 'Помогает сделать пятна светлее'],
      ['gel', 'Увлажняет и смягчает кожу'],
    ],
  },
  {
    slug: 'sensitive-skin',
    title: 'Чувствительная кожа',
    headline: 'чувствительной коже',
    symptom: 'Покраснения и реакция на новые средства',
    description: 'Бережная программа из 5 средств для чувствительной кожи: курс на 6–8 недель.',
    course: 'Утро и вечер, курс на 6–8 недель',
    priceKgs: 7200,
    quizGoal: 'barrier',
    quizSkins: ['sens'],
    items: ['foam', 'cica', 'barrier', 'cream', 'spf'],
    fit: [
      'Кожа легко краснеет и раздражается',
      'Реагирует на новые средства и смену погоды',
      'Нужен простой и бережный уход',
    ],
    am: [
      ['cica', 'Успокаивает кожу с утра'],
      ['cream', 'Смягчает и защищает от сухости'],
      ['spf', 'Защищает чувствительную кожу от солнца'],
    ],
    pm: [
      ['foam', 'Бережно очищает без стянутости'],
      ['barrier', 'Помогает укрепить защитный барьер'],
      ['cream', 'Возвращает коже комфорт за ночь'],
    ],
  },
  {
    slug: 'lifting',
    title: 'Лифтинг и сияние с PDRN',
    headline: 'возрастных изменениях',
    symptom: 'Морщинки, потеря упругости, «овал плывёт»',
    description:
      'Программа из 5 средств с PDRN-ампулой: утро и вечер, курс на 8 недель. Для упругости, плотности и сияния кожи.',
    course: 'Утро и вечер, курс на 8 недель',
    priceKgs: 7900,
    quizGoal: 'age',
    quizSkins: ['dry', 'normal'],
    items: ['foam', 'aquatoner', 'pdrn', 'cream', 'spf'],
    fit: [
      'Появились морщинки и потеря упругости',
      'Хочется подтянутый овал и сияние',
      'Кожа выглядит уставшей и тусклой',
    ],
    am: [
      ['aquatoner', 'Увлажняет и готовит кожу к уходу'],
      ['cream', 'Питает и смягчает кожу на весь день'],
      ['spf', 'Защищает от фотостарения'],
    ],
    pm: [
      ['foam', 'Бережно очищает, не пересушивая'],
      ['pdrn', 'Помогает коже выглядеть плотнее и упругее'],
      ['cream', 'Восстанавливает кожу за ночь'],
    ],
  },
];

export const HOME_CONTENT: ContentValue<'home'> = {
  heroBadge: 'Доставка по Бишкеку и СНГ',
  heroTitle: 'Время *расцвета* и сияния вашей кожи',
  heroSubtitle: 'с профессиональной косметикой',
  quizPrompt: 'Не уверены, какая программа подойдёт? Ответьте на 4 простых вопроса',
  greetingVideoId: null,
  entries: [
    {
      key: 'programs',
      title: 'Готовые программы ухода',
      text: 'Полный уход под вашу проблему кожи',
      imageMediaId: null,
    },
    {
      key: 'catalog',
      title: 'Каталог',
      text: 'Корейская косметика для ежедневного ухода',
      imageMediaId: null,
    },
    {
      key: 'wholesale',
      title: 'Для оптовиков',
      text: 'Профессиональная косметика для вашего бизнеса',
      imageMediaId: null,
    },
  ],
  comparison: {
    title: 'Профессиональный уход vs масс-маркет',
    subtitle: 'Корейская косметика бывает разного уровня',
    mass: {
      eyebrow: 'Обычный',
      title: 'Масс-маркет',
      points: ['Низкая концентрация активов', 'Поверхностное увлажнение', 'Временный эффект'],
    },
    pro: {
      eyebrow: 'Bom Beauty',
      title: 'Проф. космецевтика',
      points: [
        'Высокая концентрация активов',
        'Работает в глубоких слоях кожи',
        'Накопительный, видимый результат',
      ],
    },
  },
  about: {
    caption: 'Программы собираю я',
    text: 'Мой путь в бьюти начался не с бизнес-идеи, а с личной боли. В 2017 году, переехав в Южную Корею, я поставила точку в 7-летней борьбе за чистую кожу. Именно тогда я открыла для себя профессиональный сегмент ухода, где работает наука, а не реклама.',
    stats: [
      { value: 'С 2017', label: 'живу в Корее' },
      { value: 'С 2022', label: 'подбираю уход клиентам' },
    ],
  },
  reviewsTitle: 'Отзывы',
  reviewsSubtitle: 'Переписки с клиентами — листайте и нажмите, чтобы открыть',
};

export const WHOLESALE_FEATURED: ProductKey[] = [
  'pdrn',
  'ronas',
  'wserum',
  'wtoner',
  'aquatoner',
  'foam',
  'oil',
];

export const WHOLESALE_CONTENT: Omit<ContentValue<'wholesale'>, 'featuredProductIds'> = {
  phone: '',
  whatsapp: null,
  eyebrow: 'Для косметологов, клиник и магазинов',
  title: 'Профессиональная корейская космецевтика *для вашего бизнеса*',
  subtitle: 'Ваш надёжный эксперт и прямой поставщик высокоэффективных протоколов в Бишкеке',
  facts: ['Наличие в Бишкеке', 'Подбор ассортимента', 'Доставка в 4 страны'],
  quote: 'Я не просто продаю банки — я передаю вам работающие решения для ваших клиентов и пациентов',
  intro: [
    'Здравствуйте! Я Нурайым.',
    'Живу в Корее с 2017 года и работаю напрямую с заводами корейской космецевтики. Помогаю косметологам и клиникам подбирать высокомаржинальные протоколы ухода с доказанной эффективностью.',
  ],
  stats: [
    { value: 'С 2017', label: 'живу в Корее' },
    { value: 'С 2022', label: 'работаю с космецевтикой' },
    { value: '7 лет', label: 'личный опыт борьбы с акне' },
    { value: 'Напрямую', label: 'с заводами Кореи' },
  ],
  expertise: ['Составы', 'Активные компоненты', 'Протоколы ухода'],
  benefits: [
    { title: 'Наличие в Бишкеке', text: 'Ходовые позиции на складе, остальное — под заказ' },
    { title: 'Готовые протоколы', text: 'Протоколы процедур и помощь с ассортиментом' },
    { title: 'Маржа выше масс-маркета', text: 'Процедуры и домашний уход приносят больше' },
    { title: 'Клиенты возвращаются', text: 'Высокая концентрация активов даёт видимый эффект' },
  ],
  steps: [
    { title: 'Запрос прайса', text: 'Напишите в WhatsApp — пришлю оптовый прайс и каталог брендов' },
    { title: 'Подбор ассортимента', text: 'Помогу выбрать средства и протоколы под ваш бизнес' },
    { title: 'Заказ', text: 'Ходовые позиции — сразу со склада, остальное — под заказ' },
    { title: 'Доставка', text: 'В Кыргызстан, Казахстан, Узбекистан и Россию' },
  ],
  stockNote: 'Ходовые позиции — в наличии на складе в Бишкеке',
  delivery: [
    { region: 'Кыргызстан, Казахстан, Узбекистан', flags: ['kg', 'kz', 'uz'], airDays: '7', seaDays: '15' },
    { region: 'Россия · Москва', flags: ['ru'], airDays: '10–14', seaDays: '20–30' },
  ],
  catalogMediaId: null,
  videoId: null,
};

// Our own texts below (not in the design): no em-dashes; gaps marked [...] and listed in docs/HANDOFF.md.
export const DELIVERY_CONTENT: ContentValue<'delivery'> = {
  programFacts: [
    { label: 'Доставка по Бишкеку', value: 'в день оплаты' },
    { label: 'По Кыргызстану и СНГ', value: '3–7 дней' },
    { label: 'Оплата', value: '100% предоплата' },
  ],
  markdown: [
    '## Доставка',
    '',
    '- **Бишкек:** в день оплаты.',
    '- **Кыргызстан и страны СНГ:** 3–7 дней.',
    '',
    '## Оплата',
    '',
    '100% предоплата по реквизитам, которые Нурайым пришлёт в WhatsApp после заказа. Отправляем сразу после оплаты.',
    '',
    '[Способы оплаты и стоимость доставки: уточнить у владелицы]',
  ].join('\n'),
  faq: [],
};

export const PRIVACY_CONTENT: ContentValue<'privacy'> = {
  markdown:
    '# Политика конфиденциальности\n\n[Текст политики конфиденциальности: прислать владелице, лучше после проверки юристом]',
};

export const OFFER_CONTENT: ContentValue<'offer'> = {
  markdown:
    '# Публичная оферта\n\n[Текст публичной оферты: прислать владелице, лучше после проверки юристом]',
};

/** Dev-only demo orders, from ORDERS0 in design/BomAdmin.dc.html. `daysAgo`/`time` are Asia/Bishkek. */
export const DEMO_ORDERS: {
  name: string;
  phone: string;
  item: { type: 'product' | 'program'; key: string };
  qty: number;
  city: string;
  daysAgo: number;
  time: string;
  status: 'new' | 'sent' | 'cancelled';
}[] = [
  {
    name: 'Айгерим Т.',
    phone: '+996 555 12 34 56',
    item: { type: 'program', key: 'acne' },
    qty: 1,
    city: 'Бишкек',
    daysAgo: 0,
    time: '12:41',
    status: 'new',
  },
  {
    name: 'Нургуль Б.',
    phone: '+996 700 48 21 90',
    item: { type: 'program', key: 'pigmentation' },
    qty: 1,
    city: 'Бишкек',
    daysAgo: 0,
    time: '12:05',
    status: 'new',
  },
  {
    name: 'Сабина Р.',
    phone: '+7 701 334 12 08',
    item: { type: 'program', key: 'dry-skin' },
    qty: 1,
    city: 'Алматы',
    daysAgo: 0,
    time: '11:32',
    status: 'new',
  },
  {
    name: 'Мээрим С.',
    phone: '+996 772 90 14 33',
    item: { type: 'product', key: 'cica' },
    qty: 2,
    city: 'Ош',
    daysAgo: 0,
    time: '10:58',
    status: 'new',
  },
  {
    name: 'Асель К.',
    phone: '+996 555 76 02 11',
    item: { type: 'program', key: 'acne' },
    qty: 1,
    city: 'Бишкек',
    daysAgo: 0,
    time: '10:14',
    status: 'sent',
  },
  {
    name: 'Жанара О.',
    phone: '+996 709 11 45 67',
    item: { type: 'program', key: 'sensitive-skin' },
    qty: 1,
    city: 'Бишкек',
    daysAgo: 0,
    time: '09:47',
    status: 'sent',
  },
  {
    name: 'Динара А.',
    phone: '+7 777 210 33 45',
    item: { type: 'program', key: 'pigmentation' },
    qty: 1,
    city: 'Астана',
    daysAgo: 0,
    time: '09:20',
    status: 'cancelled',
  },
  {
    name: 'Бермет Н.',
    phone: '+996 551 66 70 02',
    item: { type: 'product', key: 'spf' },
    qty: 1,
    city: 'Каракол',
    daysAgo: 1,
    time: '18:52',
    status: 'sent',
  },
  {
    name: 'Айгерим Т.',
    phone: '+996 555 12 34 56',
    item: { type: 'product', key: 'gel' },
    qty: 1,
    city: 'Бишкек',
    daysAgo: 1,
    time: '16:10',
    status: 'sent',
  },
  {
    name: 'Камила Ж.',
    phone: '+996 707 33 22 11',
    item: { type: 'program', key: 'dry-skin' },
    qty: 1,
    city: 'Бишкек',
    daysAgo: 1,
    time: '14:03',
    status: 'sent',
  },
  {
    name: 'Нургуль Б.',
    phone: '+996 700 48 21 90',
    item: { type: 'product', key: 'wserum' },
    qty: 1,
    city: 'Бишкек',
    daysAgo: 3,
    time: '19:22',
    status: 'sent',
  },
  {
    name: 'Элина М.',
    phone: '+7 705 118 90 44',
    item: { type: 'program', key: 'acne' },
    qty: 1,
    city: 'Алматы',
    daysAgo: 3,
    time: '11:45',
    status: 'sent',
  },
];
