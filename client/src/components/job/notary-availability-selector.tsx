import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface NotaryAvailabilitySelectorProps {
  notaryId: string | number;
  selectedDate?: string;
  selectedTime?: string;
  onDateTimeSelect: (date: string, time: string) => void;
  disabled?: boolean;
}

interface TimeSlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked';
}

export function NotaryAvailabilitySelector({
  notaryId,
  selectedDate,
  selectedTime,
  onDateTimeSelect,
  disabled = false
}: NotaryAvailabilitySelectorProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedDateInternal, setSelectedDateInternal] = useState<Date | undefined>(
    selectedDate ? new Date(selectedDate) : undefined
  );
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'confirming' | 'confirmed' | 'error'>('idle');

  // Load notary's available slots
  const loadNotaryAvailability = async () => {
    if (!notaryId) return;

    setIsLoading(true);
    setLoadingError(null);
    setBookingStatus('idle');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingError('Authentication required. Please log in.');
        return;
      }

      // Get current month and next month's availability
      const currentDate = new Date();
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
      
      const response = await fetch(`/api/calendar/notary-availability/${notaryId}?startDate=${currentDate.toISOString().split('T')[0]}&endDate=${nextMonth.toISOString().split('T')[0]}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const slots = await response.json();
        const availableSlots = slots.filter((slot: TimeSlot) => slot.status === 'available');
        setAvailableSlots(availableSlots);
        
        // Create set of available dates for calendar
        const dateSet = new Set(availableSlots.map((slot: TimeSlot) => slot.date));
        setAvailableDates(dateSet);
        setLastUpdated(new Date());
        
        // Show success message if we have availability
        if (availableSlots.length > 0) {
          toast({
            title: "Availability Loaded",
            description: `Found ${availableSlots.length} available time slots`,
          });
        }
      } else if (response.status === 404) {
        setLoadingError('Notary not found or no calendar set up.');
      } else if (response.status === 403) {
        setLoadingError('You do not have permission to view this notary\'s availability.');
      } else {
        setLoadingError('Unable to load availability. Please try again.');
      }
    } catch (error) {
      console.error('Error loading notary availability:', error);
      setLoadingError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (notaryId) {
      loadNotaryAvailability();
    }
  }, [notaryId]);

  // Get available time slots for selected date
  const getTimeSlotsForDate = (date: string) => {
    return availableSlots.filter(slot => slot.date === date);
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDateInternal(date);
    if (date) {
      const dateString = date.toISOString().split('T')[0];
      const timeSlotsForDate = getTimeSlotsForDate(dateString);
      
      // If there are available slots and none currently selected, auto-select first one
      if (timeSlotsForDate.length > 0 && (!selectedTime || !timeSlotsForDate.some(slot => slot.startTime === selectedTime))) {
        onDateTimeSelect(dateString, timeSlotsForDate[0].startTime);
      }
    }
  };

  // Handle time selection
  const handleTimeSelect = (time: string) => {
    if (selectedDateInternal) {
      setBookingStatus('confirming');
      const dateString = selectedDateInternal.toISOString().split('T')[0];
      
      // Provide immediate feedback
      toast({
        title: "Appointment Time Selected",
        description: `Selected ${selectedDateInternal.toLocaleDateString()} at ${time}`,
      });
      
      onDateTimeSelect(dateString, time);
      setBookingStatus('confirmed');
      
      // Reset status after a delay
      setTimeout(() => setBookingStatus('idle'), 3000);
    }
  };

  // Refresh availability
  const refreshAvailability = () => {
    loadNotaryAvailability();
  };

  // Check if a date has available slots
  const isDateAvailable = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return availableDates.has(dateString);
  };

  // Disable past dates and dates without availability
  const disableDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today || !isDateAvailable(date);
  };

  const selectedDateString = selectedDateInternal?.toISOString().split('T')[0];
  const timeSlots = selectedDateString ? getTimeSlotsForDate(selectedDateString) : [];

  if (!notaryId) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Notary First</h3>
          <p className="text-gray-600">Please choose a notary to see their available appointment times.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {loadingError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{loadingError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAvailability}
              className="ml-2 h-auto p-1"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {bookingStatus === 'confirmed' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Appointment time confirmed! Your selection has been saved.
          </AlertDescription>
        </Alert>
      )}

      {lastUpdated && !isLoading && !loadingError && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Availability last updated: {lastUpdated.toLocaleTimeString()}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAvailability}
              className="ml-2 h-auto p-1"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Available Dates
            {availableDates.size > 0 && (
              <Badge variant="secondary" className="ml-2">
                {availableDates.size} days available
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading availability...</span>
            </div>
          ) : loadingError ? (
            <div className="text-center p-8">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Availability</h3>
              <p className="text-gray-600 mb-4">Please try refreshing or contact support if the problem persists.</p>
              <Button onClick={refreshAvailability} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : availableDates.size > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Green dates show available appointment times
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshAvailability}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={selectedDateInternal}
                onSelect={handleDateSelect}
                disabled={disabled ? () => true : disableDate}
                className="rounded-md border"
                modifiers={{
                  available: (date) => isDateAvailable(date)
                }}
                modifiersStyles={{
                  available: {
                    backgroundColor: '#dcfce7',
                    color: '#166534'
                  }
                }}
              />
            </div>
          ) : (
            <div className="text-center p-8">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Availability</h3>
              <p className="text-gray-600 mb-4">This notary has no available time slots in the next 60 days.</p>
              <Button onClick={refreshAvailability} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDateInternal && timeSlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Available Times - {selectedDateInternal.toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
              <Badge variant="outline" className="ml-2">
                {timeSlots.length} slots available
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedTime && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Selected: {selectedDateInternal.toLocaleDateString()} at {selectedTime}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="text-sm text-gray-600 mb-3">
                Select an available time slot for your appointment:
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.id}
                    variant={selectedTime === slot.startTime ? "default" : "outline"}
                    size="sm"
                    disabled={disabled || bookingStatus === 'confirming'}
                    onClick={() => handleTimeSelect(slot.startTime)}
                    className={cn(
                      "flex items-center gap-2 justify-center transition-all",
                      selectedTime === slot.startTime && "ring-2 ring-blue-300"
                    )}
                  >
                    {bookingStatus === 'confirming' && selectedTime === slot.startTime ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : selectedTime === slot.startTime ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : null}
                    {slot.startTime}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDateInternal && timeSlots.length === 0 && !isLoading && !loadingError && (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Time Slots Available</h3>
            <p className="text-gray-600 mb-4">
              No available time slots for {selectedDateInternal.toLocaleDateString()}. 
              Try selecting a different date or check if the notary has updated their availability.
            </p>
            <Button onClick={refreshAvailability} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Availability
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fallback inputs for when calendar is not available */}
      {!isLoading && !loadingError && availableDates.size === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Manual Date/Time Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This notary hasn't set up their calendar availability yet. You can manually enter a date and time, 
                  but please coordinate with the notary separately to confirm their availability.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={selectedDate || ''}
                    onChange={(e) => {
                      onDateTimeSelect(e.target.value, selectedTime || '');
                      toast({
                        title: "Date Selected",
                        description: "Please confirm this date with the notary directly.",
                      });
                    }}
                    disabled={disabled}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={selectedTime || ''}
                    onChange={(e) => {
                      onDateTimeSelect(selectedDate || '', e.target.value);
                      toast({
                        title: "Time Selected",
                        description: "Please confirm this time with the notary directly.",
                      });
                    }}
                    disabled={disabled}
                  />
                </div>
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Since this notary's calendar isn't connected, 
                  please contact them directly to confirm the appointment time before proceeding.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 