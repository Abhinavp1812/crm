-- Admin's "Mark On Leave" form doesn't require an "until" date, so leave can
-- be open-ended. LeaveRecord.endDate was created NOT NULL before that was
-- accounted for - loosen it so an open-ended leave can still be logged.
ALTER TABLE "LeaveRecord" ALTER COLUMN "endDate" DROP NOT NULL;
