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
  onSlotUpdate: (updatedSlots?: any[]) => void;
}

export function DayView({ date, timeSlots, events, onSlotUpdate }: DayViewProps) {
  const { toast } = useToast();
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [localTimeSlots, setLocalTimeSlots] = useState<any[]>(timeSlots);
  const [isUpdating, setIsUpdating] = useState<Set<number>>(new Set());
  const [newSlot, setNewSlot] = useState({
    startTime: '',
    endTime: '',
    status: 'available' as const,
    blockReason: ''
  });

  // Update local state when props change
  React.useEffect(() => {
    setLocalTimeSlots(timeSlots);
  }, [timeSlots]);

  const daySlots = localTimeSlots.filter(slot => slot.date === date).sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );
  
  const dayEvents = events.filter(event => 
    event.startDateTime.split('T')[0] === date
  );

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
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

  // Optimistic update helper
  const updateSlotOptimistically = (slotId: number, updates: any) => {
    setLocalTimeSlots(prev => 
      prev.map(slot => 
        slot.id === slotId 
          ? { ...slot, ...updates, updatedAt: new Date().toISOString() }
          : slot
      )
    );
  };

  // Revert optimistic update
  const revertSlotUpdate = (slotId: number, originalSlot: any) => {
    setLocalTimeSlots(prev => 
      prev.map(slot => 
        slot.id === slotId ? originalSlot : slot
      )
    );
  };

  // Add new slot optimistically
  const addSlotOptimistically = (newSlotData: any) => {
    const tempId = Date.now(); // Temporary ID
    const optimisticSlot = {
      id: tempId,
      notaryId: 1, // This should come from user context
      date,
      ...newSlotData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setLocalTimeSlots(prev => [...prev, optimisticSlot]);
    return tempId;
  };

  // Remove slot optimistically
  const removeSlotOptimistically = (slotId: number) => {
    const slotToRemove = localTimeSlots.find(slot => slot.id === slotId);
    setLocalTimeSlots(prev => prev.filter(slot => slot.id !== slotId));
    return slotToRemove;
  };

  const handleCreateSlot = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Add optimistically
      const tempId = addSlotOptimistically(newSlot);

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
        const createdSlot = await response.json();
        
        // Replace temporary slot with real one
        setLocalTimeSlots(prev => 
          prev.map(slot => 
            slot.id === tempId ? createdSlot : slot
          )
        );

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
        
        // Update parent with new data
        onSlotUpdate(localTimeSlots.map(slot => 
          slot.id === tempId ? createdSlot : slot
        ));
      } else {
        // Revert optimistic update
        setLocalTimeSlots(prev => prev.filter(slot => slot.id !== tempId));
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
    if (isUpdating.has(slotId)) return; // Prevent double-clicks
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      setIsUpdating(prev => new Set(prev).add(slotId));
      
      // Store original for potential revert
      const originalSlot = localTimeSlots.find(slot => slot.id === slotId);
      if (!originalSlot) return;

      // Update optimistically
      updateSlotOptimistically(slotId, updates);

      const response = await fetch(`/api/calendar/time-slots/${slotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedSlot = await response.json();
        
        // Update with server response
        setLocalTimeSlots(prev => 
          prev.map(slot => 
            slot.id === slotId ? updatedSlot : slot
          )
        );

        toast({
          title: "Success",
          description: "Time slot updated successfully",
        });

        // Update parent with new data
        onSlotUpdate(localTimeSlots.map(slot => 
          slot.id === slotId ? updatedSlot : slot
        ));
      } else {
        // Revert optimistic update
        revertSlotUpdate(slotId, originalSlot);
        throw new Error('Failed to update slot');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update time slot",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(prev => {
        const newSet = new Set(prev);
        newSet.delete(slotId);
        return newSet;
      });
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Remove optimistically
      const removedSlot = removeSlotOptimistically(slotId);

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
        
        // Update parent
        onSlotUpdate(localTimeSlots.filter(slot => slot.id !== slotId));
      } else {
        // Revert optimistic update
        if (removedSlot) {
          setLocalTimeSlots(prev => [...prev, removedSlot]);
        }
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

  const handleSlotSelection = (time: string) => {
    setSelectedSlots(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const handleBulkDeleteSelected = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const slotsToDelete = selectedSlots
        .map(time => timeGrid.find(({ time: t }) => t === time)?.slot)
        .filter(slot => slot?.id);

      if (slotsToDelete.length === 0) return;

      // Store original slots for potential revert
      const originalSlots = [...localTimeSlots];
      
      // Remove optimistically
      const slotIds = slotsToDelete.map(slot => slot.id);
      setLocalTimeSlots(prev => prev.filter(slot => !slotIds.includes(slot.id)));

      const promises = slotsToDelete.map(slot => 
        fetch(`/api/calendar/time-slots/${slot.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      const results = await Promise.allSettled(promises);
      const failedDeletions = results.filter(result => result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok));

      if (failedDeletions.length > 0) {
        // Revert optimistic updates for failed deletions
        setLocalTimeSlots(originalSlots);
        throw new Error(`Failed to delete ${failedDeletions.length} time slots`);
      }
      
      toast({
        title: "Success",
        description: `${slotsToDelete.length} time slots deleted successfully`,
      });
      
      setSelectedSlots([]);
      
      // Update parent
      onSlotUpdate(localTimeSlots.filter(slot => !slotIds.includes(slot.id)));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete selected time slots",
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
        
        <div className="flex items-center gap-2">
          {selectedSlots.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDeleteSelected}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedSlots.length})
            </Button>
          )}
          
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
      </div>

      {/* Events for the day */}
      {dayEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dayEvents.map((event: any) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200"
                >
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                    )}
                  </div>

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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Time Slots (15-minute intervals)</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                Available
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                Booked
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                Blocked
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {timeGrid.map(({ time, slot }) => (
              <div
                key={time}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all duration-200",
                  slot?.status === 'available' && "bg-green-50 border-green-200 hover:bg-green-100",
                  slot?.status === 'booked' && "bg-blue-50 border-blue-200 hover:bg-blue-100",
                  slot?.status === 'blocked' && "bg-red-50 border-red-200 hover:bg-red-100",
                  !slot && "bg-gray-50 border-gray-200 hover:bg-gray-100",
                  selectedSlots.includes(time) && "ring-2 ring-blue-500",
                  slot && isUpdating.has(slot.id) && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSlots.includes(time)}
                    onChange={() => handleSlotSelection(time)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
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
                          disabled={isUpdating.has(slot.id)}
                          onClick={() => handleUpdateSlot(slot.id, { 
                            status: 'blocked', 
                            isManualBlock: true, 
                            blockReason: 'Manually blocked' 
                          })}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      {slot.status === 'blocked' && slot.isManualBlock && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating.has(slot.id)}
                          onClick={() => handleUpdateSlot(slot.id, { 
                            status: 'available', 
                            isManualBlock: false, 
                            blockReason: null 
                          })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUpdating.has(slot.id)}
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
                        const endTime = new Date(`1970-01-01T${time}:00`);
                        endTime.setMinutes(endTime.getMinutes() + 15);
                        const endTimeString = endTime.toTimeString().slice(0, 5);
                        
                        setNewSlot(prev => ({
                          ...prev,
                          startTime: time,
                          endTime: endTimeString
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