import React, { useState } from 'react';
import { Button } from '../ui/button';
import { JobRequestActionsModal } from './JobRequestActionsModal';
import { toast } from 'sonner';

export function JobRequestActionsExample() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAssign = (action: 'id_code' | 'admin_self', notaryCode?: string, notes?: string) => {
    console.log('Assignment action:', { action, notaryCode, notes });
    
    if (action === 'id_code') {
      toast.success(`Assigned to notary with code: ${notaryCode}`);
    } else {
      toast.success('Assigned to yourself as notary');
    }
    
    if (notes) {
      toast.info(`Notes added: ${notes}`);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">Job Request Actions Example</h2>
        <p className="text-gray-600 mb-6">
          Click the button below to open the professional job request actions modal.
        </p>
        
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Open Job Request Actions
        </Button>

        <JobRequestActionsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAssign={handleAssign}
        />
      </div>
    </div>
  );
} 