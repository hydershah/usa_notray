import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "../../db";
import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";
import { cacheUserData } from "../../middleware/cache-middleware";

// Define the extended request interface for authentication
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, and, gte, lte } from "drizzle-orm";

import {
  notaryTimeSlots,
  calendarEvents,
  notaryWorkingHours,
  users,
} from "@shared/schema";

export async function calandarRoutes(app: Express): Promise<Server> {
  app.get(
    "/api/calendar/time-slots",
    verifyToken,
    cacheUserData(180),
    async (req: any, res) => {
      try {
        const { month, year } = req.query;
        const notaryId = req.user.id;

        if (req.user.role !== "notary" && req.user.role !== "admin") {
          return res.status(403).json({ error: "Access denied" });
        }

        let query = db
          .select()
          .from(notaryTimeSlots)
          .where(eq(notaryTimeSlots.notaryId, notaryId))
          .orderBy(notaryTimeSlots.date, notaryTimeSlots.startTime);

        // Filter by month/year if provided
        if (month && year) {
          const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
          const endDate = new Date(parseInt(year), parseInt(month), 0)
            .toISOString()
            .split("T")[0];
          query = query.where(
            and(
              gte(notaryTimeSlots.date, startDate),
              lte(notaryTimeSlots.date, endDate)
            )
          );
        }

        const timeSlots = await query;
        res.json(timeSlots);
      } catch (error) {
        console.error("Error fetching time slots:", error);
        res.status(500).json({ error: "Failed to fetch time slots" });
      }
    }
  );

  app.post("/api/calendar/time-slots", verifyToken, async (req: any, res) => {
    try {
      const notaryId = req.user.id;
      const { date, startTime, endTime, status, blockReason } = req.body;

      if (req.user.role !== "notary" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!date || !startTime || !endTime) {
        return res.status(400).json({
          error:
            "Missing required fields: date, startTime, and endTime are required",
        });
      }
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({
          error: "Invalid time format. Please use HH:MM format (e.g., 09:30)",
        });
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({
          error: "Invalid date format. Please use YYYY-MM-DD format",
        });
      }

      const newSlot = await db
        .insert(notaryTimeSlots)
        .values({
          notaryId,
          date,
          startTime,
          endTime,
          status: status || "available",
          blockReason,
          isManualBlock: status === "blocked",
        })
        .returning();

      try {
        const { redisCache } = await import("./services/redis-cache");
        await redisCache.delPattern(`user:${notaryId}:*calendar*`);
        await redisCache.delPattern(`*calendar*`);
        console.log(
          `🧹 Invalidated calendar cache for user ${notaryId} after slot creation`
        );
      } catch (cacheError) {
        console.error("Failed to invalidate calendar cache:", cacheError);
      }

      res.json(newSlot[0]);
    } catch (error) {
      console.error("Error creating time slot:", error);
      res.status(500).json({ error: "Failed to create time slot" });
    }
  });

  app.post("/api/calendar/bulk-slots", verifyToken, async (req: any, res) => {
    try {
      const notaryId = req.user.id;
      const { date, startTime, endTime, status, blockReason } = req.body;

      if (req.user.role !== "notary" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const slots = [];
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);

      while (start < end) {
        const slotStartTime = start.toTimeString().slice(0, 5);
        const slotEndTime = new Date(start.getTime() + 15 * 60000)
          .toTimeString()
          .slice(0, 5);

        const existingSlot = await db
          .select()
          .from(notaryTimeSlots)
          .where(
            and(
              eq(notaryTimeSlots.notaryId, notaryId),
              eq(notaryTimeSlots.date, date),
              eq(notaryTimeSlots.startTime, slotStartTime)
            )
          );

        if (existingSlot.length === 0) {
          slots.push({
            notaryId,
            date,
            startTime: slotStartTime,
            endTime: slotEndTime,
            status: status || "available",
            blockReason: status === "blocked" ? blockReason : null,
            isManualBlock: status === "blocked",
          });
        }

        start.setMinutes(start.getMinutes() + 15);
      }

      if (slots.length > 0) {
        await db.insert(notaryTimeSlots).values(slots);
      }

      res.json({
        success: true,
        message: `Created ${slots.length} time slots`,
        slotsCreated: slots.length,
      });
    } catch (error) {
      console.error("Error creating bulk time slots:", error);
      res.status(500).json({ error: "Failed to create bulk time slots" });
    }
  });

  app.post(
    "/api/calendar/bulk-availability",
    verifyToken,
    async (req: any, res) => {
      try {
        const notaryId = req.user.id;
        const { dateRange, timeRange, daysOfWeek, type, blockReason } =
          req.body;

        if (req.user.role !== "notary" && req.user.role !== "admin") {
          return res.status(403).json({ error: "Access denied" });
        }

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        // Validate date range
        const daysDiff = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 365) {
          return res
            .status(400)
            .json({ error: "Date range cannot exceed 365 days" });
        }
        const existingSlots = await db
          .select({
            date: notaryTimeSlots.date,
            startTime: notaryTimeSlots.startTime,
          })
          .from(notaryTimeSlots)
          .where(
            and(
              eq(notaryTimeSlots.notaryId, notaryId),
              gte(notaryTimeSlots.date, dateRange.start),
              lte(notaryTimeSlots.date, dateRange.end)
            )
          );
        const existingSlotsSet = new Set(
          existingSlots.map((slot) => `${slot.date}-${slot.startTime}`)
        );

        const allSlots = [];
        const timeSlotTemplates = [];
        const start = new Date(`1970-01-01T${timeRange.start}:00`);
        const end = new Date(`1970-01-01T${timeRange.end}:00`);

        while (start < end) {
          const slotStartTime = start.toTimeString().slice(0, 5);
          const slotEndTime = new Date(start.getTime() + 15 * 60000)
            .toTimeString()
            .slice(0, 5);
          timeSlotTemplates.push({
            startTime: slotStartTime,
            endTime: slotEndTime,
          });
          start.setMinutes(start.getMinutes() + 15);
        }

        for (
          let date = new Date(startDate);
          date <= endDate;
          date.setDate(date.getDate() + 1)
        ) {
          const dayOfWeek = date.getDay();

          if (daysOfWeek.includes(dayOfWeek)) {
            const dateString = date.toISOString().split("T")[0];

            for (const timeSlot of timeSlotTemplates) {
              const slotKey = `${dateString}-${timeSlot.startTime}`;

              if (!existingSlotsSet.has(slotKey)) {
                allSlots.push({
                  notaryId,
                  date: dateString,
                  startTime: timeSlot.startTime,
                  endTime: timeSlot.endTime,
                  status: type || "available",
                  blockReason: type === "blocked" ? blockReason : null,
                  isManualBlock: type === "blocked",
                });
              }
            }
          }
        }
        let totalCreated = 0;

        if (allSlots.length > 0) {
          const batchSize = 500;

          for (let i = 0; i < allSlots.length; i += batchSize) {
            const batch = allSlots.slice(i, i + batchSize);

            try {
              await db.insert(notaryTimeSlots).values(batch);
              totalCreated += batch.length;
            } catch (batchError) {
              console.error(
                `Error inserting batch ${i / batchSize + 1}:`,
                batchError
              );
              // Continue with next batch even if one fails
            }
          }
        }

        try {
          const { redisCache } = await import("../../services/redis-cache");
          await redisCache.delPattern(`user:${notaryId}:*calendar*`);
          await redisCache.delPattern(`*calendar*`);
          console.log(
            `🧹 Invalidated calendar cache for user ${notaryId} after bulk setup`
          );
        } catch (cacheError) {
          console.error("Failed to invalidate calendar cache:", cacheError);
        }

        res.json({
          success: true,
          message: `Created ${totalCreated} time slots across ${daysDiff + 1} days`,
          slotsCreated: totalCreated,
          totalDays: daysDiff + 1,
          slotsPerDay: timeSlotTemplates.length,
        });
      } catch (error) {
        console.error("Error creating bulk availability:", error);
        res.status(500).json({ error: "Failed to create bulk availability" });
      }
    }
  );

  app.put("/api/calendar/time-slots/:id", verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const slotId = parseInt(req.params.id);
      const updates = req.body;

      if (req.user?.role !== "notary" && req.user?.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const existingSlot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.notaryId, notaryId)
          )
        );

      if (existingSlot.length === 0) {
        return res.status(404).json({ error: "Time slot not found" });
      }

      const updatedSlot = await db
        .update(notaryTimeSlots)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(notaryTimeSlots.id, slotId))
        .returning();

      try {
        const { redisCache } = await import("../../services/redis-cache");
        await redisCache.delPattern(`user:${notaryId}:*calendar*`);
        await redisCache.delPattern(`*calendar*`);
        console.log(
          `🧹 Invalidated calendar cache for user ${notaryId} after slot update`
        );
      } catch (cacheError) {
        console.error("Failed to invalidate calendar cache:", cacheError);
      }

      res.json(updatedSlot[0]);
    } catch (error) {
      console.error("Error updating time slot:", error);
      res.status(500).json({ error: "Failed to update time slot" });
    }
  });

  app.delete("/api/calendar/time-slots/:id", verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const slotId = parseInt(req.params.id);

      if (req.user?.role !== "notary" && req.user?.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }
      const existingSlot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.notaryId, notaryId)
          )
        );

      if (existingSlot.length === 0) {
        return res.status(404).json({ error: "Time slot not found" });
      }

      if (existingSlot[0].status === "booked") {
        return res
          .status(400)
          .json({ error: "Cannot delete booked time slot" });
      }

      await db.delete(notaryTimeSlots).where(eq(notaryTimeSlots.id, slotId));

      try {
        const { redisCache } = await import("../../services/redis-cache");
        await redisCache.delPattern(`user:${notaryId}:*calendar*`);
        await redisCache.delPattern(`*calendar*`);
        console.log(
          `🧹 Invalidated calendar cache for user ${notaryId} after slot deletion`
        );
      } catch (cacheError) {
        console.error("Failed to invalidate calendar cache:", cacheError);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting time slot:", error);
      res.status(500).json({ error: "Failed to delete time slot" });
    }
  });

  app.get(
    "/api/calendar/events",
    verifyToken,
    cacheUserData(180),
    async (req, res) => {
      try {
        const { month, year } = req.query;
        const notaryId = req.user?.id;

        if (req.user?.role !== "notary" && req.user?.role !== "admin") {
          return res.status(403).json({ error: "Access denied" });
        }

        let query = db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.notaryId, notaryId))
          .orderBy(calendarEvents.startDateTime);

        // Filter by month/year if provided
        if (month && year) {
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(parseInt(year), parseInt(month), 0);

          query = query.where(
            and(
              gte(calendarEvents.startDateTime, startDate),
              lte(calendarEvents.startDateTime, endDate)
            )
          );
        }

        const events = await query;
        res.json(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Failed to fetch events" });
      }
    }
  );

  // Create calendar event
  app.post("/api/calendar/events", verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const {
        title,
        description,
        startDateTime,
        endDateTime,
        location,
        eventType,
        isAllDay,
      } = req.body;

      if (req.user?.role !== "notary" && req.user?.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const newEvent = await db
        .insert(calendarEvents)
        .values({
          notaryId,
          title,
          description,
          startDateTime: new Date(startDateTime),
          endDateTime: new Date(endDateTime),
          location,
          eventType: eventType || "personal",
          isAllDay: isAllDay || false,
        })
        .returning();

      res.json(newEvent[0]);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Get working hours
  app.get("/api/calendar/working-hours", verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;

      if (req.user?.role !== "notary" && req.user?.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const workingHours = await db
        .select()
        .from(notaryWorkingHours)
        .where(eq(notaryWorkingHours.notaryId, notaryId))
        .orderBy(notaryWorkingHours.dayOfWeek);

      res.json(workingHours);
    } catch (error) {
      console.error("Error fetching working hours:", error);
      res.status(500).json({ error: "Failed to fetch working hours" });
    }
  });

  // Update working hours
  app.put("/api/calendar/working-hours", verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const { workingHours } = req.body;

      if (req.user?.role !== "notary" && req.user?.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      await db
        .delete(notaryWorkingHours)
        .where(eq(notaryWorkingHours.notaryId, notaryId));

      if (workingHours && workingHours.length > 0) {
        const hoursToInsert = workingHours
          .filter((h: any) => h.isActive)
          .map((h: any) => ({
            notaryId,
            dayOfWeek: h.dayOfWeek,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: h.isActive,
          }));

        if (hoursToInsert.length > 0) {
          await db.insert(notaryWorkingHours).values(hoursToInsert);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating working hours:", error);
      res.status(500).json({ error: "Failed to update working hours" });
    }
  });

  app.get("/api/calendar/available-notaries", verifyToken, async (req, res) => {
    try {
      const { date, startTime, endTime } = req.query;

      if (!date || !startTime || !endTime) {
        return res
          .status(400)
          .json({ error: "Date, start time, and end time are required" });
      }

      const availableNotaries = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          timeSlots: notaryTimeSlots,
        })
        .from(users)
        .leftJoin(
          notaryTimeSlots,
          and(
            eq(users.id, notaryTimeSlots.notaryId),
            eq(notaryTimeSlots.date, date as string),
            eq(notaryTimeSlots.status, "available"),
            gte(notaryTimeSlots.startTime, startTime as string),
            lte(notaryTimeSlots.endTime, endTime as string)
          )
        )
        .where(and(eq(users.role, "notary"), eq(users.isActive, true)));

      // Group by notary
      const groupedNotaries = availableNotaries.reduce((acc: any, row) => {
        if (!acc[row.id]) {
          acc[row.id] = {
            id: row.id,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            availableSlots: [],
          };
        }
        if (row.timeSlots) {
          acc[row.id].availableSlots.push(row.timeSlots);
        }
        return acc;
      }, {});

      res.json(
        Object.values(groupedNotaries).filter(
          (n: any) => n.availableSlots.length > 0
        )
      );
    } catch (error) {
      console.error("Error fetching available notaries:", error);
      res.status(500).json({ error: "Failed to fetch available notaries" });
    }
  });

  app.get(
    "/api/calendar/notary-availability/:notaryId",
    verifyToken,
    async (req, res) => {
      try {
        const notaryId = parseInt(req.params.notaryId);
        const { startDate, endDate } = req.query;

        if (!notaryId) {
          return res.status(400).json({ error: "Notary ID is required" });
        }

        const defaultStartDate = new Date().toISOString().split("T")[0];
        const defaultEndDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        const timeSlots = await db
          .select()
          .from(notaryTimeSlots)
          .where(
            and(
              eq(notaryTimeSlots.notaryId, notaryId),
              gte(
                notaryTimeSlots.date,
                (startDate as string) || defaultStartDate
              ),
              lte(notaryTimeSlots.date, (endDate as string) || defaultEndDate)
            )
          )
          .orderBy(notaryTimeSlots.date, notaryTimeSlots.startTime);

        res.json(timeSlots);
      } catch (error) {
        console.error("Error fetching notary availability:", error);
        res.status(500).json({ error: "Failed to fetch notary availability" });
      }
    }
  );

  app.get(
    "/api/notaries/available",
    verifyToken,
    cacheUserData(300),
    async (req, res) => {
      try {
        const canViewNotaries =
          hasAdminPrivileges(req.user) ||
          req.user.role === "client" ||
          (req.user.role === "notary" && req.user.notaryType === "subscriber");

        if (!canViewNotaries) {
          return res.status(403).json({
            error: "Access denied",
            message:
              "Title companies cannot browse notary lists. Please use auto assignment or notary ID code lookup instead.",
          });
        }

        const availableNotaries = await db
          .select({
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            isNotarySigningAgent: users.isNotarySigningAgent,
            isSpanishSpeaking: users.isSpanishSpeaking,
            notaryType: users.notaryType,
            maxConcurrentJobs: users.maxConcurrentJobs,
          })
          .from(users)
          .where(and(eq(users.role, "notary"), eq(users.isActive, true)))
          .orderBy(users.firstName, users.lastName, users.username);

        res.json(availableNotaries);
      } catch (error) {
        console.error("Error fetching available notaries:", error);
        res.status(500).json({ error: "Failed to fetch available notaries" });
      }
    }
  );

  app.post("/api/calendar/book-slot", verifyToken, async (req, res) => {
    try {
      const { slotId, jobId } = req.body;

      if (!slotId || !jobId) {
        return res
          .status(400)
          .json({ error: "Slot ID and Job ID are required" });
      }

      const slot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.status, "available")
          )
        );

      if (slot.length === 0) {
        return res.status(400).json({ error: "Time slot is not available" });
      }

      await db
        .update(notaryTimeSlots)
        .set({
          status: "booked",
          jobId,
          updatedAt: new Date(),
        })
        .where(eq(notaryTimeSlots.id, slotId));

      await db.insert(calendarEvents).values({
        notaryId: slot[0].notaryId,
        title: `Notarization Job #${jobId}`,
        description: "Scheduled notarization appointment",
        startDateTime: new Date(`${slot[0].date} ${slot[0].startTime}`),
        endDateTime: new Date(`${slot[0].date} ${slot[0].endTime}`),
        eventType: "job",
        jobId,
        isAllDay: false,
      });

      res.json({ success: true, message: "Time slot booked successfully" });
    } catch (error) {
      console.error("Error booking time slot:", error);
      res.status(500).json({ error: "Failed to book time slot" });
    }
  });
}
