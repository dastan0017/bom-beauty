# Handoff: Bom Beauty — client revisions (October 2026)

## Overview
Bom Beauty (Nurai Bekieva, Bishkek) sells professional Korean skincare via a mobile-first site that sends orders to WhatsApp. The client's direction for this round: **sell complete care programs, not single jars**. Make the home page programs-first, make ordering easy for "lazy" clients, and let people order several products at once. This document lists **every change since the previous design**, screen by screen.

Assumption: the codebase currently matches `reference/before/Bom Beauty Prototype.dc.html`. Where it differs, follow the behaviour described here.

## About the design files
Files in `reference/` are **HTML design prototypes**: a mobile web app inside a phone frame, with inline styles and the logic in a `class Component` at the bottom of each file. They show the intended look and behaviour; they are **not production code**. Recreate the changes in this codebase's existing stack, components and data layer. To view a prototype, open it in a browser (keep `support.js` and `image-slot.js` next to it). Photos are not included and show as placeholders.

In the prototypes, `localStorage` stands in for the backend (`bb-cart`, `bb-home`, `bb-programs`, …). Use the codebase's real storage/API instead.

## Fidelity
High-fidelity. Use the exact copy, colours, sizes and behaviour below. Design width is a 390px mobile viewport, and all values are CSS px at that width. All UI copy is Russian and must be used **verbatim**.

---

## 0. Global

### Background colour
- Page background (`--bg`): **#FEF6F8** (was #FAF7F8).
- Hero top glow: `radial-gradient(120% 340px at 50% 0%, #FCEEF3 0%, rgba(254,246,248,0) 100%)`. The transparent stop must match the new background, otherwise an edge shows.
- Use the same value in the admin's colour-preset preview.

### Tokens in use (default theme)
- bg **#FEF6F8** (new) · surface #FFFFFF · surface-2 #F2F3F8 · line #E6E8F0 · line-2 #EEF0F5 · line-hover #CDD1E2
- ink #14142B · muted #5B5F7A
- accent #D12F63 · accent-ink #B3264F · accent-soft #FBE0EA · halo rgba(209,47,99,.09) · accent-shadow rgba(209,47,99,.5)
- Radii: cards use the existing card-radius token (22px fallback); buttons and chips are pills (999px).
- Section title (h2): 26px / 600 / line-height 1.15 / letter-spacing −0.035em / `text-wrap: balance`.
- Section subtitle: 16px / 1.5 / muted.
- Home sections are spaced with 56px top padding.

### Fonts & external links
- Onest 400/600/700 (already used): https://fonts.googleapis.com/css2?family=Onest:wght@400;600;700&display=swap
- **New:** Noto Sans KR 500, subset to the single glyph 봄 (hero pill): https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500&text=%EB%B4%84&display=swap
- **New:** South Korea flag (hero trust row): https://flagcdn.com/kr.svg (or save it locally as `assets/flags/kr.svg`).

### Russian plurals
- товар / товара / товаров: 1 товар, 2–4 товара, 5–20 товаров, 21 товар… (11–14 → товаров).
- средство / средства / средств: same rule (already exists).

---

## 1. Home page

New block order, top to bottom:
1. Hero (changed)
2. **Готовые программы ухода** (new)
3. **Каталог** (new)
4. Профессиональный уход vs масс-маркет (rewritten as two columns)
5. Программы собираю я (unchanged)
6. Отзывы (unchanged)
7. **Бестселлеры BOM BEAUTY** (new rail)
8. **Новинки** (new rail)
9. **Выбор клиник Сеула** (new rail)
10. Footer (unchanged)

**Removed:** the three entry cards (Готовые программы ухода / Каталог / Для оптовиков). The header tabs already cover these, and blocks 2–3 replace them.

### 1.1 Hero
Keep the avatar/video and the h1 «Время расцвета и сияния вашей кожи с профессиональной косметикой». Changes:
- **Top pill:** replace «Доставка по Бишкеку и СНГ» with **«봄 (BOM) — Весна»**.
  - Size: 34px tall, padding 0 16px, pill radius, gap 8px.
  - Style: bg accent-soft, text 15px/600 accent-ink, nowrap.
  - «봄» is Noto Sans KR 500 17px with line-height 1; «(BOM) — Весна» is Onest.
- **Remove** the old CTA group: «Выбрать программу ухода», «Не уверены, какая программа подойдёт? Ответьте на 4 простых вопроса», «Подобрать уход за 1 минуту».
- **Add 3 trust rows.** Layout: column, gap 12px, margin-top 22px, text left-aligned. Each row: a 24px icon column, gap 12px, text 15px/600/1.35 ink.
  1. KR flag image 22×16, radius 3, ring `0 0 0 1px rgba(19,35,63,.14)`, with «100% оригинал из Южной Кореи».
  2. Flask line icon (20px, stroke 1.9, accent), with «Профессиональные составы».
  3. Truck line icon (same style), with «Доставка по Кыргызстану и СНГ».
- **One CTA button** below the rows.
  - Size and style: margin-top 26px, full width, min-height 64px, padding 10px 16px, pill radius, bg accent, shadow `0 16px 30px -14px rgba(209,47,99,.5)`. Hover: brightness .95. Active: scale .985.
  - Content (centred, gap 14px): a 40px circle `rgba(255,255,255,.22)` holding a white 20px wand/sparkle icon, then two text lines: **«Подобрать программу ухода»** 17px/600/1.2 and «за 1 минуту» 15px/400/1.25.
  - Tap → opens the quiz (§2).
- While the home cart pill is visible (§7.3), the hero's padding-top animates from 26px to 72px (`transition: padding-top .25s ease`) so the pill doesn't cover the avatar.

### 1.2 Готовые программы ухода (programs grid)
- **Header** (centred, gap 16px): h2 «Готовые программы ухода», subtitle «Полный уход под вашу проблему кожи — в одном наборе».
- **Grid:** 2 columns `minmax(0,1fr)`, gap 10px, all 8 programs (§3) in admin order.
- **Card:** white, 1px line border, card radius, overflow hidden. Hover: line-hover border. Active: scale .98. Tap → program page.
  - Cover photo, aspect-ratio 5/4, object-fit cover. It comes from the program's admin cover (§9), with a neutral placeholder until uploaded.
  - Optional program badge, top-right 8px: white pill 24px tall, padding 0 9px, shadow `0 2px 8px rgba(14,14,44,.12)`, 12px/600 accent-ink, 10px sparkle icon.
  - Video-length chip, bottom-left 8px: 24px pill, bg rgba(14,14,44,.62), white 12px/600, 9px play icon, e.g. «2:00».
  - Body (padding 12px 12px 14px, gap 4px):
    - title 16px/600/1.25, letter-spacing −0.01em
    - symptom 13px/1.4 muted
    - bottom row (margin-top auto, padding-top 8px): price 15px/600 on the left, a 28px surface-2 circle with an arrow on the right
- **Quiz banner under the grid:** bg accent-soft, card radius, padding 14px 14px 14px 16px, gap 12px. Tap → quiz.
  - Contents: 22px accent sparkle icon; «Не знаете, что выбрать?» 16px/600 over «Пройдите тест — подберём программу за 1 минуту» 14px muted; a 36px white circle with an arrow.

### 1.3 Каталог card
- **Container:** section padding 56px 16px 0. One card: white, 1px line border, card radius, overflow hidden.
- **Image** on top, aspect-ratio 2/1 (`assets/photos/entry-catalog.jpg`). Tap → catalog (all).
- **Body** (padding 18px 18px 20px, gap 14px): h2 «Каталог» (26px, left-aligned), then «Средства по отдельности — с ценой, описанием и составом» 15px/1.5 muted.
- **Category chips** (wrap, gap 8px): Очищение, Тонеры, Сыворотки, Кремы, SPF.
  - Style: 40px outline pills, padding 0 14px, 1px line border, white, 14px/600 ink.
  - Tap → catalog filtered by that category.
- **Button «Открыть каталог →»:** 52px, full width, 1.5px ink border, white, 16px/600 ink. Hover: surface-2. Tap → catalog (all).

### 1.4 Профессиональный уход vs масс-маркет (rewrite, two columns)
- **Header** (centred): h2 «Профессиональный уход vs масс-маркет», subtitle «Корейская косметика бывает разного уровня».
- **Layout:** CSS grid with 2 equal columns, column-gap 8px, `grid-template-rows: repeat(5, auto)`. Each card spans 5 rows and uses `grid-template-rows: subgrid` (row-gap 16px), so matching points line up across the two cards.
- **Left card:** bg surface-2, 1px line border, card radius, padding 16px 12px 18px.
  - Header: «Обычная косметика» 12px/600 muted, then «Масс-маркет» 16px/600/1.25.
- **Right card:** white, 1.5px accent border, card radius, padding 16px 12px 18px, shadow `0 24px 44px -32px rgba(209,47,99,.5)`.
  - Header: «BOM BEAUTY» 12px/600 accent-ink (letter-spacing 0.02em), then «Профессиональная косметика» 16px/600/1.25.
- **Point row** (gap 8px): an 18px circle icon, a title 14px/600/1.3 and a text 13px/1.45 muted.
  - Left card icon: ✕ in muted on a line-colour circle.
  - Right card icon: white ✓ on an accent circle.
- **Removed:** the round «vs» badge and the line «Формулы глубокого действия из Южной Кореи».

Copy, verbatim (title — text), row by row:

| Масс-маркет | BOM BEAUTY |
|---|---|
| **Низкая концентрация (3–5%)** — В составе преобладают вода, базы и отдушки. | **Высокая концентрация (до 30–50%)** — Терапевтические дозы PDRN, пептидов, экзосом и др. |
| **Поверхностный эффект** — Крупные молекулы не проникают в глубокие слои кожи. | **Глубокое действие** — Часто используют запатентованные комплексы доставки веществ вглубь кожи. |
| **Формулы «для всех»** — Не способны решить конкретные проблемы (акне, пигмент, морщины). | **Работа с проблемой** — Направленный уход против высыпаний, пигментации, старения и др. |
| **Временный результат** — Работает, только пока нанесён на кожу. | **Накопительный результат** — Восстанавливает и обновляет кожу на клеточном уровне. |

### 1.5 Product rails: Бестселлеры BOM BEAUTY → Новинки → Выбор клиник Сеула
Three identical horizontal rails come after Отзывы, in this order. A rail is hidden when its list is empty.
- **Header row** (section padding-top 56px; row padding 0 20px; space-between; aligned to the bottom):
  - h2 (26px, left-aligned)
  - link «Каталог →» 15px/600 accent-ink with a 44px tap height. Tap → catalog.
- **Scroller:** flex, gap 10px, padding 0 16px 4px, `overflow-x: auto`, `scroll-snap-type: x mandatory`, scroll-padding 0 16px, hidden scrollbar.
- **Card:** 164px wide, padding 8px 8px 10px, 1px line border, card radius, white, snaps at its start.
  - Photo: square (1:1), radius = card radius − 8px, bg surface-2. Badge top-left 8px (same badge style as §1.2).
  - Body (padding 10px 4px 0): brand 13px muted; name 15px/600/1.3 with margin-top 2px; price 16px/600 with margin-top auto and padding-top 10px.
  - Tap on photo or body → product page.
  - Button (margin-top 10px, 40px tall): **«В корзину»**, outline style (1px line border, white, 14px/600 ink).
  - Once the product is in the cart, the button becomes a stepper: 40px pill, bg accent-soft, padding 0 3px, white 34px round − / + buttons, centre label «N шт.» 15px/600 accent-ink. Going to 0 removes the product.
- Which products appear is set per product in the admin (§9). Demo defaults (product ids):
  - Бестселлеры: cica, pdrn, foam, aquatoner, spf, gel
  - Новинки: ronas, barrier, oil, wtoner
  - Выбор клиник Сеула: ronas, wserum, barrier, bha, wtoner, cream

### 1.6 «Новинка» label
- **Where it shows:** a product in the Новинки list carries the label **«Новинка»** everywhere product badges appear: home rails, catalog cards, «С этим средством ещё берут», and the product page.
- **Priority:** a card shows one label only, and «Новинка» wins over the product's own badge (e.g. «Хит продаж», «Выбор Нурайым») until it is switched off in the admin.
- **Not built:** automatic expiry after N days. This waits on the client's answer.

---

## 2. Quiz «Подобрать программу ухода за 1 минуту»
- **Rename** the quiz (intro title and aria-label) from «Выбрать программу за 1 минуту» to **«Подобрать программу ухода за 1 минуту»**.
- **Answer option labels:** 16px / **400** / line-height 1.4, `text-wrap: pretty` (they were 600; the answers are long now).
- **Questions** (single choice each; `id = label`, verbatim):

**goal — Какую главную задачу вы хотите решить в первую очередь?**
- acne = Избавиться от высыпаний, чёрных точек и закрытых комедонов
- pigment = Уменьшить пигментацию, постакне и выровнять тон
- age = Повысить упругость, разгладить морщины и подтянуть овал
- calm = Снять красноту, шелушения, зуд и чувствительность
- glow = Вернуть сияние «уставшей» и тусклой коже, глубоко увлажнить

**skin — Как ведёт себя ваша кожа спустя 2–3 часа после умывания?**
- oily = Появляется сильный жирный блеск по всему лицу
- combo = Блестит только Т-зона (лоб, нос, подбородок), а на щеках комфортно
- dry = Чувствуется стянутость, хочется скорее нанести крем
- sens = Кожа краснеет, реагирует на воду или смену температуры
- normal = Всё в порядке, нет явного дискомфорта

**exp — Использовали ли вы ранее активную профессиональную косметику (кислоты, ретинол, пептиды)?**
- pro = Да, регулярно пользуюсь активным уходом, кожа привыкла
- some = Пробовала отдельные средства, но нет чёткой системы
- new = Почти не пользовалась / Кожа очень чувствительная, легко раздражается

**age — Укажите ваш возраст**
- u25 = До 25 лет · 25 = 25–35 лет · 35 = 35–45 лет · 45 = 45+ лет

### Matching
For each published program that has a goal:
- **Goal:** +10 if `program.goal == answer.goal`; otherwise +4 if `program.goal` is in `RELATED[answer.goal]`.
- **Skin:** +3 if `program.skins` includes `answer.skin`. An answer of `combo` also matches programs tagged `oily`.
- **No skins set:** +2 if the program has no skins.
- **Sensitive bonus:** +3 extra if `answer.skin == sens` and `program.goal == calm`.

Keep programs scoring 5 or more, sort by score (descending, ties in admin order) and take the top 3. If none qualify, fall back to the first 3 programs.

`RELATED = { acne: [pigment], pigment: [acne, glow], age: [glow, pigment], calm: [glow], glow: [calm, age] }`

Answers to «exp» and «age» aren't used for matching. They go to Nurai in the WhatsApp message.

### Result screen
- **Top block (centred):**
  - a 64px accent-soft circle with a 28px accent sparkle icon
  - h2 **«Отлично!»** (30px, margin-top 18px)
  - «Мы проанализировали ваши ответы и подобрали идеальную схему ухода под вашу проблему» 16px/1.5 muted, balanced
- **Program list** (margin-top 24px, gap 10px), 1–3 cards:
  - **Card 1, recommended:** 1.5px accent border plus `box-shadow: 0 0 0 4px rgba(209,47,99,.09)`. Badge on top: **«Рекомендуем для вас»** (26px pill, accent-soft bg, 13px/600 accent-ink, 11px sparkle icon).
  - **Before card 2:** the label **«Также могут подойти»** 15px/600 muted, margin-top 14px.
  - **Cards 2–3:** 1px line border, no shadow.
  - **Every card:** white, card radius, padding 16px, gap 12px.
    - Top row: title 18px/600 and symptom 14px muted on the left; price 18px/600 nowrap on the right.
    - Divider: 1px line-2.
    - Bottom row: up to 5 product thumbs (26px, radius 8, overlapping by −7px, 2px white ring) with «5 средств» 14px muted; on the right «Подробнее ›» 14px/600 accent-ink.
  - **Tap** → program page, which shows the existing «К результатам теста» back chip.
- **Below the list:** «Сомневаетесь, какую выбрать?» 15px muted, centred, margin-top 28px; then the existing WhatsApp button and the existing «Пройти заново».
- **Removed:** the previous single-result layout, the grey «Ваша программа» card with the video thumbnail, and any price-level choice («Выберите вариант по бюджету»).

WhatsApp message (from the button under the list):
~~~
Здравствуйте, Нурайым! Прошла тест «Подобрать программу ухода за 1 минуту» на сайте.
— Задача: <goal answer label>
— Кожа через 2–3 часа после умывания: <skin answer label>
— Активная косметика: <exp answer label>
— Возраст: <age answer label>
Сайт предложил: «<title 1>», <price 1>; «<title 2>», <price 2>. Помогите выбрать, пожалуйста.
~~~

---

## 3. Programs (now 8)
Changes: two programs are renamed and three are new. Each program has these fields:
- id, goal, skins
- title, symptom, h1b (the «Уход при …» phrase)
- price, video duration, course
- items (product ids)
- fit (3 bullets)
- am/pm steps (`[productId, instruction]`)

The AM/PM steps are **no longer shown on the program page**, but they feed the care-scheme PDF (§4).

| id | title | symptom | price, сом | goal | skins | items |
|---|---|---|---|---|---|---|
| acne | **Акне и постакне** (was «Акне и проблемная кожа») | Воспаления, высыпания и следы постакне | 5 900 | acne | combo, normal, dry | foam, bha, cica, gel, spf |
| dry | Сухость и обезвоженность | Стянутость, шелушения, тусклый цвет лица | 6 700 | glow | dry, normal | foam, aquatoner, barrier, cream, spf |
| pigment | Пигментация | Пятна после солнца и следы постакне | 6 900 | pigment | dry, oily, combo, normal | foam, wtoner, wserum, gel, spf |
| sensitive | Чувствительная кожа | Покраснения и реакция на новые средства | 7 200 | calm | sens | foam, cica, barrier, cream, spf |
| lifting | **Анти-эйдж и лифтинг** (was «Лифтинг и сияние с PDRN») | Морщинки, потеря упругости, «овал плывёт» | 7 900 | age | dry, normal, combo | foam, aquatoner, pdrn, cream, spf |
| pores | **Чёрные точки и поры** (new) | Забитые поры, закрытые комедоны, жирный блеск | 5 400 | acne | oily, combo | oil, foam, bha, gel, spf |
| glow | **Тусклая кожа и сияние** (new) | Уставший вид, серый тон, нет сияния | 7 900 | glow | oily, combo, normal | foam, wtoner, ronas, gel, spf |
| recovery | **Восстановление барьера** (new) | Шелушения, зуд, жжение после кислот и процедур | 8 200 | calm | dry, normal, sens | foam, barrier, pdrn, cream, spf |

The full seed data (fit bullets, h1b, course, AM/PM steps with instructions) is `const PROGRAMS` in `reference/after/Bom Beauty Prototype.dc.html`. Product ids: foam, oil, bha, aquatoner, wtoner, cica, wserum, pdrn, ronas, barrier, gel, cream, spf (`const P` in the same file).

---

## 4. Program page
- **Removed:** the «Программа ухода» section (morning/evening routine steps).
- **Do not add** a price-level picker («Выберите вариант программы»).
- **Ordering:** «Заказать программу» (and the video end-screen CTA) opens the order sheet in **direct mode** (§7.4). The program is **not** added to the cart.
- **«Схема ухода» card** at the end of the page (renamed from «Протокол ухода»), with the button **«Скачать схему ухода»**:
  - **If the admin uploaded a PDF** for the program, download that file. Meta line: «Пошаговая схема от Нурайым · PDF, <size>».
  - **Otherwise, generate a one-page A4 PDF on the fly.** Meta line: «Пошаговая схема · PDF». File name: «Схема ухода — <program title>.pdf».
  - **PDF layout** (portrait, 100px side margins at 1240px canvas width), top to bottom:
    1. «BOM BEAUTY» 34px/700 accent on the left; «Схема ухода от Нурайым» 26px muted on the right.
    2. Program title 60px/700 ink (wraps).
    3. «N средств · <course>» 30px muted.
    4. A 4px accent rule.
    5. «Утро» and «Вечер» blocks (headings 42px/700) with numbered steps: a 44px accent circle with a white number, product name 30px/600, instruction 26px muted (wrapped). If a program has no steps, list its products instead.
    6. Footer: a rule, then «Вопросы по уходу — WhatsApp +<number>» on the left and «bom-beauty.com» on the right (24px muted).
  - **Production note:** the prototype draws on a canvas and wraps the JPEG in a minimal PDF. In production, prefer a real PDF library (e.g. pdf-lib / jsPDF with Onest embedded for Cyrillic) or server-side generation, so the text stays selectable.
  - **On failure:** show «Не получилось открыть файл. Напишите Нурайым — она пришлёт схему в WhatsApp» with a WhatsApp link. Message: «Здравствуйте, Нурайым! Пришлите, пожалуйста, схему ухода по программе «<title>».»
- **Wording:** «протокол» becomes «схема ухода» everywhere, on the site and in the admin.

---

## 5. Catalog page
- **Subtitle:** «Корейская профессиональная косметика» (was «Корейская косметика для ежедневного ухода»).
- **Two chip rows,** each with a 13px/600 muted label: **«По проблеме»** (new), then «По типу средства».
  - **По проблеме:** «Все проблемы» plus the 8 program titles. Horizontal scroll; 44px chips, padding 0 18px, nowrap.
    - Active chip: filled with the existing chip colour, white 15px/600.
    - Idle chip: white, 1px line border, 15px/400.
  - **По типу средства:** unchanged (Все, Очищение, Тонеры, Сыворотки, Кремы, SPF).
  - **Filters combine:** choosing a problem shows only products that belong to that program.
- **Program banner** under the chips when a problem is selected (padding 16px 16px 0). It nudges clients towards the complete program.
  - Style: accent-soft card, card radius, padding 12px 14px 12px 12px.
  - Contents: a 64×51 cover thumb (radius 10), then the program title and price.
  - Tap → program page.
- **Product cards:** «Заказать» becomes «В корзину», then a stepper (same as §1.5).
- **Bottom cart bar** on this page only (§7.2).

---

## 6. Product page
New order below the price block: **«С этим средством ещё берут»** → «Входит в программы» → «Описание» → **«Состав»** (new) → «Как использовать».

### 6.1 «С этим средством ещё берут»
- **Placement and look:** right under the price, padding-top 28px, gap 12px. h2 22px/600/1.2 with padding 0 20px.
- **Cards:** the same scroller and card as §1.5, but the button label is **«Добавить»**. It becomes the stepper once the product is added.
- **Which products:** up to 6, never the open product, no duplicates.
  1. First, the other products of the programs that contain this product, in program order.
  2. Then fill from the Бестселлеры and Выбор клиник Сеула lists.

### 6.2 «Состав»
- **Card:** white, 1px line border, card radius, padding 18px 18px 20px, gap 8px.
- **Text:** title 17px/600; body 16px/1.55 muted.
- **Rules:** hidden when empty; the content comes from the new product field `comp` (admin §9).

### 6.3 Bottom bar: "order this product (+ extras)", not a cart
- **Nothing is added up front:** the open product is NOT added to the cart until the client taps order.
- **Layout:** sticky at the bottom; column, gap 10px; padding 12px 16px plus the bottom safe area.
  1. **Extras list,** shown only if the cart holds other items:
     - Label «Добавлено к заказу» 13px/600 muted.
     - List with max-height 156px (about 3 rows), scrolling beyond that. Rows have min-height 52px, with a 1px line-2 separator between them.
     - Row contents: a 40px photo (radius 10); name 14px/600 (ellipsis); line price (price × qty) 13px muted; a stepper with 40px round buttons (1px line border, white).
     - At qty 1 the minus becomes a trash icon that removes the item. Qty label 15px/600, min-width 24px.
  2. **Order row:** the existing qty stepper for the open product, then the order button (flex 1, min-width 0). The button label has two lines:
     - top, 13px/500: **«Заказать»** with no extras, or **«Заказать вместе»** with extras
     - bottom, 17px/600: the total = product price × qty + extras total
- **On tap:** add the open product to the cart with the chosen qty (if it isn't there yet), then open the order sheet in cart mode (§7.4). If the open product is already in the cart, the stepper edits its cart quantity directly.
- **"Extras"** means every cart line except the open product, including items added on other pages. It's one shared order.
- **Bottom spacing:** reserve space for the taller bar: base bar height (88px on phones) + 30px + min(n, 3) × 52px, where n is the number of extras.

---

## 7. Cart & ordering

### 7.1 Model
- **Products only:** the cart holds products (`productId`, qty 1–20). Programs never go into the cart.
- **Persistence:** the cart survives reloads (prototype: localStorage `bb-cart`) and is emptied after a cart order is sent.

### 7.2 Catalog bottom bar (catalog page only, cart not empty)
- **When:** while the cart has items, this bar replaces the «Подобрать уход за 1 минуту» sticky bar on the catalog. Home and programs keep that bar.
- **Bar:** bg rgba(255,255,255,.97), 1px line top border, padding 10px 16px plus the safe area.
- **Button:** 56px pill, accent, shadow `0 14px 26px -14px rgba(209,47,99,.5)`. Hover: brightness .94. Tap → order sheet (cart mode).
  - Left: a 22px bag icon with a white count badge (min 18px, 11px/700 accent-ink, offset top −6 / right −8).
  - Middle: «Корзина · N товаров» 13px, with the total 17px/600 below it.
  - Right: a chip «Оформить →» (40px tall, rgba(255,255,255,.2), 15px/600).

### 7.3 Home floating cart pill (home page only, cart not empty)
- **Not in the header:** there is no header cart icon.
- **Position:** it floats just under the sticky header, top-right, in a stack at `top: calc(100% + 10px); right: 12px` relative to the header (column, aligned to the end, gap 8px). It shares this stack with the existing «К результатам теста» pill.
- **Pill:** 48px tall, padding 0 16px 0 14px, gap 12px, pill radius, accent, shadow `0 14px 26px -12px rgba(209,47,99,.5)`. Active: scale .97. Tap → order sheet (cart mode).
  - Left: a 19px bag icon with a white count badge (16px, 10px/700 accent-ink, offset top −6 / right −7).
  - Right: «Корзина · N товара» 12px/1.2, with the total 15px/600 below it, in the current currency.
- **Visibility:** shown only while the cart has products. While it's visible, the hero gets extra top padding (§1.1).

### 7.4 Order sheet
The sheet has two modes.

**Cart mode** (opened from the pill, the catalog bar or the product page):
- **Lines** sit in a panel (bg = page bg, radius 16, padding 2px 12px), separated by 1px line-2.
  - First row: a 52px photo (radius 12); name 15px/600; meta «<brand> · <volume>» 13px muted.
  - Second row, indented 64px: a stepper (40px round outline buttons, trash icon at qty 1), qty 16px/600, and the line total 16px/600 on the right.
- **Row under the list** (space-between):
  - «+ Добавить ещё средства» 15px/600 accent-ink, 44px tall. On the catalog it closes the sheet; elsewhere it navigates to the catalog.
  - **«Очистить»**: outlined pill, 44px tall, padding 0 16px, 1.5px line-hover border, white, 15px/600 ink, trash icon. Hover: ink border. Active: surface-2 bg. It clears the cart immediately, with no confirmation.
- **Empty state:**
  - a 60px surface-2 circle with a bag icon
  - «Корзина пока пуста» 18px/600
  - «Выберите готовую программу или отдельные средства» 15px muted
  - two buttons: «Готовые программы» (52px, accent) and «Каталог» (52px, outline)
- **Total:** the sum of all lines, plus the existing «Сумма в сомах: …» line when the currency isn't KGS.

**Direct mode** (program order):
- **Line:** a single line «Программа «<title>»» with meta «N средств · курс на …» and a qty stepper (min 1, no trash).
- **No extras:** no «Добавить ещё средства» and no «Очистить».
- **Cart untouched:** nothing is saved to the cart, and the cart stays as it was after sending.

**Both modes:** the form (name, phone, address) and its validation are unchanged. The success screen's back button reads **«Продолжить покупки»**.

### 7.5 WhatsApp order message
~~~
Здравствуйте! Хочу заказать:
• <name> × <qty> — <line total>      ← one bullet per line; "× qty" only when qty > 1
Итого: <total>                        ← only when there are 2+ lines

Имя: …
Телефон: …
Адрес: …
Сумма в сомах: …                      ← only when currency ≠ KGS
~~~

---

## 8. Header
- **No cart icon** in the header.
- **Narrow-phone overflow fix** (keep it):
  - header row gap 8px
  - logo `flex: 0 1 auto; min-width: 0; object-fit: contain; object-position: left center` (it may shrink a few px)
  - right-side group `flex: none`, gap 4px
  - currency switcher padding 0 6px 0 2px, gap 4px

---

## 9. Admin panel (`reference/after/BomAdmin.dc.html`)

**Product editor**
- **New card «На главной странице»**, with the hint «Блоки с фото и ценами под отзывами. На сайте появится после сохранения».
  - It has 3 switches (44×26, white 20px knob): «Бестселлеры BOM BEAUTY», «Выбор клиник Сеула», «Новинки и метка «Новинка»».
  - They are saved with the product and drive the rails (§1.5) and the label (§1.6).
- **New textarea «Состав»**, placeholder «Например: ниацинамид, пантенол, гиалуроновая кислота».

**Program editor**
- **New card «Фото для главной»**: «Карточка программы в блоке «Готовые программы ухода»», with a 5:4 image upload (drag or click).
- **Quiz goal** (one per program):
  - acne «Высыпания, чёрные точки, комедоны»
  - pigment «Пигментация, постакне, неровный тон»
  - age «Упругость, морщины, овал лица»
  - calm «Краснота, шелушения, чувствительность»
  - glow «Тусклая кожа: сияние и увлажнение»
- **Skin types** (multi-select): oily «Жирная», combo «Комбинированная», dry «Сухая», sens «Чувствительная», normal «Нормальная».
- **Migration:** a stored goal `barrier` becomes `calm` if the skins include `sens`, otherwise `glow`.
- **«Схема ухода» PDF card** (renamed from «Протокол ухода»):
  - Description: «… На сайте — кнопка «Скачать схему ухода» в конце страницы программы».
  - Empty-state hint: «До 20 МБ. Пока файла нет, сайт сам соберёт схему из средств и шагов программы».

**Programs list:** seed the 3 new programs (pores, glow, recovery) for existing installs, and apply the 2 renames.

---

## 10. Data model summary
- **Product:**
  - new field `comp: string`
  - new home flags `best`, `seoul`, `fresh` (booleans, or ordered id lists per section)
  - displayed badge = `fresh ? «Новинка» : product.badge`
- **Program:**
  - new field `cover` (image)
  - `goal` ∈ {acne, pigment, age, calm, glow}
  - `skins` ⊆ {oily, combo, dry, sens, normal}
  - 3 new seed programs; 2 renamed
- **Cart:** `[{ productId, qty }]`, persisted per visitor.
- **Direct order:** transient `{ programId, qty }`.

---

## 11. Assets (the owner will upload these)
Images are not included in this bundle. Use these paths (or the codebase's media system), and show a neutral placeholder when a file is missing:
- **Program covers,** 5:4 (≥ 1000×800): `assets/programs/acne.jpg`, `pores.jpg`, `pigment.jpg`, `lifting.jpg`, `glow.jpg`, `dry.jpg`, `sensitive.jpg`, `recovery.jpg`. They're used on the home cards, the catalog problem banner and order lines, and as the poster on the programs list.
- **Catalog card image,** 2:1 (≥ 1200×600): `assets/photos/entry-catalog.jpg`.
- **Product photos:** the existing product images.
- **KR flag:** https://flagcdn.com/kr.svg (or `assets/flags/kr.svg`).
- **Icons:** simple 24-grid line icons (stroke 1.9–2.2, round caps): bag, trash, plus, minus, arrow, chevron, flask, truck, sparkle, wand. Use the codebase's icon set where it has equivalents.

---

## 12. Removed / do not build
- **Program price levels:** Базовая / Оптимальная / Максимальная, «Выберите вариант программы» (program page) and «Выберите вариант по бюджету» (quiz). The prototype still contains dormant `TIERS` / `recTier` code; ignore it.
- **Programs in the cart.**
- **Header cart icon.**
- **«Программа ухода»** (the AM/PM section on the program page).
- **Home entry cards** (including «Для оптовиков») and the «vs» badge.
- **Prototype-only** parts: the phone frame and the demo state-jump menu.

## 13. Open questions / notes
- **«Новинка» auto-expiry** (e.g. after 30 days): waiting for the client.
- **Stale copy:** the hero-video end screen still says «4 готовые программы ухода с видео Нурайым», but there are 8 programs now. Confirm the wording with the client.
- **Shared order (intended):** product-page extras include items added elsewhere.

## 14. Acceptance checklist
- [ ] **Background** is #FEF6F8, and the hero glow fades into it without an edge.
- [ ] **Home** order matches §1, and the entry cards are gone.
- [ ] **Programs grid** has 8 cards with cover, price and video chip, plus the quiz banner under the grid.
- [ ] **Mass vs pro** shows two columns with rows aligned across them at 360–430px widths.
- [ ] **Rails** run Бестселлеры → Новинки → Выбор клиник Сеула; empty rails are hidden; «Новинка» overrides other badges.
- [ ] **Quiz** has the 4 new questions; the result shows «Отлично!», the recommended card and «Также могут подойти»; no price levels anywhere.
- [ ] **Program page:** no «Программа ухода» and no level picker; «Заказать программу» opens the direct sheet and leaves the cart untouched; «Скачать схему ухода» downloads the uploaded PDF or a generated one.
- [ ] **Catalog:** new subtitle; «По проблеме» chips filter products and show the program banner; «В корзину» turns into a stepper; the bottom cart bar shows only here.
- [ ] **Home cart pill** (count + total) shows only while the cart has items; the hero shifts down; no header cart icon.
- [ ] **Product page:**
  - [ ] upsell rail under the price with «Добавить»
  - [ ] «Состав» section
  - [ ] bottom bar with the «Добавлено к заказу» list (− / + / trash)
  - [ ] button «Заказать» / «Заказать вместе» with the total
  - [ ] nothing overflows at 360px
- [ ] **Order sheet:** lines with steppers, «Добавить ещё средства», «Очистить», empty state; the WhatsApp text lists every line plus «Итого».
- [ ] **Admin:** 3 home switches, «Состав», program cover, new quiz goals and skins, «Схема ухода» wording; changes show on the site after saving.

## Files
- `reference/after/Bom Beauty Prototype.dc.html`: the revised site (all screens, mobile).
- `reference/after/BomAdmin.dc.html`: the revised admin.
- `reference/before/Bom Beauty Prototype.dc.html`: the site before these revisions, for diffing.
- `support.js`, `image-slot.js`: runtime, needed only to open the prototypes in a browser.

Useful search anchors in `reference/after/Bom Beauty Prototype.dc.html`:
- Home: `Готовые программы ухода</h2>`, `Профессиональный уход vs масс-маркет`, `bestRail`, `freshRail`, `seoulRail`
- Quiz: `const QUIZ`, `quizScore`
- Programs and catalog: `const PROGRAMS`, `probChips`
- Product page: `relOf(`, `pExtras`
- Cart and ordering: `hdrCart`, `cartBar`, `sheetLines`, `orderDirect`, `clearCart`
- Care scheme and labels: `genScheme`, `bdg(`
