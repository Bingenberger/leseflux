-- Unique constraint: ein Text pro Titel + Klassenstufe
CREATE UNIQUE INDEX "Text_title_targetLevel_key" ON "Text"("title", "targetLevel");

-- Unique constraint: ein Satz pro Diagnostik
CREATE UNIQUE INDEX "DiagnosticItem_diagnosticId_sentence_key" ON "DiagnosticItem"("diagnosticId", "sentence");
