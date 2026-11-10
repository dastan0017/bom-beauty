-- Quiz goals and skin types become the owner's lists (D47). The rows start as the design's (packages/shared DEFAULT_QUIZ)
-- with its rules as settings, so the quiz ranks exactly as before; programs keep their keys.

-- CreateTable
CREATE TABLE "quiz_goals" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "related" TEXT[],
    "bonus_skins" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quiz_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skin_types" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "also_matches" TEXT[],
    "avoid_max" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "skin_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quiz_goals_key_key" ON "quiz_goals"("key");

-- CreateIndex
CREATE UNIQUE INDEX "skin_types_key_key" ON "skin_types"("key");

-- The design's lists (verbatim answers; admin names from the former labels).
INSERT INTO "quiz_goals" ("id", "key", "name", "answer", "order", "related", "bonus_skins", "updated_at") VALUES
  (gen_random_uuid(), 'acne', 'Высыпания, чёрные точки, комедоны', 'Избавиться от высыпаний, чёрных точек и закрытых комедонов', 0, ARRAY['pigment'], ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'pigment', 'Пигментация, постакне, неровный тон', 'Уменьшить пигментацию, постакне и выровнять тон', 1, ARRAY['acne', 'glow'], ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'age', 'Упругость, морщины, овал лица', 'Повысить упругость, разгладить морщины и подтянуть овал', 2, ARRAY['glow', 'pigment'], ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'calm', 'Краснота, шелушения, чувствительность', 'Снять красноту, шелушения, зуд и чувствительность', 3, ARRAY['glow'], ARRAY['sens'], CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'glow', 'Тусклая кожа: сияние и увлажнение', 'Вернуть сияние «уставшей» и тусклой коже, глубоко увлажнить', 4, ARRAY['calm', 'age'], ARRAY[]::TEXT[], CURRENT_TIMESTAMP);

INSERT INTO "skin_types" ("id", "key", "name", "answer", "order", "also_matches", "avoid_max", "updated_at") VALUES
  (gen_random_uuid(), 'oily', 'Жирная', 'Появляется сильный жирный блеск по всему лицу', 0, ARRAY[]::TEXT[], false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'combo', 'Комбинированная', 'Блестит только Т-зона (лоб, нос, подбородок), а на щеках комфортно', 1, ARRAY['oily'], false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'dry', 'Сухая', 'Чувствуется стянутость, хочется скорее нанести крем', 2, ARRAY[]::TEXT[], false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sens', 'Чувствительная', 'Кожа краснеет, реагирует на воду или смену температуры', 3, ARRAY[]::TEXT[], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'normal', 'Нормальная', 'Всё в порядке, нет явного дискомфорта', 4, ARRAY[]::TEXT[], false, CURRENT_TIMESTAMP);

-- Programs keep their values as plain keys.
ALTER TABLE "programs" ALTER COLUMN "quiz_goal" TYPE TEXT USING "quiz_goal"::TEXT;
ALTER TABLE "programs" ALTER COLUMN "quiz_skins" TYPE TEXT[] USING "quiz_skins"::TEXT[];

-- DropEnum
DROP TYPE "QuizGoal";

-- DropEnum
DROP TYPE "SkinType";

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_quiz_goal_fkey" FOREIGN KEY ("quiz_goal") REFERENCES "quiz_goals"("key") ON DELETE SET NULL ON UPDATE CASCADE;
