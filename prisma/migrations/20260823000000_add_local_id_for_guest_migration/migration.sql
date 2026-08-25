-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "localId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "localId" TEXT;

-- AlterTable
ALTER TABLE "GeneratedSuggestion" ADD COLUMN     "localId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Goal_localId_key" ON "Goal"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_localId_key" ON "Task"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedSuggestion_localId_key" ON "GeneratedSuggestion"("localId");
