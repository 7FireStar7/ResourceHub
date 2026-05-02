-- Добавление новых полей для периода доступности
ALTER TABLE resources ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;