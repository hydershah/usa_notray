import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import {
  Building,
  Star,
  Mail,
  MapPin,
  Calendar,
  Info,
  Shield
} from 'lucide-react';

interface AssignedCompany {
  assignmentId: number;
  companyId: number;
  companyName: string;
  companyEmail: string;
  companyCity: string;
  companyState: string;
  isDefault: boolean;
  assignedAt: string;
  status: string;
}

export function AssignedCompanies() {
  const { user } = useAuth();

  const { data: assignedCompanies = [], isLoading } = useQuery<AssignedCompany[]>({
    queryKey: ['/api/notaries', user?.id, 'assigned-companies'],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await apiRequest('GET', `/api/notaries/${user.id}/assigned-companies`);
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!user?.id && user?.role === 'notary'
  });

  const defaultCompany = assignedCompanies.find(company => company.isDefault);
  const otherCompanies = assignedCompanies.filter(company => !company.isDefault);

  if (!user || user.role !== 'notary') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Assigned Title Companies
          <Badge variant="outline" className="text-xs">
            {assignedCompanies.length} companies
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading assigned companies...
          </div>
        ) : assignedCompanies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium">No Title Companies Assigned</p>
            <p className="text-sm">You haven't been assigned to any title companies yet.</p>
            <p className="text-xs mt-2">Contact your administrator to get assigned to title companies.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Default/Preferred Company */}
            {defaultCompany && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Default Preferred Notary
                </h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-gray-900">{defaultCompany.companyName}</h3>
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800 text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {defaultCompany.companyEmail}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {defaultCompany.companyCity}, {defaultCompany.companyState}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Assigned {new Date(defaultCompany.assignedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-yellow-25 rounded border border-yellow-150">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-xs text-yellow-800">
                        <p className="font-medium">You are the default preferred notary for this company</p>
                        <p>When they create jobs with "auto assignment", you'll be automatically selected if available.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Assigned Companies */}
            {otherCompanies.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  Other Assigned Companies
                </h4>
                <div className="space-y-3">
                  {otherCompanies.map((company) => (
                    <div
                      key={company.assignmentId}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-2">{company.companyName}</h3>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {company.companyEmail}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {company.companyCity}, {company.companyState}
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Assigned {new Date(company.assignedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Information Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">About Title Company Assignments</p>
                  <ul className="space-y-1 text-xs">
                    <li>• You can be assigned to multiple title companies as their preferred notary</li>
                    <li>• When assigned, you may receive jobs from these companies automatically</li>
                    <li>• Default assignments get priority for "auto assignment" jobs</li>
                    <li>• All assignments are managed by administrators</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 