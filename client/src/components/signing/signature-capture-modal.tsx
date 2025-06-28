// Updated to use Professional Signature Capture System
import { ProfessionalSignatureCapture } from './professional-signature-capture';

interface SignatureCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureData: string, method: 'draw' | 'upload' | 'type') => void;
  participantName: string;
  signatureType: 'signature' | 'initial';
}

export function SignatureCaptureModal({
  isOpen,
  onClose,
  onSave,
  participantName,
  signatureType
}: SignatureCaptureModalProps) {
  // Enhanced professional signature capture with full compliance
  const handleProfessionalSave = (signatureData: string, metadata: any) => {
    // Extract method from metadata for backward compatibility
    const method = metadata.method as 'draw' | 'upload' | 'type';
    onSave(signatureData, method);
    onClose();
  };

  return (
    <ProfessionalSignatureCapture
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleProfessionalSave}
      participantName={participantName}
      participantId={`participant_${Date.now()}`} // In real app, this would come from props
      sessionId={`session_${Date.now()}`} // In real app, this would come from props
      signatureType={signatureType === 'initial' ? 'initial' : 'signature'}
      required={true}
    />
  );
} 