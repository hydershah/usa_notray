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
      <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <User className="h-5 w-5 mr-2 text-gray-700" />
            Assigned Notary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#002A5C] border-t-transparent"></div>
            <span className="ml-2 text-gray-600 text-sm">Loading notary details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <User className="h-5 w-5 mr-2 text-gray-700" />
            Assigned Notary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center text-red-600 py-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
          <User className="h-5 w-5 mr-2 text-gray-700" />
          Assigned Notary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {notary ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
              <div className="p-2 bg-[#002A5C]/10 rounded-lg">
                <Award className="h-5 w-5 text-[#002A5C]" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{notary.name}</p>
                <p className="text-sm text-gray-600">{notary.email}</p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Badge 
                variant="outline"
                className="bg-[#002A5C]/10 text-[#002A5C] border-[#002A5C]/20"
              >
                {notary.type || 'contractor'}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <User className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No notary assigned yet</p>
            <p className="text-xs mt-1">A notary will be assigned to this job</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 