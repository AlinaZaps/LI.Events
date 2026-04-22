-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "notifyUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_notifyUserId_fkey" FOREIGN KEY ("notifyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
