import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Loader2, FileText, Calendar, Clock, MapPin, AlertCircle, Upload, X, File, Download } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/queryClient';

const jobRequestSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  documentType: z.string().min(1, 'Document type is required'),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  location: z.string().optional(),
  requestorPhone: z.string().optional(),
});

type JobRequestFormData = z.infer<typeof jobRequestSchema>;

interface DocumentFile {
  file: File;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadProgress?: number;
}

interface JobRequest {
  id: number;
  title: string;
  description: string;
  documentType: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  requestorId: number;
  requestorEmail: string;
  requestorPhone?: string;
  status: 'pending' | 'approved' | 'rejected' | 'assigned' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reviewedBy?: number;
  reviewedAt?: string;
  reviewNotes?: string;
  assignedNotaryId?: number;
  assignedAt?: string;
  assignmentNotes?: string;
  convertedToJobId?: number;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface JobRequestFormProps {
  onSuccess?: () => void;
  editData?: JobRequest | null;
}

export function JobRequestForm({ onSuccess, editData }: JobRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<JobRequestFormData>({
    resolver: zodResolver(jobRequestSchema),
    defaultValues: {
      urgency: 'normal',
    },
  });

  const urgency = watch('urgency');

  // Populate form with edit data when available
  useEffect(() => {
    if (editData) {
      setValue('title', editData.title);
      setValue('description', editData.description);
      setValue('documentType', editData.documentType);
      setValue('urgency', editData.urgency);
      setValue('preferredDate', editData.preferredDate || '');
      setValue('preferredTime', editData.preferredTime || '');
      setValue('location', editData.location || '');
      setValue('requestorPhone', editData.requestorPhone || '');
      
      // Load existing documents
      loadExistingDocuments();
    }
  }, [editData, setValue]);

  // Load existing documents for editing
  const loadExistingDocuments = async () => {
    if (!editData?.id) return;
    
    try {
      const response = await apiRequest('GET', `/api/job-requests/${editData.id}/documents`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Convert existing documents to DocumentFile format
        const existingDocuments: DocumentFile[] = result.data.map((doc: any) => ({
          fileName: doc.fileName,
          originalName: doc.originalName,
          filePath: doc.filePath,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          // Note: We don't have the actual File object for existing documents
          // This is just for display purposes
        } as DocumentFile));
        
        setDocuments(existingDocuments);
      }
    } catch (error) {
      console.error('Error loading existing documents:', error);
      toast.error('Failed to load existing documents');
    }
  };

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newDocuments: DocumentFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name} is not a supported file type. Please upload PDF, JPEG, or PNG files.`);
          continue;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Please upload files smaller than 10MB.`);
          continue;
        }

        // Upload file to server using the job request specific endpoint
        const formData = new FormData();
        formData.append('document', file);
        
        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
        console.log('FormData created with document field');

        const uploadResponse = await apiRequest('POST', '/api/job-requests/upload-document', formData);
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          console.error('Upload failed:', errorData);
          toast.error(`Failed to upload ${file.name}: ${errorData.error || 'Upload failed'}`);
          continue;
        }

        const uploadResult = await uploadResponse.json();
        
        const documentFile: DocumentFile = {
          file,
          fileName: uploadResult.fileName || `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`,
          originalName: file.name,
          filePath: uploadResult.filePath || uploadResult.fileKey,
          fileSize: file.size,
          mimeType: file.type,
        };

        newDocuments.push(documentFile);
      }

      setDocuments(prev => {
        const updated = [...prev, ...newDocuments];
        console.log('Documents state updated:', updated);
        return updated;
      });
      toast.success(`${newDocuments.length} document(s) added successfully!`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error processing files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const removeDocument = (index: number) => {
    const documentToRemove = documents[index];
    setDocuments(prev => prev.filter((_, i) => i !== index));
    
    // If this is an existing document (has fileName but no file), we need to delete it from the server
    if (editData?.id && documentToRemove.fileName && !documentToRemove.file) {
      deleteExistingDocument(documentToRemove.fileName);
    }
    
    toast.success('Document removed successfully!');
  };

  const deleteExistingDocument = async (fileName: string) => {
    try {
      await apiRequest('DELETE', `/api/job-requests/${editData!.id}/documents/${encodeURIComponent(fileName)}`);
      toast.success('Document deleted from server');
    } catch (error) {
      console.error('Error deleting document from server:', error);
      toast.error('Failed to delete document from server');
    }
  };

  const onSubmit = async (data: JobRequestFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare documents data for submission
      // For existing documents (without file property), keep them as is
      // For new documents (with file property), prepare them for upload
      const documentsData = documents.map(doc => ({
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
      }));

      const requestData = {
        ...data,
        documents: documentsData,
      };

      let response;
      if (editData) {
        // Update existing request
        response = await apiRequest('PUT', `/api/job-requests/${editData.id}`, requestData);
        toast.success('Job request updated successfully!');
      } else {
        // Create new request
        response = await apiRequest('POST', '/api/job-requests', requestData);
        toast.success('Job request submitted successfully!');
      }

      const result = await response.json();
      reset();
      setDocuments([]);
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit job request';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'normal':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Title */}
        <div className="space-y-3">
          <Label htmlFor="title" className="text-sm font-semibold text-gray-700">Request Title *</Label>
          <Input
            id="title"
            placeholder="Brief title for your notarization request"
            {...register('title')}
            className={`h-12 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${errors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
          />
          {errors.title && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-3">
          <Label htmlFor="description" className="text-sm font-semibold text-gray-700">Description *</Label>
          <Textarea
            id="description"
            placeholder="Please describe what documents need to be notarized and any specific requirements..."
            rows={4}
            {...register('description')}
            className={`px-4 py-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
          />
          {errors.description && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Document Type */}
        <div className="space-y-3">
          <Label htmlFor="documentType" className="text-sm font-semibold text-gray-700">Document Type *</Label>
          <Select onValueChange={(value) => setValue('documentType', value)}>
            <SelectTrigger className={`h-12 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${errors.documentType ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="real_estate">Real Estate Documents</SelectItem>
              <SelectItem value="legal">Legal Documents</SelectItem>
              <SelectItem value="financial">Financial Documents</SelectItem>
              <SelectItem value="personal">Personal Documents</SelectItem>
              <SelectItem value="business">Business Documents</SelectItem>
              <SelectItem value="medical">Medical Documents</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.documentType && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.documentType.message}
            </p>
          )}
        </div>

        {/* Urgency */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">Urgency Level</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['low', 'normal', 'high', 'urgent'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setValue('urgency', level as any)}
                className={`p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                  urgency === level
                    ? getUrgencyColor(level) + ' border-current'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">Schedule & Location</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferredDate" className="text-sm text-gray-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Preferred Date
              </Label>
              <Input
                id="preferredDate"
                type="date"
                {...register('preferredDate')}
                className="h-12 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredTime" className="text-sm text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Preferred Time
              </Label>
              <Input
                id="preferredTime"
                type="time"
                {...register('preferredTime')}
                className="h-12 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <Label htmlFor="location" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location (Optional)
          </Label>
          <Input
            id="location"
            placeholder="Where should the notarization take place?"
            {...register('location')}
            className="h-12 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-3">
          <Label htmlFor="requestorPhone" className="text-sm font-semibold text-gray-700">Phone Number (Optional)</Label>
          <Input
            id="requestorPhone"
            type="tel"
            placeholder="Your phone number for contact"
            {...register('requestorPhone')}
            className="h-12 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Document Upload */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">Documents (Optional)</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors duration-200">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="document-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="document-upload"
              className="cursor-pointer flex flex-col items-center space-y-3"
            >
              <div className="p-3 bg-blue-50 rounded-full">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium text-blue-600 hover:text-blue-500">
                  Click to upload
                </span>{' '}
                or drag and drop
              </div>
              <p className="text-xs text-gray-500">
                PDF, JPEG, PNG up to 10MB each
              </p>
            </label>
          </div>

          {/* Document List */}
          {(() => {
            console.log('Rendering documents, count:', documents.length, 'documents:', documents);
            return null;
          })()}
          {documents.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">Uploaded Documents ({documents.length})</Label>
              <div className="space-y-2">
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <File className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {doc.originalName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {editData ? 'Updating Request...' : 'Submitting Request...'}
            </>
          ) : (
            editData ? 'Update Job Request' : 'Submit Job Request'
          )}
        </Button>
      </form>
    </div>
  );
} 