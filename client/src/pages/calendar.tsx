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
  Ban, // Fixed: replaced Block with Ban
  Check,
  X
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

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

// WeekView component placeholder
function WeekView({ currentDate, timeSlots, events }: { currentDate: Date; timeSlots: TimeSlot[]; events: CalendarEvent[] }) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-500">Week view coming soon...</p>
    </div>
  );
}

// EventModal component
function EventModal({ onSave }: { onSave: () => void }) {
  const { toast } = useToast();
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    location: '',
    eventType: 'personal' as const,
    isAllDay: false
  });

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Event created successfully",
        });
        setEventData({
          title: '',
          description: '',
          startDateTime: '',
          endDateTime: '',
          location: '',
          eventType: 'personal',
          isAllDay: false
        });
        onSave();
      } else {
        throw new Error('Failed to create event');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add Event</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input
            value={eventData.title}
            onChange={(e) => setEventData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Event title"
          />
        </div>
        
        <div>
          <Label>Description</Label>
          <Textarea
            value={eventData.description}
            onChange={(e) => setEventData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Event description"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start Date & Time</Label>
            <Input
              type="datetime-local"
              value={eventData.startDateTime}
              onChange={(e) => setEventData(prev => ({ ...prev, startDateTime: e.target.value }))}
            />
          </div>
          <div>
            <Label>End Date & Time</Label>
            <Input
              type="datetime-local"
              value={eventData.endDateTime}
              onChange={(e) => setEventData(prev => ({ ...prev, endDateTime: e.target.value }))}
            />
          </div>
        </div>
        
        <div>
          <Label>Location</Label>
          <Input
            value={eventData.location}
            onChange={(e) => setEventData(prev => ({ ...prev, location: e.target.value }))}
            placeholder="Event location"
          />
        </div>
        
        <div>
          <Label>Event Type</Label>
          <Select value={eventData.eventType} onValueChange={(value: any) => setEventData(prev => ({ ...prev, eventType: value }))}>
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
          <Button variant="outline">Cancel</Button>
          <Button onClick={handleSave}>Save Event</Button>
        </div>
      </div>
    </DialogContent>
  );
}

// SettingsModal component
function SettingsModal({ workingHours, onSave }: { workingHours: WorkingHours[]; onSave: () => void }) {
  const { toast } = useToast();
  const [hours, setHours] = useState<WorkingHours[]>(workingHours);

  const handleSaveHours = async () => {
    try {
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
      } else {
        throw new Error('Failed to update working hours');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update working hours",
        variant: "destructive",
      });
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Calendar Settings</DialogTitle>
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
                <div key={day} className="flex items-center gap-4">
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
          <Button variant="outline">Cancel</Button>
          <Button onClick={handleSaveHours}>Save Settings</Button>
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

  const renderView = () => {
    if (isLoading) {
      return <div className="text-center p-8">Loading calendar...</div>;
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
          onSlotUpdate={loadCalendarData}
        />;
      default:
        return null;
    }
  };

  if (user?.role !== 'notary' && user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <CalendarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Calendar Access Restricted</h3>
          <p className="text-gray-500">Calendar management is only available for notaries and administrators.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold">
                  {viewMode === 'day' 
                    ? new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <Button variant="outline" size="icon" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setCurrentDate(new Date());
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                }}
              >
                Today
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <EventModal onSave={loadCalendarData} />
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </DialogTrigger>
                <SettingsModal workingHours={workingHours} onSave={loadCalendarData} />
              </Dialog>
              
              <Tabs value={viewMode} onValueChange={setViewMode} className="w-[250px]">
                <TabsList>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="day">Day</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {renderView()}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
} 