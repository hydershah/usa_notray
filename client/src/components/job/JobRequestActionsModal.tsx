import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { CheckCircle, Hash, User, X } from 'lucide-react';

interface JobRequestActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (action: 'id_code' | 'admin_self', notaryCode?: string, rejectionNotes?: string) => void;
  title?: string;
}

export function JobRequestActionsModal({
  isOpen,
  onClose,
  onAssign,
  title = "Job Request Actions"
}: JobRequestActionsModalProps) {
  const [selectedAction, setSelectedAction] = useState<'id_code' | 'admin_self'>('id_code');
  const [notaryCode, setNotaryCode] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');

  const handleSubmit = () => {
    onAssign(selectedAction, notaryCode, rejectionNotes);
    onClose();
  };

  const handleCancel = () => {
    setSelectedAction('id_code');
    setNotaryCode('');
    setRejectionNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-1">
                  Approve, reject, or assign this job request.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Action Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Assignment Method</Label>
            <RadioGroup value={selectedAction} onValueChange={(value: 'id_code' | 'admin_self') => setSelectedAction(value)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Enter Notary ID Code */}
                <Card className={`cursor-pointer transition-colors ${
                  selectedAction === 'id_code' ? 'ring-2 ring-blue-500 border-blue-200' : 'hover:border-gray-300'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="id_code" id="id_code" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Hash className="h-4 w-4 text-blue-600" />
                          <Label htmlFor="id_code" className="text-sm font-semibold text-gray-900 cursor-pointer">
                            Enter Notary ID Code
                          </Label>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">Assign a specific notary using their ID code</p>
                        <div className="flex items-center text-xs text-blue-600">
                          <User className="w-3 h-3 mr-1" />
                          Direct assignment by code
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Assign Myself as Notary */}
                <Card className={`cursor-pointer transition-colors ${
                  selectedAction === 'admin_self' ? 'ring-2 ring-purple-500 border-purple-200' : 'hover:border-gray-300'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="admin_self" id="admin_self" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-purple-600" />
                          <Label htmlFor="admin_self" className="text-sm font-semibold text-gray-900 cursor-pointer">
                            Assign Myself as Notary
                          </Label>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">You will be the notary for this job</p>
                        <div className="flex items-center text-xs text-purple-600">
                          <User className="w-3 h-3 mr-1" />
                          Direct admin control
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </RadioGroup>
          </div>

          {/* Notary ID Code Input */}
          {selectedAction === 'id_code' && (
            <div className="space-y-2">
              <Label htmlFor="notaryCode" className="text-sm font-medium text-gray-700">
                Notary ID Code
              </Label>
              <Input
                id="notaryCode"
                value={notaryCode}
                onChange={(e) => setNotaryCode(e.target.value.toUpperCase())}
                placeholder="CY0123"
                className="h-10 uppercase"
                maxLength={6}
              />
              <p className="text-xs text-gray-500">Format: CY#### (e.g., CY0123)</p>
            </div>
          )}

          {/* Rejection Notes */}
          <div className="space-y-2">
            <Label htmlFor="rejectionNotes" className="text-sm font-medium text-gray-700">
              Notes (Optional)
            </Label>
            <Textarea
              id="rejectionNotes"
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Add any notes or instructions..."
              className="min-h-[80px] max-h-[120px] resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              These notes will be included in the assignment notification.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 pt-4 border-t flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedAction === 'id_code' && !notaryCode.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700"
          >
            Assign Notary
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 