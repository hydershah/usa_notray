import { useState } from 'react';
import { useLocation } from 'wouter';
import { MainLayout } from '@/components/layout/main-layout';
import { JobTable } from '@/components/job/job-table';

export default function Jobs() {
  const [, setLocation] = useLocation();

  const handleCreateJob = () => {
    setLocation('/create-job');
  };

  return (
    <MainLayout>
      <JobTable onCreateJob={handleCreateJob} />
    </MainLayout>
  );
}
