export const dynamic = 'force-dynamic';
import { WorkQueueConsole } from "@/components/dashboard/work-queue-console";

export const metadata = {
  title: "운영 콘솔 | LabAxis",
};

export default function WorkQueuePage() {
  return <WorkQueueConsole />;
}
