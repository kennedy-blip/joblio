import { JobDetail } from '@/components/job-detail';

export default function JobPage({ params }: { params: { id: string } }) {
  return <JobDetail id={params.id} />;
}
