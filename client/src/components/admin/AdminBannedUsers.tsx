import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { RefreshCw, Unlock, Search, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';

interface LockedAccount {
  identifier: string;
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
  timeRemainingSeconds: number;
}

export function AdminBannedUsers() {
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const { toast } = useToast();

  const fetchLocked = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('GET', '/api/admin/auth/locked-accounts');
      const data = await res.json();
      setLockedAccounts(Array.isArray(data.lockedAccounts) ? data.lockedAccounts : []);
    } catch (e) {
      toast({ title: 'Failed to load', description: 'Could not load locked accounts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocked();
  }, []);

  const unlock = async (identifier: string) => {
    try {
      const res = await apiRequest('POST', '/api/admin/auth/unlock', { identifier });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'User unlocked', description: `${identifier} can attempt login again.` });
        setLockedAccounts(prev => prev.filter(acc => acc.identifier !== identifier));
      }
    } catch (e) {
      toast({ title: 'Unlock failed', description: 'Unable to unlock this user', variant: 'destructive' });
    }
  };

  const filtered = lockedAccounts.filter(acc =>
    !filter || acc.identifier.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-in fade-in-50 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Banned Users</h1>
            <p className="text-gray-600 mt-1">View users temporarily locked after multiple failed login attempts and unlock them.</p>
          </div>
          <Button variant="outline" onClick={fetchLocked} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Locked Accounts ({filtered.length})</CardTitle>
            <CardDescription>Accounts are automatically unlocked when the lockout period expires.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-80 max-w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Filter by email" className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Security Lockout
              </Badge>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No users are currently locked.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Identifier</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Locked Until</TableHead>
                    <TableHead>Time Remaining</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(acc => {
                    const lockedUntilDate = new Date(Date.now() + acc.timeRemainingSeconds * 1000);
                    const untilLabel = new Date(acc.lockedUntil).toLocaleString();
                    const remainingLabel = acc.timeRemainingSeconds > 0
                      ? `${Math.floor(acc.timeRemainingSeconds / 60)}m ${acc.timeRemainingSeconds % 60}s`
                      : 'Expired';
                    return (
                      <TableRow key={acc.identifier}>
                        <TableCell className="font-medium">{acc.identifier}</TableCell>
                        <TableCell>{acc.attempts}</TableCell>
                        <TableCell>{untilLabel}</TableCell>
                        <TableCell>{remainingLabel}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => unlock(acc.identifier)}>
                            <Unlock className="h-4 w-4 mr-2" /> Unlock
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
} 