import { MainLayout } from '@/components/layout/main-layout';
import { JobWizard } from '@/components/job/job-wizard';

export default function CreateJob() {
  return (
    <MainLayout>
      <JobWizard singlePage />
    </MainLayout>
  );
}
