import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    calendarDays.push(null);
  }

  // Add days of the current month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const getEventsForDay = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return events.filter(event => event.startDateTime.startsWith(dateString));
  };

  const getTimeSlotsForDay = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return timeSlots.filter(slot => slot.date === dateString);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-7 gap-px text-center text-sm font-semibold text-gray-600 border-b pb-2 mb-2">
        {daysOfWeek.map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="border-r border-b"></div>;
          }

          const dayEvents = getEventsForDay(day);
          const dayTimeSlots = getTimeSlotsForDay(day);
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "relative p-2 border-r border-b h-28 cursor-pointer hover:bg-gray-50 transition-colors",
                { 'bg-blue-50': isToday(day) }
              )}
              onClick={() => onDateClick(day)}
            >
              <span className={cn(
                "font-medium",
                { 'text-blue-600': isToday(day) }
              )}>
                {day.getDate()}
              </span>
              <div className="mt-1 text-xs space-y-1">
                {dayEvents.length > 0 && (
                  <Badge variant="secondary" className="w-full justify-start">
                    {dayEvents.length} Event{dayEvents.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {dayTimeSlots.length > 0 && (
                  <Badge variant="outline" className="w-full justify-start">
                    {dayTimeSlots.length} Slot{dayTimeSlots.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 