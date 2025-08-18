import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { validateSchedulingDateTime, getMinimumTimeForDate, isDateTimeInPast, isDateSelectable } from '@/lib/utils/timeValidation';

export function TimeValidationTest() {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [validationResult, setValidationResult] = useState('');

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setSelectedDate(date);
    setValidationResult('');
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    setSelectedTime(time);
    
    if (selectedDate && time) {
      const validation = validateSchedulingDateTime(selectedDate, time);
      setValidationResult(validation.isValid ? '✅ Valid time' : `❌ ${validation.error}`);
    }
  };

  const testPastTime = () => {
    const today = new Date().toISOString().split('T')[0];
    const pastTime = '09:00'; // This would be in the past if it's afternoon
    const isPast = isDateTimeInPast(today, pastTime);
    setValidationResult(`Testing past time (${today} ${pastTime}): ${isPast ? '❌ In past' : '✅ Valid'}`);
  };

  const testFutureTime = () => {
    const today = new Date().toISOString().split('T')[0];
    const futureTime = '18:00'; // This would be valid
    const isPast = isDateTimeInPast(today, futureTime);
    setValidationResult(`Testing future time (${today} ${futureTime}): ${isPast ? '❌ In past' : '✅ Valid'}`);
  };

  const testTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const isSelectable = isDateSelectable(today);
    setValidationResult(`Testing today's date (${today}): ${isSelectable ? '✅ Selectable' : '❌ Not selectable'}`);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Time Validation Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="testDate">Date</Label>
          <Input
            id="testDate"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        
        <div>
          <Label htmlFor="testTime">Time</Label>
          <Input
            id="testTime"
            type="time"
            value={selectedTime}
            min={getMinimumTimeForDate(selectedDate)}
            onChange={handleTimeChange}
          />
        </div>

        {validationResult && (
          <div className="p-3 rounded-md bg-gray-100">
            <p className="text-sm">{validationResult}</p>
          </div>
        )}

        <div className="space-y-2">
          <Button onClick={testPastTime} variant="outline" size="sm">
            Test Past Time
          </Button>
          <Button onClick={testFutureTime} variant="outline" size="sm">
            Test Future Time
          </Button>
          <Button onClick={testTodayDate} variant="outline" size="sm">
            Test Today's Date
          </Button>
        </div>

        <div className="text-xs text-gray-500">
          <p>Minimum time for today: {getMinimumTimeForDate(new Date().toISOString().split('T')[0])}</p>
          <p>Current time: {new Date().toTimeString().slice(0, 5)}</p>
          <p>Today's date: {new Date().toISOString().split('T')[0]}</p>
        </div>
      </CardContent>
    </Card>
  );
} 