import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, Download, Play, Users, Clock, Calendar, AlertCircle } from 'lucide-react';

interface RecordingData {
  fileKey: string;
  fileUrl: string;
  fileName: string;
  duration: number;
  startedAt: string;
  uploadedAt: string;
  participantCount: number;
  sessionId: string;
  liveSessionId: string;
  metadata: any;
}

interface SessionRecordingCardProps {
  jobId: number;
}

export function SessionRecordingCard({ jobId }: SessionRecordingCardProps) {
  const [recording, setRecording] = useState<RecordingData | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecordingDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/jobs/${jobId}/recording-details`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch recording details');
        }

        const data = await response.json();
        setHasRecording(data.hasRecording);
        
        if (data.recording) {
          setRecording(data.recording);
        }
      } catch (err) {
        console.error('Error fetching recording details:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchRecordingDetails();
    }
  }, [jobId]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const handleDownload = () => {
    if (recording?.fileUrl) {
      window.open(recording.fileUrl, '_blank');
    }
  };

  const handlePlay = () => {
    if (recording?.fileUrl) {
      // Open in new window for playback
      window.open(recording.fileUrl, '_blank', 'width=800,height=600');
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
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading recording details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Video className="h-5 w-5 mr-2" />
            Session Recording
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>Error: {error}</span>
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
        {hasRecording && recording ? (
          <div className="space-y-4">
            {/* Recording Status */}
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Video className="h-3 w-3 mr-1" />
                Recording Available
              </Badge>
            </div>

            {/* Recording Details */}
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

              {recording.startedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Recorded On</label>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-gray-600" />
                    <span className="text-sm">
                      {new Date(recording.startedAt).toLocaleDateString()} at{' '}
                      {new Date(recording.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}

              {recording.uploadedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Uploaded</label>
                  <p className="text-sm">{new Date(recording.uploadedAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {recording.fileUrl && (
                <>
                  <Button
                    size="sm"
                    onClick={handlePlay}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Play
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </>
              )}
            </div>

            {/* Session IDs (for debugging/admin) */}
            {(recording.sessionId || recording.liveSessionId) && (
              <div className="border-t pt-3 mt-3">
                <label className="text-xs font-medium text-gray-400">Session Info</label>
                {recording.sessionId && (
                  <p className="text-xs text-gray-500 font-mono">Session: {recording.sessionId}</p>
                )}
                {recording.liveSessionId && (
                  <p className="text-xs text-gray-500 font-mono">Live: {recording.liveSessionId}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Video className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">No recording available</p>
            <p className="text-xs text-gray-400">
              Recordings are created during live signing sessions
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 