import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Clock, Plus, Edit, Trash2, Ban, Check, X, User } from 'lucide-react'; // Fixed: replaced Block with Ban
import { cn } from '@/lib/utils';

interface DayViewProps {
  date: string;
  timeSlots: any[];
  events: any[];
  onSlotUpdate: () => void;
}

export function DayView({ date, timeSlots, events, onSlotUpdate }: DayViewProps) {
  const { toast } = useToast();
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [newSlot, setNewSlot] = useState({
    startTime: '',
    endTime: '',
    status: 'available' as const,
    blockReason: ''
  });

  const daySlots = timeSlots.filter(slot => slot.date === date).sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );
  
  const dayEvents = events.filter(event => 
    event.startDateTime.split('T')[0] === date
  );

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const existingSlot = daySlots.find(slot => slot.startTime === timeString);
        
        slots.push({
          time: timeString,
          slot: existingSlot || null
        });
      }
    }
    return slots;
  };

  const timeGrid = generateTimeSlots();

  const handleCreateSlot = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/calendar/time-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date,
          ...newSlot
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Time slot created successfully",
        });
        setNewSlot({
          startTime: '',
          endTime: '',
          status: 'available',
          blockReason: ''
        });
        setShowSlotModal(false);
        onSlotUpdate();
      } else {
        throw new Error('Failed to create slot');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create time slot",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSlot = async (slotId: number, updates: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/calendar/time-slots/${slotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Time slot updated successfully",
        });
        onSlotUpdate();
      } else {
        throw new Error('Failed to update slot');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update time slot",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/calendar/time-slots/${slotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Time slot deleted successfully",
        });
        onSlotUpdate();
      } else {
        throw new Error('Failed to delete slot');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete time slot",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </h3>
          <p className="text-sm text-gray-600">
            {daySlots.length} time slots • {dayEvents.length} events
          </p>
        </div>
        
        <Dialog open={showSlotModal} onOpenChange={setShowSlotModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Time Slot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Time Slot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newSlot.endTime}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label>Status</Label>
                <Select value={newSlot.status} onValueChange={(value: any) => setNewSlot(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {newSlot.status === 'blocked' && (
                <div>
                  <Label>Block Reason</Label>
                  <Textarea
                    value={newSlot.blockReason}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, blockReason: e.target.value }))}
                    placeholder="Reason for blocking this time slot..."
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSlotModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSlot}>
                  Create Slot
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Events for the day */}
      {dayEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "p-3 rounded-lg border-l-4",
                    event.eventType === 'job' && "border-blue-500 bg-blue-50",
                    event.eventType === 'personal' && "border-purple-500 bg-purple-50",
                    event.eventType === 'appointment' && "border-green-500 bg-green-50",
                    event.eventType === 'vacation' && "border-orange-500 bg-orange-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{event.title}</h4>
                    <Badge variant="secondary" className="capitalize">
                      {event.eventType}
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(event.startDateTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })} - {new Date(event.endDateTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time slots grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Time Slots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {timeGrid.map(({ time, slot }) => (
              <div
                key={time}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  slot?.status === 'available' && "bg-green-50 border-green-200",
                  slot?.status === 'booked' && "bg-blue-50 border-blue-200",
                  slot?.status === 'blocked' && "bg-red-50 border-red-200",
                  !slot && "bg-gray-50 border-gray-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium">{time}</span>
                  {slot && (
                    <Badge
                      variant={
                        slot.status === 'available' ? 'default' :
                        slot.status === 'booked' ? 'secondary' :
                        'destructive'
                      }
                      className="capitalize"
                    >
                      {slot.status}
                    </Badge>
                  )}
                  {slot?.blockReason && (
                    <span className="text-sm text-gray-600">- {slot.blockReason}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {slot ? (
                    <>
                      {slot.status === 'available' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateSlot(slot.id, { status: 'blocked', isManualBlock: true, blockReason: 'Manually blocked' })}
                        >
                                                      <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      {slot.status === 'blocked' && slot.isManualBlock && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateSlot(slot.id, { status: 'available', isManualBlock: false, blockReason: null })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteSlot(slot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNewSlot(prev => ({
                          ...prev,
                          startTime: time,
                          endTime: `${(parseInt(time.split(':')[0]) + 1).toString().padStart(2, '0')}:${time.split(':')[1]}`
                        }));
                        setShowSlotModal(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 