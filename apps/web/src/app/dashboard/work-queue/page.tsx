export const dynamic = 'force-dynamic';
import { WorkQueueConsole } from "@/components/dashboard/work-queue-console";

export const metadata = {
  title: "운영 콘솔 | LabAxis",
};

export default function WorkQueuePage() {
  return (
    // §dashboard-padding-unify — 셸 패딩 제거에 따라 위임 콘솔에 자체 패딩 부여.
    <div className="p-4 md:p-8">
      <WorkQueueConsole />
    </div>
  );
}
