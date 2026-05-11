ALTER TABLE "DiagnosticAnswer" ADD CONSTRAINT "DiagnosticAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DiagnosticItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;
