import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, Download, Eye, Clock, Users, Loader2, AlertCircle } from 'lucide-react';

interface RecordingData {
  fileKey: string | null;
  fileUrl: string | null;
  fileName?: string | null;
  duration?: number | null;
  startedAt?: string | null;
  uploadedAt?: string | null;
  participantCount?: number | null;
  sessionId?: string | null;
  liveSessionId?: string | null;
  metadata?: any;
}

interface SessionRecordingCardProps {
  jobId: number;
}

export function SessionRecordingCard({ jobId }: SessionRecordingCardProps) {
  const [recording, setRecording] = useState<RecordingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);

  const fetchRecordingDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cache-bust to avoid 304s
      const response = await fetch(`/api/jobs/${jobId}/recording-details?v=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recording details');
      }

      const data = await response.json();
      console.log('Recording API response:', data);

      // Check if we have a valid recording (fileUrl indicates it's available)
      if (data.fileUrl) {
        setRecording(data);
        setProcessing(false);
      } else if (data.metadata?.error) {
        // Handle fallback recordings or errors
        setRecording(data);
        setProcessing(false);
        if (data.metadata.error.includes('fallback')) {
          setError('Session used fallback recording system - no video file available');
        } else {
          setError(data.metadata.error);
        }
      } else if (data.sessionId || data.metadata?.videoSessionIds?.length > 0) {
        // We have session info but no file URL yet - still processing
        setRecording(data);
        setProcessing(true);
      } else {
        // No recording data at all
        setRecording(null);
        setProcessing(false);
      }
    } catch (err) {
      console.error('Error fetching recording details:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    // Initial fetch
    fetchRecordingDetails();

    // Start polling for up to 2 minutes if processing
    pollStartRef.current = Date.now();
    const startPolling = () => {
      if (pollRef.current) return; // Already polling

      pollRef.current = window.setInterval(async () => {
        const elapsed = Date.now() - pollStartRef.current;
        if (elapsed > 2 * 60 * 1000) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setProcessing(false);
          return;
        }

        try {
          const response = await fetch(`/api/jobs/${jobId}/recording-details?v=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          if (!response.ok) return;
          
          const data = await response.json();
          if (data.fileUrl) {
            setRecording(data);
            setProcessing(false);
            // Stop polling when we have a download URL
            if (pollRef.current) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {}
      }, 5000);
    };

    // Start polling if we're in processing state
    if (processing) {
      startPolling();
    }

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, processing]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const handleDownload = () => {
    if (recording?.fileUrl) {
      window.open(recording.fileUrl, '_blank');
    }
  };

  const handlePlay = () => {
    if (recording?.fileUrl) {
      // For MP4 files, try to open in a video player
      const link = document.createElement('a');
      link.href = recording.fileUrl;
      link.target = '_blank';
      link.click();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Video className="h-5 w-5 mr-2" />
            Session Recording
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-sm text-gray-600">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Checking for recording...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Video className="h-5 w-5 mr-2" />
          Session Recording
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-6">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-yellow-500" />
            <p className="text-sm text-gray-600 mb-2">{error}</p>
            {recording?.metadata?.debug && (
              <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">Debug Info</summary>
                <div className="mt-2 p-2 bg-gray-50 rounded text-left">
                  <p><strong>Video Session IDs:</strong></p>
                  <ul className="list-disc list-inside mb-2">
                    {recording.metadata.debug.editorVideoSessionIds?.map((id: string, index: number) => (
                      <li key={index} className="font-mono text-xs">{id}</li>
                    ))}
                  </ul>
                  <p><strong>Search Attempts:</strong></p>
                  <ul className="list-disc list-inside">
                    {recording.metadata.searchAttempts?.map((attempt: string, index: number) => (
                      <li key={index} className="font-mono text-xs">{attempt}</li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        ) : recording && recording.fileUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#002A5C]/10 text-[#002A5C] border-[#002A5C]/20">
                <Video className="h-3 w-3 mr-1" />
                Recording Available
              </Badge>
              {recording.metadata?.technology && (
                <Badge variant="outline" className="text-xs">
                  {recording.metadata.technology}
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              {recording.fileName && (
                <div>
                  <label className="text-sm font-medium text-gray-500">File Name</label>
                  <p className="text-sm">{recording.fileName}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {recording.duration && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Duration</label>
                    <div className="flex items-center mt-1">
                      <Clock className="h-4 w-4 mr-2 text-gray-600" />
                      <span className="text-sm">{formatDuration(recording.duration)}</span>
                    </div>
                  </div>
                )}

                {recording.participantCount && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Participants</label>
                    <div className="flex items-center mt-1">
                      <Users className="h-4 w-4 mr-2 text-gray-600" />
                      <span className="text-sm">{recording.participantCount}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePlay} className="border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5">
                  <Eye className="h-4 w-4 mr-2" />
                  Play
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        ) : processing ? (
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#002A5C]" />
              <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                Processing
              </Badge>
            </div>
            <p className="text-sm text-gray-600">Your recording is being processed by Daily.co</p>
            <p className="text-xs text-gray-500 mt-1">This can take up to a few minutes. This page will update automatically.</p>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No recording available</p>
            <p className="text-xs">Recordings are created during live signing sessions and may take a minute to appear.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 