import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { MonthView } from '@/components/calendar/month-view';
import { DayView } from '@/components/calendar/day-view';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  User,
  MapPin,
  Edit,
  Trash2,
  Eye,
  CalendarDays,
  Timer,
  Ban,
  Check,
  X,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface TimeSlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'busy' | 'blocked' | 'booked';
  jobId?: number;
  blockReason?: string;
  isManualBlock: boolean;
}

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  eventType: 'personal' | 'job' | 'appointment' | 'vacation';
  isAllDay: boolean;
  jobId?: number;
}

interface WorkingHours {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface BulkAvailabilitySetup {
  dateRange: {
    start: string;
    end: string;
  };
  timeRange: {
    start: string;
    end: string;
  };
  daysOfWeek: number[];
  type: 'available' | 'blocked';
  blockReason?: string;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

// WeekView component placeholder
function WeekView({ currentDate, timeSlots, events }: { currentDate: Date; timeSlots: TimeSlot[]; events: CalendarEvent[] }) {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg">
      <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-500 text-lg">Week view coming soon...</p>
      <p className="text-gray-400 text-sm mt-2">Enhanced week view with drag-and-drop functionality</p>
    </div>
  );
}

// Bulk Availability Setup Modal
function BulkAvailabilityModal({ onSave, open, onOpenChange }: { onSave: (newSlots?: any[]) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [setup, setSetup] = useState<BulkAvailabilitySetup>({
    dateRange: {
      start: new Date().toISOString().split('T')[0],
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    timeRange: {
      start: '09:00',
      end: '17:00'
    },
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    type: 'available',
    blockReason: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/calendar/bulk-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(setup)
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: `Bulk ${setup.type} setup completed. ${result.slotsCreated} time slots created.`,
        });
        
        // Fetch fresh data only after bulk operations
        onSave();
        onOpenChange(false);
      } else {
        throw new Error('Failed to setup bulk availability');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to setup bulk availability",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSetup({
      dateRange: {
        start: new Date().toISOString().split('T')[0],
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      timeRange: {
        start: '09:00',
        end: '17:00'
      },
      daysOfWeek: [1, 2, 3, 4, 5],
      type: 'available',
      blockReason: ''
    });
    onOpenChange(false);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Bulk Availability Setup
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Operation Type</Label>
            <Select value={setup.type} onValueChange={(value: 'available' | 'blocked') => setSetup(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Set Available
                  </div>
                </SelectItem>
                <SelectItem value="blocked">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Set Unavailable
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label className="text-sm text-gray-600">Start Date</Label>
              <Input
                type="date"
                value={setup.dateRange.start}
                onChange={(e) => setSetup(prev => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
              />
            </div>
            <div>
              <Label className="text-sm text-gray-600">End Date</Label>
              <Input
                type="date"
                value={setup.dateRange.end}
                onChange={(e) => setSetup(prev => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Time Range</Label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label className="text-sm text-gray-600">Start Time</Label>
              <Input
                type="time"
                value={setup.timeRange.start}
                onChange={(e) => setSetup(prev => ({ ...prev, timeRange: { ...prev.timeRange, start: e.target.value } }))}
              />
            </div>
            <div>
              <Label className="text-sm text-gray-600">End Time</Label>
              <Input
                type="time"
                value={setup.timeRange.end}
                onChange={(e) => setSetup(prev => ({ ...prev, timeRange: { ...prev.timeRange, end: e.target.value } }))}
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Days of Week</Label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {DAYS_OF_WEEK.map((day, index) => (
              <div key={day} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${index}`}
                  checked={setup.daysOfWeek.includes(index)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSetup(prev => ({ ...prev, daysOfWeek: [...prev.daysOfWeek, index] }));
                    } else {
                      setSetup(prev => ({ ...prev, daysOfWeek: prev.daysOfWeek.filter(d => d !== index) }));
                    }
                  }}
                />
                <Label htmlFor={`day-${index}`} className="text-sm">{day.slice(0, 3)}</Label>
              </div>
            ))}
          </div>
        </div>

        {setup.type === 'blocked' && (
          <div>
            <Label>Reason for Unavailability</Label>
            <Textarea
              value={setup.blockReason}
              onChange={(e) => setSetup(prev => ({ ...prev, blockReason: e.target.value }))}
              placeholder="Enter reason for blocking these time slots..."
              className="mt-2"
            />
          </div>
        )}
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2">
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {isLoading ? 'Setting up...' : `Setup Bulk ${setup.type === 'available' ? 'Availability' : 'Unavailability'}`}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// Event Modal Component
function EventModal({ onSave, open, onOpenChange }: { onSave: (newEvents?: any[]) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [event, setEvent] = useState({
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    location: '',
    eventType: 'personal' as const,
    isAllDay: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(event)
      });

      if (response.ok) {
        const createdEvent = await response.json();
        toast({
          title: "Success",
          description: "Event created successfully",
        });
        setEvent({
          title: '',
          description: '',
          startDateTime: '',
          endDateTime: '',
          location: '',
          eventType: 'personal',
          isAllDay: false
        });
        onSave();
        onOpenChange(false);
      } else {
        throw new Error('Failed to create event');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEvent({
      title: '',
      description: '',
      startDateTime: '',
      endDateTime: '',
      location: '',
      eventType: 'personal',
      isAllDay: false
    });
    onOpenChange(false);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Event</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input
            value={event.title}
            onChange={(e) => setEvent(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Event title"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={event.description}
            onChange={(e) => setEvent(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Event description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start Date & Time</Label>
            <Input
              type="datetime-local"
              value={event.startDateTime}
              onChange={(e) => setEvent(prev => ({ ...prev, startDateTime: e.target.value }))}
            />
          </div>
          <div>
            <Label>End Date & Time</Label>
            <Input
              type="datetime-local"
              value={event.endDateTime}
              onChange={(e) => setEvent(prev => ({ ...prev, endDateTime: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Location</Label>
          <Input
            value={event.location}
            onChange={(e) => setEvent(prev => ({ ...prev, location: e.target.value }))}
            placeholder="Event location"
          />
        </div>
        <div>
          <Label>Event Type</Label>
          <Select value={event.eventType} onValueChange={(value: any) => setEvent(prev => ({ ...prev, eventType: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="appointment">Appointment</SelectItem>
              <SelectItem value="vacation">Vacation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// SettingsModal component
function SettingsModal({ workingHours, onSave, open, onOpenChange }: { workingHours: WorkingHours[]; onSave: (newHours?: any[]) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [hours, setHours] = useState<WorkingHours[]>(workingHours);
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveHours = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/calendar/working-hours', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workingHours: hours })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Working hours updated successfully",
        });
        onSave();
        onOpenChange(false);
      } else {
        throw new Error('Failed to update working hours');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update working hours",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setHours(workingHours);
    onOpenChange(false);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Calendar Settings
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">Working Hours</h3>
          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day, index) => {
              const dayHours = hours.find(h => h.dayOfWeek === index) || {
                id: 0,
                dayOfWeek: index,
                startTime: '09:00',
                endTime: '17:00',
                isActive: index >= 1 && index <= 5 // Monday to Friday
              };
              
              return (
                <div key={day} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                  <div className="w-24">
                    <span className="text-sm font-medium">{day}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayHours.startTime}
                      onChange={(e) => {
                        const newHours = [...hours];
                        const existingIndex = newHours.findIndex(h => h.dayOfWeek === index);
                        if (existingIndex >= 0) {
                          newHours[existingIndex].startTime = e.target.value;
                        } else {
                          newHours.push({ ...dayHours, startTime: e.target.value });
                        }
                        setHours(newHours);
                      }}
                      disabled={!dayHours.isActive}
                      className="w-32"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="time"
                      value={dayHours.endTime}
                      onChange={(e) => {
                        const newHours = [...hours];
                        const existingIndex = newHours.findIndex(h => h.dayOfWeek === index);
                        if (existingIndex >= 0) {
                          newHours[existingIndex].endTime = e.target.value;
                        } else {
                          newHours.push({ ...dayHours, endTime: e.target.value });
                        }
                        setHours(newHours);
                      }}
                      disabled={!dayHours.isActive}
                      className="w-32"
                    />
                    <Button
                      variant={dayHours.isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newHours = [...hours];
                        const existingIndex = newHours.findIndex(h => h.dayOfWeek === index);
                        if (existingIndex >= 0) {
                          newHours[existingIndex].isActive = !dayHours.isActive;
                        } else {
                          newHours.push({ ...dayHours, isActive: !dayHours.isActive });
                        }
                        setHours(newHours);
                      }}
                    >
                      {dayHours.isActive ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSaveHours} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function Calendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Modal states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const [slotsRes, eventsRes, hoursRes] = await Promise.all([
        fetch('/api/calendar/time-slots', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/calendar/events', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/calendar/working-hours', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (slotsRes.ok && eventsRes.ok && hoursRes.ok) {
        const slots = await slotsRes.json();
        const events = await eventsRes.json();
        const hours = await hoursRes.json();
        
        setTimeSlots(Array.isArray(slots) ? slots : []);
        setEvents(Array.isArray(events) ? events : []);
        setWorkingHours(Array.isArray(hours) ? hours : []);
      } else {
        toast({
          title: "Error loading calendar data",
          description: "You may not have permissions to view this calendar.",
          variant: "destructive",
        });
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load calendar data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Optimistic update handlers for child components
  const handleSlotsUpdate = (updatedSlots?: any[]) => {
    if (updatedSlots) {
      setTimeSlots(updatedSlots);
    } else {
      // Fallback to full reload only if no optimistic data provided
      loadCalendarData();
    }
  };

  const handleEventsUpdate = (updatedEvents?: any[]) => {
    if (updatedEvents) {
      setEvents(updatedEvents);
    } else {
      loadCalendarData();
    }
  };

  const handleWorkingHoursUpdate = (updatedHours?: any[]) => {
    if (updatedHours) {
      setWorkingHours(updatedHours);
    } else {
      loadCalendarData();
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0]);
    setViewMode('day');
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      // Implement week change logic
    } else {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 1);
      setSelectedDate(newDate.toISOString().split('T')[0]);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      // Implement week change logic
    } else {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      setSelectedDate(newDate.toISOString().split('T')[0]);
    }
  };

  const getTitle = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'day') {
      return new Date(selectedDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    return 'Calendar';
  };

  const getStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaySlots = timeSlots.filter(slot => slot.date === today);
    const availableSlots = todaySlots.filter(slot => slot.status === 'available');
    const bookedSlots = todaySlots.filter(slot => slot.status === 'booked');
    const blockedSlots = todaySlots.filter(slot => slot.status === 'blocked');

    return {
      total: todaySlots.length,
      available: availableSlots.length,
      booked: bookedSlots.length,
      blocked: blockedSlots.length
    };
  };

  const stats = getStats();

  const renderView = () => {
    if (isLoading) {
      return (
        <div className="text-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calendar...</p>
        </div>
      );
    }

    switch (viewMode) {
      case 'month':
        return <MonthView 
          currentDate={currentDate} 
          timeSlots={timeSlots}
          events={events}
          onDateClick={handleDateClick}
        />;
      case 'week':
        return <WeekView currentDate={currentDate} timeSlots={timeSlots} events={events} />;
      case 'day':
        return <DayView 
          date={selectedDate} 
          timeSlots={timeSlots}
          events={events}
          onSlotUpdate={handleSlotsUpdate}
        />;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with Stats */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar Management</h1>
            <p className="text-gray-600">Manage your availability and schedule</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm bg-white rounded-lg border p-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{stats.available} Available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>{stats.booked} Booked</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>{stats.blocked} Blocked</span>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-xl font-semibold min-w-[250px] text-center">
                    {getTitle()}
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <Tabs value={viewMode} onValueChange={setViewMode}>
                  <TabsList>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="day">Day</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowBulkModal(true)}>
                  <Target className="h-4 w-4 mr-2" />
                  Bulk Setup
                </Button>
                
                <Button variant="outline" onClick={() => setShowEventModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
                
                <Button variant="outline" onClick={() => setShowSettingsModal(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderView()}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <BulkAvailabilityModal onSave={handleSlotsUpdate} open={showBulkModal} onOpenChange={setShowBulkModal} />
      </Dialog>

      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <EventModal onSave={handleEventsUpdate} open={showEventModal} onOpenChange={setShowEventModal} />
      </Dialog>

      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <SettingsModal workingHours={workingHours} onSave={handleWorkingHoursUpdate} open={showSettingsModal} onOpenChange={setShowSettingsModal} />
      </Dialog>
    </MainLayout>
  );
} 