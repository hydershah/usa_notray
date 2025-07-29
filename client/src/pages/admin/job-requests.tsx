import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { JobRequestManager } from '../../components/admin/JobRequestManager';

export default function AdminJobRequestsPage() {
  return (
    <MainLayout hideSidebar={true}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <JobRequestManager />
        </div>
      </div>
    </MainLayout>
  );
} 