import { MainLayout } from '@/components/layout/main-layout';
import { EmailSettings } from '@/components/admin/email-settings';

export default function EmailSettingsPage() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <EmailSettings />
      </div>
    </MainLayout>
  );
} 