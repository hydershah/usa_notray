import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Award, AlertCircle } from 'lucide-react';

interface NotaryData {
  id: number;
  name: string;
  email: string;
  type: string;
}

interface NotaryAssignmentCardProps {
  jobId: number;
}

export function NotaryAssignmentCard({ jobId }: NotaryAssignmentCardProps) {
  const [notary, setNotary] = useState<NotaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotaryDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/jobs/${jobId}/notary-details`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch notary details');
        }

        const data = await response.json();
        
        if (data.notary) {
          setNotary(data.notary);
        } else {
          setNotary(null);
        }
      } catch (err) {
        console.error('Error fetching notary details:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchNotaryDetails();
    }
  }, [jobId]);

  if (loading) {
    return (
      <Card className="border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Assigned Notary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading notary details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Assigned Notary
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
    <Card className="border-none shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="h-5 w-5 mr-2" />
          Assigned Notary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notary ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Award className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{notary.name}</p>
                <p className="text-sm text-gray-600">{notary.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={notary.type === 'subscriber' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}
              >
                {notary.type || 'contractor'}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <User className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No notary assigned yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 