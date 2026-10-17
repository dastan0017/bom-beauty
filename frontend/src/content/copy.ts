// Every static UI string of the client site (CLAUDE.md). Owner-editable texts come from the API.

export const copy = {
  meta: {
    siteName: 'Bom Beauty',
    description:
      'Профессиональная корейская косметика и готовые программы ухода от Нурайым. Доставка по Бишкеку и СНГ.',
  },
  header: {
    logoAlt: 'Bom Beauty',
    whatsapp: 'WhatsApp',
    tabs: { catalog: 'Каталог', programs: 'Программы', wholesale: 'Оптовикам' },
  },
  hero: {
    toPrograms: 'Выбрать программу ухода',
    toQuiz: 'Подобрать уход за 1 минуту',
  },
  placeholder: 'Раздел в разработке.',
  /** Used until the `home` content block is wired up in M2. Verbatim from the design. */
  homeFallback: {
    badge: 'Доставка по Бишкеку и СНГ',
    titleBefore: 'Время ',
    titleAccent: 'расцвета',
    titleAfter: ' и сияния вашей кожи',
    subtitle: 'с профессиональной косметикой',
    quizPrompt: 'Не уверены, какая программа подойдёт? Ответьте на 4 простых вопроса',
  },
} as const;
