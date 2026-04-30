/**
 * Platform Availability Manager Component
 * Allows admins to configure platform availability schedules and emergency support text
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Save, Clock } from 'lucide-react';
import api from '@/lib/api';
import type { PlatformAvailability, AvailabilityFormData } from '@/types/contact';

interface AvailabilityResponse {
  availability: PlatformAvailability[];
  emergency_support_text: string | null;
}

interface DaySchedule {
  day_of_week: string;
  is_open: boolean;
  hours_text: string;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

export default function PlatformAvailabilityManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [emergencySupportText, setEmergencySupportText] = useState('');

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const response = await api.get<AvailabilityResponse>('/api/admin/platform/availability');
      
      // Map existing availability data to schedules
      const existingSchedules = response.availability;
      const mappedSchedules = DAYS_OF_WEEK.map(day => {
        const existing = existingSchedules.find(s => s.day_of_week === day.value);
        return {
          day_of_week: day.value,
          is_open: existing?.is_open ?? true,
          hours_text: existing?.hours_text ?? ''
        };
      });

      setSchedules(mappedSchedules);
      setEmergencySupportText(response.emergency_support_text || '');
    } catch (error: any) {
      console.error('Failed to fetch availability:', error);
      toast.error(error.message || 'Failed to load availability data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch availability data on mount
  useEffect(() => {
    fetchAvailability();
  }, []);

  const handleToggleDay = (dayValue: string, isOpen: boolean) => {
    setSchedules(prev =>
      prev.map(schedule =>
        schedule.day_of_week === dayValue
          ? { ...schedule, is_open: isOpen }
          : schedule
      )
    );
  };

  const handleHoursChange = (dayValue: string, hoursText: string) => {
    setSchedules(prev =>
      prev.map(schedule =>
        schedule.day_of_week === dayValue
          ? { ...schedule, hours_text: hoursText }
          : schedule
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const formData: AvailabilityFormData = {
        schedules,
        emergency_support_text: emergencySupportText
      };

      await api.put('/api/admin/platform/availability', formData);

      toast.success('Platform availability updated successfully');
    } catch (error: any) {
      console.error('Failed to save availability:', error);
      toast.error(error.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Availability Schedule
          </CardTitle>
          <CardDescription>
            Configure the platform's support hours for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Availability Schedule Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Day</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS_OF_WEEK.map((day, index) => {
                    const schedule = schedules.find(s => s.day_of_week === day.value);
                    if (!schedule) return null;

                    return (
                      <tr
                        key={day.value}
                        className={index !== DAYS_OF_WEEK.length - 1 ? 'border-b' : ''}
                      >
                        <td className="p-3 font-medium">{day.label}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={schedule.is_open}
                              onCheckedChange={(checked) => handleToggleDay(day.value, checked)}
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          {schedule.is_open ? (
                            <Input
                              value={schedule.hours_text}
                              onChange={(e) => handleHoursChange(day.value, e.target.value)}
                              placeholder="e.g., 9:00 AM – 6:00 PM EST"
                              className="max-w-md"
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency Support</CardTitle>
          <CardDescription>
            Additional information about emergency support availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="emergency-support">Emergency Support Text</Label>
            <Textarea
              id="emergency-support"
              value={emergencySupportText}
              onChange={(e) => setEmergencySupportText(e.target.value)}
              placeholder="e.g., For urgent issues outside business hours, please email emergency@example.com"
              rows={4}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              This text will be displayed below the availability schedule on the Contact page
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
