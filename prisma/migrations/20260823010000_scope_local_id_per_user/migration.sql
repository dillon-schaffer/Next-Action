-- Fix: localId was globally unique across all users, but it's a client-supplied,
-- unvalidated string used only for idempotent guest migration. A global unique
-- constraint let one user's migration payload collide with another user's
-- existing localId, resolving to that user's row and letting a foreign id
-- (e.g. another user's goal) get referenced from the caller's own new rows
-- (IDOR). Scope uniqueness to (userId, localId) instead.

-- DropIndex
DROP INDEX "Goal_localId_key";

-- DropIndex
DROP INDEX "Task_localId_key";

-- DropIndex
DROP INDEX "GeneratedSuggestion_localId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Goal_userId_localId_key" ON "Goal"("userId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_userId_localId_key" ON "Task"("userId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedSuggestion_userId_localId_key" ON "GeneratedSuggestion"("userId", "localId");
