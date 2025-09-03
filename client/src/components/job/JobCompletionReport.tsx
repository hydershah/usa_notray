import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Users,
  FileCheck,
  Signature,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface JobCompletionReportProps {
  jobId: number;
  jobStatus: string;
  minimal?: boolean;
}

interface CompletionReportInfo {
  exists: boolean;
  reportPath?: string;
  generatedAt?: string;
}

export function JobCompletionReport({ jobId, jobStatus, minimal = false }: JobCompletionReportProps) {
  const [reportInfo, setReportInfo] = useState<CompletionReportInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);



  const fetchReportInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/${jobId}/completion-report`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReportInfo(data);
      } else {
        console.error('Failed to fetch report info');
        setReportInfo({ exists: false });
      }
    } catch (error) {
      console.error('Error fetching report info:', error);
      setReportInfo({ exists: false });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      const response = await fetch(`/api/jobs/${jobId}/generate-completion-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Completion report generated successfully');
          await fetchReportInfo(); // Refresh the report info
        } else {
          toast.error(data.message || 'Failed to generate report');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Error generating report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async () => {
    try {
      setDownloading(true);
      const response = await fetch(`/api/jobs/${jobId}/completion-report/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `job_${jobId}_completion_report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Report downloaded successfully');
      } else {
        const errorData = await response.json();
        
        // If the report file is missing and can be regenerated, offer to do so
        if (response.status === 404 && errorData.canRegenerate) {
          toast.error(
            errorData.message || 'Report file not found', 
            {
              action: {
                label: 'Generate Report',
                onClick: () => generateReport()
              }
            }
          );
        } else {
          toast.error(errorData.message || 'Failed to download report');
        }
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Error downloading report');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    fetchReportInfo();
  }, [jobId]);

  if (loading) {
    if (minimal) {
      return (
        <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
              <FileCheck className="h-5 w-5 mr-2 text-gray-700" />
              Completion Report
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#002A5C] border-t-transparent"></div>
              <span className="ml-2 text-gray-600 text-sm">Loading report information...</span>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Completion Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading report information...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isJobCompleted = jobStatus === 'completed';
  const hasReport = reportInfo?.exists;

  if (minimal) {
    return (
      <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <FileCheck className="h-5 w-5 mr-2 text-gray-700" />
            Completion Report
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!isJobCompleted ? (
            <div className="text-center py-6 text-gray-500">
              <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium">Report Pending</p>
              <p className="text-xs mt-1">Generated after job is completed</p>
            </div>
          ) : hasReport ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#002A5C]/5 rounded-lg border border-[#002A5C]/20">
                <div className="p-2 bg-[#002A5C]/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-[#002A5C]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Available</p>
                  <p className="text-sm text-gray-600">Ready for download</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={downloadReport} 
                  disabled={downloading} 
                  size="sm"
                  className="flex-1 bg-[#002A5C] hover:bg-[#002A5C]/90"
                >
                  {downloading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  onClick={generateReport} 
                  disabled={generating} 
                  size="sm"
                  className="border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
                  title="Regenerate report"
                >
                  {generating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Not Generated</p>
                  <p className="text-sm text-gray-600">Report needs to be created</p>
                </div>
              </div>
              
              <Button
                onClick={generateReport}
                disabled={generating}
                variant="outline"
                size="sm"
                className="w-full border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Completion Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isJobCompleted ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Completion report will be generated when the job is finished</span>
          </div>
        ) : hasReport ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <CheckCircle className="h-4 w-4" />
              <span>Completion report is available</span>
            </div>
            
            {reportInfo?.generatedAt && (
              <div className="text-sm text-muted-foreground">
                Generated: {new Date(reportInfo.generatedAt).toLocaleString()}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={downloadReport}
                disabled={downloading}
                className="flex-1"
              >
                {downloading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download Report
              </Button>
              
              <Button
                variant="outline"
                onClick={generateReport}
                disabled={generating}
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span>No completion report found for this job</span>
            </div>
            
            <div className="text-sm text-muted-foreground">
              The completion report may not have been generated automatically. 
              You can generate it manually using the button below.
            </div>

            <Button
              onClick={generateReport}
              disabled={generating}
              variant="outline"
              className="w-full"
            >
              {generating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generate Completion Report
            </Button>
          </div>
        )}

        <Separator />

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>What's included:</strong> Complete audit trail, notary journal entries, 
            participant verification status, document processing summary, session timeline, 
            and compliance verification for legal record keeping.
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 