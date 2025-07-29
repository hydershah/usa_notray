import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { MyJobRequests } from '../components/job-request/MyJobRequests';
import { Button } from '../components/ui/button';
import { Plus } from 'lucide-react';
import { useLocation } from 'wouter';

export default function MyJobRequestsPage() {
  const [, setLocation] = useLocation();

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                My Job Requests
              </h1>
              <p className="text-gray-600">
                Track the status of your submitted notarization requests
              </p>
            </div>
            <Button onClick={() => setLocation('/job-request')}>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>

          <MyJobRequests />
        </div>
      </div>
    </MainLayout>
  );
} 