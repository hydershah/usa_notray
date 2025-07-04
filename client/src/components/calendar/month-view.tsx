import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User,
  CalendarDays
} from 'lucide-react';

interface MonthViewProps {
  currentDate: Date;
  timeSlots: any[];
  events: any[];
  onDateClick: (date: Date) => void;
}

export function MonthView({ currentDate, timeSlots, events, onDateClick }: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.

  const calendarDays = [];

  // Add padding for days from the previous month
  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, -startDayOfWeek + i + 1);
    calendarDays.push({ date: prevDate, isCurrentMonth: false });
  }

  // Add days of the current month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ date: new Date(year, month, day), isCurrentMonth: true });
  }

  // Add padding for days from the next month
  const remainingSlots = 42 - calendarDays.length; // 6 weeks × 7 days = 42 slots
  for (let i = 1; i <= remainingSlots; i++) {
    calendarDays.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  const getEventsForDay = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return events.filter(event => event.startDateTime.startsWith(dateString));
  };

  const getTimeSlotsForDay = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return timeSlots.filter(slot => slot.date === dateString);
  };

  const getSlotStats = (date: Date) => {
    const slots = getTimeSlotsForDay(date);
    return {
      available: slots.filter(slot => slot.status === 'available').length,
      booked: slots.filter(slot => slot.status === 'booked').length,
      blocked: slots.filter(slot => slot.status === 'blocked').length,
      total: slots.length
    };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header with days of week */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden">
        {daysOfWeek.map((day, index) => (
          <div 
            key={day} 
            className={cn(
              "bg-gray-50 py-3 px-2 text-center text-sm font-semibold",
              isWeekend(new Date(2024, 0, index)) && "text-gray-400"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          const dayEvents = getEventsForDay(date);
          const slotStats = getSlotStats(date);
          const isCurrentDay = isToday(date);
          const isWeekendDay = isWeekend(date);
          
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "relative bg-white min-h-[120px] p-2 cursor-pointer hover:bg-gray-50 transition-colors",
                !isCurrentMonth && "bg-gray-50 text-gray-400",
                isCurrentDay && "bg-blue-50 ring-2 ring-blue-200",
                isWeekendDay && "bg-gray-50/50"
              )}
              onClick={() => onDateClick(date)}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-sm font-medium",
                  isCurrentDay && "text-blue-600 font-bold",
                  !isCurrentMonth && "text-gray-400",
                  isWeekendDay && isCurrentMonth && "text-gray-600"
                )}>
                  {date.getDate()}
                </span>
                {isCurrentDay && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </div>

              {/* Content area */}
              <div className="space-y-1">
                {/* Events */}
                {dayEvents.length > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <CalendarDays className="h-3 w-3 text-blue-600" />
                    <span className="text-blue-600 font-medium">
                      {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Time slots summary */}
                {slotStats.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-600">
                        {slotStats.total} slot{slotStats.total > 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {/* Status indicators */}
                    <div className="flex items-center gap-2 text-xs">
                      {slotStats.available > 0 && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">{slotStats.available}</span>
                        </div>
                      )}
                      {slotStats.booked > 0 && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-blue-600" />
                          <span className="text-blue-600">{slotStats.booked}</span>
                        </div>
                      )}
                      {slotStats.blocked > 0 && (
                        <div className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-600" />
                          <span className="text-red-600">{slotStats.blocked}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Special indicators */}
                {slotStats.total === 0 && isCurrentMonth && !isWeekendDay && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>No slots</span>
                  </div>
                )}
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-blue-500 opacity-0 hover:opacity-5 transition-opacity rounded-sm pointer-events-none"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 