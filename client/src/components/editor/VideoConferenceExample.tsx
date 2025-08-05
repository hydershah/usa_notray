import { NotaryVideoSession } from '@/components/video';
import SimpleVideoConference from './SimpleVideoConference';
import { VideoIntegration } from './VideoIntegration';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Example mock data for demonstration
const mockParticipants = [
  {
    userId: '1',
    displayName: 'John Doe',
    email: 'john@example.com',
    userType: 'notary' as const
  },
  {
    userId: '2',
    displayName: 'Jane Smith',
    email: 'jane@example.com',
    userType: 'signer' as const
  },
  {
    userId: '3',
    displayName: 'Bob Wilson',
    email: 'bob@example.com',
    userType: 'witness' as const
  }
];

const mockCurrentUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'notary' as const
};

interface VideoConferenceExampleProps {
  sessionId?: string;
  jobId?: number;
  mode?: 'demo' | 'development' | 'test';
}

const VideoConferenceExample: React.FC<VideoConferenceExampleProps> = ({
  sessionId = 'demo-session-123',
  jobId = 123,
  mode = 'demo'
}) => {
  const [activeDemo, setActiveDemo] = useState<string>('simple');
  const [demoSettings, setDemoSettings] = useState({
    autoStart: false,
    showControls: true,
    participantCount: 3,
    currentUserRole: 'notary' as 'notary' | 'signer' | 'witness'
  });

  // Generate dynamic participants based on settings
  const dynamicParticipants = mockParticipants.slice(0, demoSettings.participantCount);
  const dynamicCurrentUser = {
    ...mockCurrentUser,
    role: demoSettings.currentUserRole
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Daily.co Video Conference Integration
        </h1>
        <p className="text-gray-600">
          Demonstration of our new Daily.co-powered video conferencing system
        </p>
        <div className="flex justify-center gap-2 mt-4">
          <Badge variant="secondary">Daily.co Integration</Badge>
          <Badge variant="outline">Cloud Recording</Badge>
          <Badge variant="outline">Professional Grade</Badge>
        </div>
      </div>

      {/* Demo Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Auto Start</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="checkbox"
                  checked={demoSettings.autoStart}
                  onChange={(e) => setDemoSettings(prev => ({ ...prev, autoStart: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">Start video automatically</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">User Role</label>
              <select
                value={demoSettings.currentUserRole}
                onChange={(e) => setDemoSettings(prev => ({ ...prev, currentUserRole: e.target.value as any }))}
                className="w-full mt-1 rounded border-gray-300 text-sm"
              >
                <option value="notary">Notary (Host)</option>
                <option value="signer">Signer</option>
                <option value="witness">Witness</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Participants</label>
              <input
                type="range"
                min="1"
                max="3"
                value={demoSettings.participantCount}
                onChange={(e) => setDemoSettings(prev => ({ ...prev, participantCount: parseInt(e.target.value) }))}
                className="w-full mt-1"
              />
              <span className="text-xs text-gray-500">{demoSettings.participantCount} participants</span>
            </div>
            
            <div>
              <label className="text-sm font-medium">Session Info</label>
              <div className="text-xs text-gray-600 mt-1">
                <div>Session: {sessionId}</div>
                <div>Job ID: {jobId}</div>
                <div>Mode: {mode}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Components */}
      <Tabs value={activeDemo} onValueChange={setActiveDemo}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="simple">Simple Video</TabsTrigger>
          <TabsTrigger value="full">Full Conference</TabsTrigger>
          <TabsTrigger value="integration">Video Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Simple Video Conference</CardTitle>
              <p className="text-sm text-gray-600">
                Compact video interface perfect for sidebar integration
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="h-64 bg-white rounded border-2 border-dashed border-gray-300">
                  <SimpleVideoConference
                    sessionId={sessionId}
                    currentUser={dynamicCurrentUser}
                    participants={dynamicParticipants}
                    className="h-full"
                    compact={true}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="full" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Full Daily Conference</CardTitle>
              <p className="text-sm text-gray-600">
                Complete video conferencing interface with all features
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="h-96 bg-white rounded border-2 border-dashed border-gray-300">
                  <NotaryVideoSession
                    jobId={jobId.toString()}
                    currentUser={{
                      id: dynamicCurrentUser.id,
                      name: dynamicCurrentUser.name,
                      role: dynamicCurrentUser.role,
                      email: dynamicCurrentUser.email
                    }}
                    participants={dynamicParticipants.map(p => ({
                      id: p.userId,
                      name: p.displayName,
                      role: p.userType,
                      email: p.email
                    }))}
                    autoJoin={demoSettings.autoStart}
                    className="h-full"
                    onSessionComplete={(sessionData) => {
                      console.log('Session completed:', sessionData);
                    }}
                    onSessionError={(error) => {
                      console.error('Session error:', error);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Video Integration Component</CardTitle>
              <p className="text-sm text-gray-600">
                Smart video integration that adapts to different contexts
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="h-80 bg-white rounded border-2 border-dashed border-gray-300">
                  <VideoIntegration
                    sessionId={sessionId}
                    participants={dynamicParticipants}
                    currentUserId={dynamicCurrentUser.id}
                    mode={mode === 'demo' ? 'signing' : 'tagging'}
                    autoStart={demoSettings.autoStart}
                    className="h-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Daily.co vs WebRTC Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-left py-2">WebRTC (Old)</th>
                  <th className="text-left py-2">Daily.co (New)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b">
                  <td className="py-2 font-medium">Setup Complexity</td>
                  <td className="py-2 text-red-600">Complex signaling server required</td>
                  <td className="py-2 text-green-600">Simple iframe integration</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Recording</td>
                  <td className="py-2 text-orange-600">Custom implementation needed</td>
                  <td className="py-2 text-green-600">Built-in cloud recording</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Mobile Support</td>
                  <td className="py-2 text-orange-600">Limited browser support</td>
                  <td className="py-2 text-green-600">Full mobile browser support</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Maintenance</td>
                  <td className="py-2 text-red-600">High maintenance overhead</td>
                  <td className="py-2 text-green-600">Managed service</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Compliance</td>
                  <td className="py-2 text-orange-600">Self-managed</td>
                  <td className="py-2 text-green-600">HIPAA & SOC2 compliant</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Reliability</td>
                  <td className="py-2 text-orange-600">Depends on implementation</td>
                  <td className="py-2 text-green-600">Enterprise-grade infrastructure</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Integration Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Notes</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-green-800 mb-2">✅ Implemented Features</h4>
              <ul className="space-y-1 text-sm">
                <li>• Daily.co iframe integration</li>
                <li>• Host/participant role management</li>
                <li>• Cloud recording controls</li>
                <li>• Participant join/leave events</li>
                <li>• Connection status monitoring</li>
                <li>• Mobile-responsive design</li>
                <li>• Secure token-based authentication</li>
                <li>• Auto-minimize/maximize controls</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">🔄 API Integration</h4>
              <ul className="space-y-1 text-sm">
                <li>• <code>POST /api/jobs/{jobId}/video-session</code></li>
                <li>• <code>DELETE /api/jobs/{jobId}/video-session</code></li>
                <li>• <code>POST /api/jobs/{jobId}/video-session/recording/start</code></li>
                <li>• <code>POST /api/jobs/{jobId}/video-session/recording/stop</code></li>
                <li>• <code>GET /api/jobs/{jobId}/recordings</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VideoConferenceExample; 