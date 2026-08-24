-- DropForeignKey
ALTER TABLE "parent_profile" DROP CONSTRAINT "parent_profile_userId_fkey";

-- AddForeignKey
ALTER TABLE "parent_profile" ADD CONSTRAINT "parent_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
