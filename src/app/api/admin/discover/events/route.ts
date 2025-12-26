/**
 * Admin API: Discover Events Management
 * 
 * GET /api/admin/discover/events - List all events
 * POST /api/admin/discover/events - Create new event (UnifiedEvent format)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { RecurrencePattern } from '@/types';

// Convert local time to UTC ISO string
function toUTCDateTime(date: string, time: string, timezone: string): string {
  // Create a date string in the given timezone
  const dateTimeStr = `${date}T${time}:00`;
  
  // Parse the date as if it's in the given timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Create a date in local time and adjust for timezone
  const localDate = new Date(dateTimeStr);
  const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = tzDate.getTime() - utcDate.getTime();
  
  const resultDate = new Date(localDate.getTime() - offset);
  return resultDate.toISOString();
}

// Calculate duration in minutes from start and end times
function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const eventsSnapshot = await adminDb
      .collection('events')
      .orderBy('date', 'asc')
      .get();

    const events = eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Normalize event data to support both old and new schema
      let date = data.date;
      let startTime = data.startTime;
      let endTime = data.endTime;
      
      // If we have startDateTime (UnifiedEvent), extract date/time for display
      if (data.startDateTime) {
        try {
          const startDT = new Date(data.startDateTime);
          // Format in the event's timezone
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: data.timezone || 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          date = formatter.format(startDT);
          
          const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: data.timezone || 'UTC',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          startTime = timeFormatter.format(startDT);
          
          if (data.endDateTime) {
            const endDT = new Date(data.endDateTime);
            endTime = timeFormatter.format(endDT);
          } else if (data.durationMinutes) {
            const endDT = new Date(startDT.getTime() + data.durationMinutes * 60000);
            endTime = timeFormatter.format(endDT);
          }
        } catch (e) {
          console.error('Error parsing dates:', e);
        }
      }
      
      return {
        id: doc.id,
        ...data,
        // Ensure these fields exist for the table display
        date,
        startTime,
        endTime,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[ADMIN_EVENTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields (updated for new schema)
    const requiredFields = ['title', 'date', 'startTime', 'timezone'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Calculate UTC datetime
    const startTime = body.startTime || body.time || '10:00';
    const endTime = body.endTime || calculateEndTime(startTime, body.durationMinutes || 60);
    const startDateTime = toUTCDateTime(body.date, startTime, body.timezone);
    const endDateTime = toUTCDateTime(body.date, endTime, body.timezone);
    const durationMinutes = body.durationMinutes || calculateDurationMinutes(startTime, endTime);

    // Build recurrence pattern if recurring
    let recurrence: RecurrencePattern | null = null;
    if (body.isRecurring && body.recurrence) {
      recurrence = {
        frequency: body.recurrence.frequency,
        dayOfWeek: body.recurrence.dayOfWeek,
        time: startTime,
        timezone: body.timezone,
        startDate: body.date,
        endDate: body.recurrence.endDate || null,
      };
    }

    // Create UnifiedEvent object
    const eventData = {
      // Core identification
      title: body.title,
      type: 'event' as const,
      status: 'confirmed' as const,
      
      // Media
      coverImageUrl: body.coverImageUrl || null,
      
      // Date/Time (UnifiedEvent format)
      startDateTime,
      endDateTime,
      timezone: body.timezone,
      durationMinutes,
      
      // Legacy fields for backward compatibility
      date: body.date,
      startTime,
      endTime,
      
      // Location
      locationType: body.locationType || 'online',
      locationLabel: body.locationLabel || 'Online',
      meetingLink: body.meetingLink || body.zoomLink || null,
      
      // Content
      shortDescription: body.shortDescription || body.description?.substring(0, 200) || '',
      longDescription: body.longDescription || body.description || '',
      bulletPoints: body.bulletPoints || [],
      additionalInfo: body.additionalInfo || null,
      
      // Host
      hostUserId: body.hostUserId || null,
      hostName: body.hostName || '',
      hostAvatarUrl: body.hostAvatarUrl || null,
      createdByUserId: userId,
      
      // Visibility & Organization
      visibility: 'public' as const,
      featured: body.featured || false,
      category: body.category || null,
      programIds: Array.isArray(body.programIds) ? body.programIds : [],
      squadId: null,
      
      // Attendance
      attendees: [],
      attendeeIds: [],
      maxAttendees: body.maxAttendees || null,
      
      // Recurrence
      isRecurring: body.isRecurring || false,
      recurrence,
      parentEventId: null,
      
      // Recording (for past events)
      recordingUrl: body.recordingUrl || null,
      
      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('events').add(eventData);

    // If this is a recurring event, generate initial instances
    if (eventData.isRecurring && recurrence) {
      const { generateRecurringInstances } = await import('@/lib/event-recurrence');
      const createdEvent = { id: docRef.id, ...eventData } as import('@/types').UnifiedEvent;
      await generateRecurringInstances(createdEvent);
    }

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Event created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_EVENTS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

// Helper to calculate end time
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}
