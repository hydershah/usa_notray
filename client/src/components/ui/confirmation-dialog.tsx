import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Info, AlertCircle } from "lucide-react";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning' | 'info';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  default: {
    iconColor: "text-blue-500",
    confirmButtonVariant: "default" as const,
    defaultIcon: <Info className="h-6 w-6" />
  },
  destructive: {
    iconColor: "text-red-500",
    confirmButtonVariant: "destructive" as const,
    defaultIcon: <Trash2 className="h-6 w-6" />
  },
  warning: {
    iconColor: "text-yellow-500",
    confirmButtonVariant: "default" as const,
    defaultIcon: <AlertTriangle className="h-6 w-6" />
  },
  info: {
    iconColor: "text-blue-500",
    confirmButtonVariant: "default" as const,
    defaultIcon: <AlertCircle className="h-6 w-6" />
  }
};

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
  icon
}: ConfirmationDialogProps) {
  const styles = variantStyles[variant];
  const displayIcon = icon || styles.defaultIcon;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 ${styles.iconColor}`}>
              {displayIcon}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            variant={styles.confirmButtonVariant}
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 