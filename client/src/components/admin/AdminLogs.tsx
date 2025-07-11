import React from 'react';
import { SystemLogsView } from './SystemLogsView';

export function AdminLogs() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
          <p className="text-gray-600 mt-2">View and analyze system activity and audit logs</p>
        </div>
      </div>

      {/* System Logs Component */}
      <SystemLogsView />
    </div>
  );
} 