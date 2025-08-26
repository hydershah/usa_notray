import React from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
}

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
}

interface DialogTriggerProps {
  children: React.ReactNode;
  onClick?: () => void;
  asChild?: boolean;
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[1000000] bg-black bg-opacity-50 overflow-y-auto"
      data-dialog-root
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {children}
      </div>
    </div>
  );

  // Render at document.body level to escape any stacking contexts in the editor
  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
};

export const DialogContent: React.FC<DialogContentProps> = ({ className = '', children }) => {
  return (
    <div
      className={`bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] overflow-hidden p-2 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
};

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, onClose, showCloseButton = true, className = '' }) => {
  return (
    <div className={`px-8 py-6 border-b border-gray-100 bg-gray-50/50 relative ${className}`}>
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-500 hover:text-gray-700"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      {children}
    </div>
  );
};

export const DialogTitle: React.FC<DialogTitleProps> = ({ className = '', children }) => {
  return (
    <h2 className={`text-xl font-semibold text-gray-900 leading-tight ${className}`}>
      {children}
    </h2>
  );
};

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children }) => {
  return (
    <p className="mt-2 text-sm text-gray-600 leading-relaxed">
      {children}
    </p>
  );
};

export const DialogTrigger: React.FC<DialogTriggerProps> = ({ children, onClick }) => {
  return (
    <div onClick={onClick}>
      {children}
    </div>
  );
};

export const DialogFooter: React.FC<DialogFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3 ${className}`}>
      {children}
    </div>
  );
};
