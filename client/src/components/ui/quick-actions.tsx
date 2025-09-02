import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  MoreVertical, 
  Power, 
  PowerOff, 
  Key, 
  UserCheck, 
  UserX, 
  Edit,
  Shield,
  ShieldOff
} from 'lucide-react';

interface QuickStatusToggleProps {
  currentStatus: 'active' | 'inactive' | 'pending' | 'approved' | 'rejected';
  onStatusChange: (newStatus: string) => void;
  type?: 'user' | 'company' | 'approval';
  disabled?: boolean;
}

export function QuickStatusToggle({ currentStatus, onStatusChange, type = 'user', disabled = false }: QuickStatusToggleProps) {
  const getStatusConfig = () => {
    switch (type) {
      case 'user':
        return {
          active: { label: 'Active', color: 'bg-success/10 text-success', icon: Power },
          inactive: { label: 'Inactive', color: 'bg-muted text-muted-foreground', icon: PowerOff },
        };
      case 'company':
        return {
          active: { label: 'Active', color: 'bg-success/10 text-success', icon: Power },
          inactive: { label: 'Inactive', color: 'bg-muted text-muted-foreground', icon: PowerOff },
          pending: { label: 'Pending', color: 'bg-warning/10 text-warning', icon: Shield },
          rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive', icon: ShieldOff },
        };
      case 'approval':
        return {
          pending: { label: 'Pending', color: 'bg-warning/10 text-warning', icon: Shield },
          approved: { label: 'Approved', color: 'bg-success/10 text-success', icon: UserCheck },
          rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive', icon: UserX },
        };
      default:
        return {};
    }
  };

  const statusConfig = getStatusConfig();
  const currentConfig = statusConfig[currentStatus as keyof typeof statusConfig];

  if (!currentConfig) return null;

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    const confirmMessage = newStatus === 'inactive' || newStatus === 'rejected' 
      ? `Are you sure you want to ${newStatus === 'rejected' ? 'reject' : 'deactivate'} this ${type}?`
      : `Are you sure you want to ${newStatus === 'approved' ? 'approve' : 'activate'} this ${type}?`;
    
    if (confirm(confirmMessage)) {
      onStatusChange(newStatus);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
          <currentConfig.icon className="h-4 w-4" />
          <Badge className={currentConfig.color} variant="outline">
            {currentConfig.label}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(statusConfig).map(([status, config]) => (
          <DropdownMenuItem 
            key={status}
            onClick={() => handleStatusChange(status)}
            disabled={status === currentStatus}
            className="gap-2"
          >
            <config.icon className="h-4 w-4" />
            {config.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface QuickActionsMenuProps {
  onEdit?: () => void;
  onPasswordReset?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onDelete?: () => void;
  currentStatus?: string;
  type?: 'user' | 'company';
  disabled?: boolean;
}

export function QuickActionsMenu({ 
  onEdit, 
  onPasswordReset, 
  onStatusChange, 
  onDelete, 
  currentStatus,
  type = 'user',
  disabled = false 
}: QuickActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Details
          </DropdownMenuItem>
        )}
        {onPasswordReset && type === 'user' && (
          <DropdownMenuItem onClick={onPasswordReset} className="gap-2">
            <Key className="h-4 w-4" />
            Reset Password
          </DropdownMenuItem>
        )}
        {onStatusChange && currentStatus && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onStatusChange(currentStatus === 'active' ? 'inactive' : 'active')}
              className="gap-2"
            >
              {currentStatus === 'active' ? (
                <>
                  <PowerOff className="h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="h-4 w-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDelete} 
              className="gap-2 text-red-600 focus:text-red-600"
            >
              <UserX className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  userEmail: string;
  isLoading?: boolean;
}

export function PasswordResetModal({ isOpen, onClose, onSubmit, userEmail, isLoading = false }: PasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length >= 6) {
      onSubmit(newPassword);
      setNewPassword('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Reset Password
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">User Email</Label>
            <Input
              id="email"
              value={userEmail}
              disabled
              className="bg-gray-50"
            />
          </div>
          <div>
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              minLength={6}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || newPassword.length < 6}>
              {isLoading ? 'Updating...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 