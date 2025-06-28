import React from 'react';
import { useLocation } from 'wouter';
import { LiveSigningSession } from '@/components/signing/live-signing-session';

export default function LiveSigning() {
  const [, setLocation] = useLocation();
  
  // Extract job ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = parseInt(urlParams.get('jobId') || '1');

  const handleComplete = () => {
    setLocation('/jobs');
  };

  const handleCancel = () => {
    setLocation('/jobs');
  };

  return (
    <LiveSigningSession 
      jobId={jobId}
      onComplete={handleComplete}
      onCancel={handleCancel}
    />
  );
}