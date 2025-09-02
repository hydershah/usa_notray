import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { Progress } from '../ui/progress';
import { 
  Loader2, 
  FileText, 
  Calendar, 
  Clock, 
  MapPin, 
  AlertCircle, 
  Upload, 
  X, 
  File, 
  Download, 
  CheckCircle,
  Info,
  Paperclip,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/queryClient';

const jobRequestSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(1000, 'Description must be less than 1000 characters'),
  documentType: z.string().min(1, 'Document type is required'),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  location: z.string().optional(),
  requestorPhone: z.string().optional().refine((val) => {
    if (!val) return true; // Optional field
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(val.replace(/[\s\-\(\)]/g, ''));
  }, 'Please enter a valid phone number'),
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
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
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
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          uploadStatus: 'completed',
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

        // Create temporary document entry
        const tempDoc: DocumentFile = {
          file,
          fileName: `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`,
          originalName: file.name,
          filePath: '',
          fileSize: file.size,
          mimeType: file.type,
          uploadStatus: 'uploading',
          uploadProgress: 0,
        };

        // Add to documents list immediately for UI feedback
        setDocuments(prev => [...prev, tempDoc]);

        // Upload file to server with proper FormData construction
        const formData = new FormData();
        formData.append('document', file, file.name); // Ensure proper field name and filename
        
        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);

        try {
          const uploadResponse = await apiRequest('POST', '/api/job-requests/upload-document', formData);
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            console.error('Upload failed:', errorData);
            
            // Update document status to error
            setDocuments(prev => prev.map(doc => 
              doc.fileName === tempDoc.fileName 
                ? { ...doc, uploadStatus: 'error', errorMessage: errorData.error || 'Upload failed' }
                : doc
            ));
            
            toast.error(`Failed to upload ${file.name}: ${errorData.error || 'Upload failed'}`);
            continue;
          }

          const uploadResult = await uploadResponse.json();
          
          // Update document with successful upload data
          setDocuments(prev => prev.map(doc => 
            doc.fileName === tempDoc.fileName 
              ? {
                  ...doc,
                  fileName: uploadResult.fileName || tempDoc.fileName,
                  filePath: uploadResult.filePath || uploadResult.fileKey,
                  uploadStatus: 'completed',
                  uploadProgress: 100,
                }
              : doc
          ));
        } catch (uploadError) {
          console.error('Error uploading files:', uploadError);
          
          // Update document status to error
          setDocuments(prev => prev.map(doc => 
            doc.fileName === tempDoc.fileName 
              ? { ...doc, uploadStatus: 'error', errorMessage: 'Network error during upload' }
              : doc
          ));
          
          toast.error(`Failed to upload ${file.name}: Network error`);
        }
      }

      toast.success(`${files.length} document(s) uploaded successfully!`);
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Error processing files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

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
      // Filter out documents with upload errors
      const validDocuments = documents.filter(doc => doc.uploadStatus !== 'error');
      
      if (documents.length !== validDocuments.length) {
        toast.error('Please remove documents with upload errors before submitting');
        setIsSubmitting(false);
        return;
      }

      // Prepare documents data for submission
      const documentsData = validDocuments.map(doc => ({
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
      let errorMessage = 'Failed to submit job request';
      
      if (err instanceof Error) {
        // Try to parse error message from response
        const errorText = err.message;
        if (errorText.includes('400:')) {
          try {
            const jsonMatch = errorText.match(/\{.*\}/);
            if (jsonMatch) {
              const errorData = JSON.parse(jsonMatch[0]);
              errorMessage = errorData.error || errorData.message || 'Invalid request data. Please check your form and try again.';
            } else {
              errorMessage = 'Please check your form data and try again.';
            }
          } catch (parseError) {
            errorMessage = 'Please check your form data and try again.';
          }
        } else if (errorText.includes('401:')) {
          errorMessage = 'Your session has expired. Please log in again.';
        } else if (errorText.includes('403:')) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (errorText.includes('500:')) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = errorText;
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100';
      case 'normal':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Professional Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Job Request Details</h2>
              <p className="text-sm text-gray-600">Please provide comprehensive information about your notarization needs</p>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Request Title *
          </Label>
          <div className="relative">
            <Input
              id="title"
              placeholder="e.g., Real Estate Purchase Agreement Notarization"
              {...register('title')}
              className={`h-11 px-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
              {watch('title')?.length || 0}/100
            </div>
          </div>
          {errors.title && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold text-gray-700">Description *</Label>
          <div className="relative">
            <Textarea
              id="description"
              placeholder="Please provide detailed information about the documents that need notarization, any specific requirements, and any additional context that would help our team understand your needs."
              rows={4}
              {...register('description')}
              className={`px-3 py-2 border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none transition-colors ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {watch('description')?.length || 0}/1000
            </div>
          </div>
          {errors.description && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Document Type */}
        <div className="space-y-2">
          <Label htmlFor="documentType" className="text-sm font-semibold text-gray-700">Document Type *</Label>
          <Select onValueChange={(value) => setValue('documentType', value)}>
            <SelectTrigger className={`h-11 px-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.documentType ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}>
              <SelectValue placeholder="Select the type of document that needs notarization" />
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
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-gray-700">Urgency Level</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'low', label: 'Low', description: 'Within 1 week' },
              { value: 'normal', label: 'Normal', description: 'Within 3-5 days' },
              { value: 'high', label: 'High', description: 'Within 1-2 days' },
              { value: 'urgent', label: 'Urgent', description: 'Same day' }
            ].map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setValue('urgency', level.value as any)}
                className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                  urgency === level.value
                    ? getUrgencyColor(level.value) + ' border-current shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{level.label}</div>
                <div className="text-xs opacity-75">{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-gray-700">Schedule & Location</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="preferredDate" className="text-sm text-gray-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Preferred Date
              </Label>
              <Input
                id="preferredDate"
                type="date"
                {...register('preferredDate')}
                className="h-11 px-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="preferredTime" className="text-sm text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Preferred Time
              </Label>
              <Input
                id="preferredTime"
                type="time"
                {...register('preferredTime')}
                className="h-11 px-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location (Optional)
          </Label>
          <Input
            id="location"
            placeholder="e.g., 123 Main Street, Suite 100, New York, NY 10001"
            {...register('location')}
            className="h-11 px-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="requestorPhone" className="text-sm font-semibold text-gray-700">Phone Number (Optional)</Label>
          <Input
            id="requestorPhone"
            type="tel"
            placeholder="e.g., (555) 123-4567"
            {...register('requestorPhone')}
            className="h-11 px-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
          />
          {errors.requestorPhone && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.requestorPhone.message}
            </p>
          )}
        </div>

        {/* Document Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Documents (Optional)
            </Label>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info className="h-3 w-3" />
              PDF, JPEG, PNG up to 10MB each
            </div>
          </div>
          
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
              isDragOver 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
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
              <div className={`p-3 rounded-full transition-colors ${
                isDragOver ? 'bg-blue-100' : 'bg-blue-50'
              }`}>
                {isUploading ? (
                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-blue-600" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600 hover:text-blue-500">
                    Click to upload
                  </span>{' '}
                  or drag and drop files here
                </div>
                <p className="text-xs text-gray-500">
                  Supported formats: PDF, JPEG, PNG (Max 10MB per file)
                </p>
              </div>
            </label>
          </div>

          {/* Document List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700">
                  Uploaded Documents ({documents.length})
                </Label>
                {isUploading && (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      doc.uploadStatus === 'error' 
                        ? 'bg-red-50 border-red-200' 
                        : doc.uploadStatus === 'completed'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded-lg ${
                        doc.uploadStatus === 'error' 
                          ? 'bg-red-100' 
                          : doc.uploadStatus === 'completed'
                          ? 'bg-green-100'
                          : 'bg-blue-100'
                      }`}>
                        {doc.uploadStatus === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : doc.uploadStatus === 'completed' ? (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        ) : (
                          <File className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {doc.originalName}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{formatFileSize(doc.fileSize)}</span>
                          {doc.uploadStatus === 'uploading' && (
                            <span className="text-blue-600">Uploading...</span>
                          )}
                          {doc.uploadStatus === 'error' && (
                            <span className="text-red-600">{doc.errorMessage}</span>
                          )}
                          {doc.uploadStatus === 'completed' && (
                            <span className="text-blue-600">Uploaded successfully</span>
                          )}
                        </div>
                        {doc.uploadStatus === 'uploading' && doc.uploadProgress !== undefined && (
                          <Progress value={doc.uploadProgress} className="mt-1 h-1" />
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(index)}
                      className={`${
                        doc.uploadStatus === 'error' 
                          ? 'text-red-500 hover:text-red-700 hover:bg-red-100' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-gray-200">
          {/* Helpful Tips */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-blue-900">Helpful Tips</h4>
                <ul className="text-xs text-blue-800 space-y-0.5">
                  <li>• Provide a clear, descriptive title that summarizes your notarization needs</li>
                  <li>• Include specific details about document types, deadlines, and any special requirements</li>
                  <li>• Upload relevant documents to help us better understand your needs</li>
                  <li>• Choose the appropriate urgency level based on your timeline</li>
                  <li>• Our team will review your request and contact you within 24 hours</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editData ? 'Updating Request...' : 'Submitting Request...'}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {editData ? 'Update Job Request' : 'Submit Job Request'}
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 text-center mt-2">
            By submitting this request, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </form>
    </div>
  );
} 