import { eq, and, not, inArray, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { 
  users, 
  jobs, 
  titleCompanies,
  notaryTimeSlots, 
  notaryAssignmentLog,
  calendarEvents,
  InsertNotaryAssignmentLog 
} from "../shared/schema";

export interface NotaryQualifications {
  requiresNSA: boolean;
  requiresSpanishSpeaking: boolean;
}

export interface TimeSlotRequest {
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface AvailableNotary {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  isNotarySigningAgent: boolean;
  isSpanishSpeaking: boolean;
  maxConcurrentJobs: number;
  currentJobCount: number;
  availableSlots: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
  }[];
}

export interface AggregatedAvailability {
  date: string;
  timeSlots: {
    startTime: string;
    endTime: string;
    availableNotaries: number[]; // notary IDs available for this slot
  }[];
}

export class RandomNotaryService {
  
  /**
   * Get all contractor notaries who meet the job qualifications
   */
  async getQualifiedNotaries(qualifications: NotaryQualifications, excludeNotaryIds: number[] = []): Promise<AvailableNotary[]> {
    let whereConditions = [
      eq(users.role, 'notary'),
      eq(users.isActive, true)
      // Removed restrictive notaryType filter to include all active notaries
    ];

    // Add qualification filters
    if (qualifications.requiresNSA) {
      whereConditions.push(eq(users.isNotarySigningAgent, true));
    }

    if (qualifications.requiresSpanishSpeaking) {
      whereConditions.push(eq(users.isSpanishSpeaking, true));
    }

    // Exclude rejected notaries
    if (excludeNotaryIds.length > 0) {
      whereConditions.push(not(inArray(users.id, excludeNotaryIds)));
    }

    const qualifiedNotaries = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isNotarySigningAgent: users.isNotarySigningAgent,
        isSpanishSpeaking: users.isSpanishSpeaking,
        maxConcurrentJobs: users.maxConcurrentJobs,
      })
      .from(users)
      .where(and(...whereConditions));

    // Get current job counts for each notary
    const notariesWithJobCounts = await Promise.all(
      qualifiedNotaries.map(async (notary) => {
        const currentJobCount = await this.getCurrentJobCount(notary.id);
        return {
          ...notary,
          currentJobCount,
          availableSlots: [] // Will be populated later
        };
      })
    );

    // Filter out notaries who are at their maximum concurrent job limit
    return notariesWithJobCounts.filter(notary => 
      notary.currentJobCount < (notary.maxConcurrentJobs || 1)
    );
  }

  /**
   * Get current job count for a notary (open and pending jobs)
   */
  async getCurrentJobCount(notaryId: number): Promise<number> {
    const result = await db
      .select({ count: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.notaryId, notaryId),
          inArray(jobs.jobStatus, ['open', 'pending'])
        )
      );

    return result.length;
  }

  /**
   * Get available time slots for qualified notaries on a specific date
   */
  async getAvailableSlots(notaryIds: number[], date: string): Promise<Map<number, any[]>> {
    const slots = await db
      .select()
      .from(notaryTimeSlots)
      .where(
        and(
          inArray(notaryTimeSlots.notaryId, notaryIds),
          eq(notaryTimeSlots.date, date),
          eq(notaryTimeSlots.status, 'available')
        )
      )
      .orderBy(notaryTimeSlots.startTime);

    const slotsByNotary = new Map<number, any[]>();
    slots.forEach(slot => {
      if (!slotsByNotary.has(slot.notaryId)) {
        slotsByNotary.set(slot.notaryId, []);
      }
      slotsByNotary.get(slot.notaryId)!.push(slot);
    });

    return slotsByNotary;
  }

  /**
   * Aggregate availability from multiple notaries into a single calendar view
   */
  async aggregateAvailability(
    qualifications: NotaryQualifications, 
    date: string, 
    excludeNotaryIds: number[] = []
  ): Promise<AggregatedAvailability> {
    // Get qualified notaries
    const qualifiedNotaries = await this.getQualifiedNotaries(qualifications, excludeNotaryIds);
    
    if (qualifiedNotaries.length === 0) {
      return { date, timeSlots: [] };
    }

    const notaryIds = qualifiedNotaries.map(n => n.id);
    
    // Get all available slots for the date
    const slotsByNotary = await this.getAvailableSlots(notaryIds, date);

    // Aggregate overlapping time slots
    const allSlots: { startTime: string; endTime: string; notaryId: number }[] = [];
    
    slotsByNotary.forEach((slots, notaryId) => {
      slots.forEach(slot => {
        allSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          notaryId
        });
      });
    });

    // Sort slots by start time
    allSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Merge overlapping slots and track which notaries are available
    const aggregatedSlots: { startTime: string; endTime: string; availableNotaries: number[] }[] = [];
    
    for (const slot of allSlots) {
      // Find if this slot overlaps with any existing aggregated slot
      let merged = false;
      
      for (const aggSlot of aggregatedSlots) {
        if (this.slotsOverlap(slot, aggSlot)) {
          // Merge the slots
          aggSlot.startTime = this.getEarlierTime(aggSlot.startTime, slot.startTime);
          aggSlot.endTime = this.getLaterTime(aggSlot.endTime, slot.endTime);
          
          // Add notary if not already included
          if (!aggSlot.availableNotaries.includes(slot.notaryId)) {
            aggSlot.availableNotaries.push(slot.notaryId);
          }
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        aggregatedSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          availableNotaries: [slot.notaryId]
        });
      }
    }

    return { date, timeSlots: aggregatedSlots };
  }

  /**
   * Select a random notary from those available at a specific time
   */
  async selectRandomNotary(
    qualifications: NotaryQualifications,
    timeSlot: TimeSlotRequest,
    excludeNotaryIds: number[] = []
  ): Promise<AvailableNotary | null> {
    // Get qualified notaries
    const qualifiedNotaries = await this.getQualifiedNotaries(qualifications, excludeNotaryIds);
    
    if (qualifiedNotaries.length === 0) {
      return null;
    }

    const notaryIds = qualifiedNotaries.map(n => n.id);
    
    // Find notaries available for the specific time slot
    const availableNotaries = await db
      .select()
      .from(notaryTimeSlots)
      .where(
        and(
          inArray(notaryTimeSlots.notaryId, notaryIds),
          eq(notaryTimeSlots.date, timeSlot.date),
          eq(notaryTimeSlots.status, 'available'),
          lte(notaryTimeSlots.startTime, timeSlot.startTime),
          gte(notaryTimeSlots.endTime, timeSlot.endTime)
        )
      );

    if (availableNotaries.length === 0) {
      return null;
    }

    // Get the notary IDs that are available for this time slot
    const availableNotaryIds = availableNotaries.map(slot => slot.notaryId);
    const availableQualifiedNotaries = qualifiedNotaries.filter(n => 
      availableNotaryIds.includes(n.id)
    );

    if (availableQualifiedNotaries.length === 0) {
      return null;
    }

    // Randomly select one notary
    const randomIndex = Math.floor(Math.random() * availableQualifiedNotaries.length);
    return availableQualifiedNotaries[randomIndex];
  }

  /**
   * Assign a job to a notary and update calendar
   */
  async assignNotaryToJob(
    jobId: number, 
    notaryId: number, 
    timeSlot: TimeSlotRequest,
    assignmentType: 'random' | 'preferred' | 'manual' = 'random'
  ): Promise<boolean> {
    try {
      // Start a transaction
      await db.transaction(async (tx) => {
        // Update the job with notary assignment
        await tx
          .update(jobs)
          .set({
            notaryId,
            selectedDate: timeSlot.date,
            selectedTime: timeSlot.startTime,
            jobStatus: 'pending',
            isRandomAssignment: assignmentType === 'random'
          })
          .where(eq(jobs.id, jobId));

        // Find and book the time slot
        const availableSlots = await tx
          .select()
          .from(notaryTimeSlots)
          .where(
            and(
              eq(notaryTimeSlots.notaryId, notaryId),
              eq(notaryTimeSlots.date, timeSlot.date),
              eq(notaryTimeSlots.status, 'available'),
              lte(notaryTimeSlots.startTime, timeSlot.startTime),
              gte(notaryTimeSlots.endTime, timeSlot.endTime)
            )
          )
          .limit(1);

        if (availableSlots.length > 0) {
          // Book the time slot
          await tx
            .update(notaryTimeSlots)
            .set({
              status: 'booked',
              jobId: jobId
            })
            .where(eq(notaryTimeSlots.id, availableSlots[0].id));
        }

        // Log the assignment
        await tx
          .insert(notaryAssignmentLog)
          .values({
            jobId,
            notaryId,
            assignmentType,
            assignmentStatus: 'assigned'
          });

        // Create calendar event for the assigned notary
        try {
          // Get job details for calendar event
          const jobDetails = await tx
            .select()
            .from(jobs)
            .where(eq(jobs.id, jobId))
            .limit(1);

          if (jobDetails.length > 0) {
            const job = jobDetails[0];
            const startDateTime = new Date(`${timeSlot.date} ${timeSlot.startTime}`);
            const endDateTime = new Date(`${timeSlot.date} ${timeSlot.endTime}`);
            
            await tx.insert(calendarEvents).values({
              notaryId,
              title: `Notarization Job #${jobId}`,
              description: `Job for ${job.titleCompany} - ${job.closingType}\nProperty: ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState}`,
              startDateTime,
              endDateTime,
              location: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`,
              eventType: 'job',
              jobId: jobId,
              isAllDay: false
            });
          }
        } catch (calendarError) {
          console.warn('Failed to create calendar event for notary assignment:', calendarError);
        }
      });

      return true;
    } catch (error) {
      console.error('Error assigning notary to job:', error);
      return false;
    }
  }

  /**
   * Handle notary rejection and attempt re-assignment
   */
  async handleNotaryRejection(
    jobId: number, 
    notaryId: number, 
    rejectionReason?: string
  ): Promise<AvailableNotary | null> {
    try {
      // Get the current job
      const job = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (job.length === 0) {
        throw new Error('Job not found');
      }

      const currentJob = job[0];

      // Update assignment log with rejection
      await db
        .update(notaryAssignmentLog)
        .set({
          assignmentStatus: 'rejected',
          respondedAt: new Date(),
          rejectionReason
        })
        .where(
          and(
            eq(notaryAssignmentLog.jobId, jobId),
            eq(notaryAssignmentLog.notaryId, notaryId),
            eq(notaryAssignmentLog.assignmentStatus, 'assigned')
          )
        );

      // Add rejected notary to the list
      const rejectedNotaries = currentJob.rejectedNotaries || [];
      const updatedRejectedNotaries = [...rejectedNotaries, notaryId.toString()];

      // Increment assignment attempts
      await db
        .update(jobs)
        .set({
          rejectedNotaries: updatedRejectedNotaries,
          assignmentAttempts: (currentJob.assignmentAttempts || 0) + 1,
          notaryId: null, // Clear current assignment
          jobStatus: 'open' // Back to open status
        })
        .where(eq(jobs.id, jobId));

      // Free up the time slot
      await db
        .update(notaryTimeSlots)
        .set({
          status: 'available',
          jobId: null
        })
        .where(
          and(
            eq(notaryTimeSlots.jobId, jobId),
            eq(notaryTimeSlots.notaryId, notaryId)
          )
        );

      // Try to assign a new random notary
      if (currentJob.selectedDate && currentJob.selectedTime) {
        const qualifications = {
          requiresNSA: currentJob.requiresNSA || false,
          requiresSpanishSpeaking: currentJob.requiresSpanishSpeaking || false
        };

        const timeSlot = {
          date: currentJob.selectedDate,
          startTime: currentJob.selectedTime,
          endTime: this.addHourToTime(currentJob.selectedTime) // Assume 1-hour appointment
        };

        const excludeIds = updatedRejectedNotaries.map(id => parseInt(id));
        const newNotary = await this.selectRandomNotary(qualifications, timeSlot, excludeIds);

        if (newNotary) {
          await this.assignNotaryToJob(jobId, newNotary.id, timeSlot, 'random');
          return newNotary;
        }
      }

      return null;
    } catch (error) {
      console.error('Error handling notary rejection:', error);
      return null;
    }
  }

  /**
   * Send priority alert to admin when no notaries are available
   */
  async sendPriorityAlert(jobId: number, message: string): Promise<void> {
    // This would integrate with your notification system
    // For now, we'll just log it
    console.log(`PRIORITY ALERT for Job ${jobId}: ${message}`);
    
    // In a real implementation, you might:
    // - Send email to admin
    // - Create a system notification
    // - Log to a priority alerts table
    // - Send SMS/Slack notification
  }

  // Helper methods
  private slotsOverlap(slot1: any, slot2: any): boolean {
    return slot1.startTime < slot2.endTime && slot2.startTime < slot1.endTime;
  }

  private getEarlierTime(time1: string, time2: string): string {
    return time1 <= time2 ? time1 : time2;
  }

  private getLaterTime(time1: string, time2: string): string {
    return time1 >= time2 ? time1 : time2;
  }

  private addHourToTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const newHours = (hours + 1) % 24;
    return `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export const randomNotaryService = new RandomNotaryService(); 