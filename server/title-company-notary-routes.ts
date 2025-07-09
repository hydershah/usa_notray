import { Express } from 'express';
import { and, eq, desc, asc } from 'drizzle-orm';
import { db } from './db';
import { 
  titleCompanyNotaryAssignments, 
  legacyTitleCompanyNotaryAssignments,
  companies, 
  titleCompanies, 
  users 
} from '../shared/schema';
import { verifyToken, hasAdminPrivileges } from './auth';

export function registerTitleCompanyNotaryRoutes(app: Express) {
  
  /**
   * Get all notary assignments for a title company
   * GET /api/title-companies/:companyId/notary-assignments
   */
  app.get('/api/title-companies/:companyId/notary-assignments', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (!companyId || isNaN(companyId)) {
        return res.status(400).json({ message: 'Invalid company ID' });
      }

      // Check if user has permission (admin or company manager)
      if (!hasAdminPrivileges(req.user)) {
        // Check if user is the company manager
        const company = await db
          .select()
          .from(companies)
          .where(eq(companies.id, companyId))
          .limit(1);

        if (!company.length || company[0].companyManagerId !== req.user.id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Get assignments with notary details
      const assignments = await db
        .select({
          id: titleCompanyNotaryAssignments.id,
          notaryId: titleCompanyNotaryAssignments.notaryId,
          isDefault: titleCompanyNotaryAssignments.isDefault,
          status: titleCompanyNotaryAssignments.status,
          assignedAt: titleCompanyNotaryAssignments.assignedAt,
          notes: titleCompanyNotaryAssignments.notes,
          notaryFirstName: users.firstName,
          notaryLastName: users.lastName,
          notaryEmail: users.email,
          notaryIdCode: users.notaryIdCode,
          notaryIsActive: users.isActive,
        })
        .from(titleCompanyNotaryAssignments)
        .innerJoin(users, eq(titleCompanyNotaryAssignments.notaryId, users.id))
        .where(
          and(
            eq(titleCompanyNotaryAssignments.titleCompanyId, companyId),
            eq(titleCompanyNotaryAssignments.status, 'active')
          )
        )
        .orderBy(
          desc(titleCompanyNotaryAssignments.isDefault),
          asc(users.firstName)
        );

      res.json({ success: true, data: assignments });

    } catch (error) {
      console.error('Error fetching title company notary assignments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Add notary assignment to title company
   * POST /api/title-companies/:companyId/notary-assignments
   */
  app.post('/api/title-companies/:companyId/notary-assignments', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const { notaryId, isDefault = false, notes } = req.body;

      if (!companyId || isNaN(companyId)) {
        return res.status(400).json({ message: 'Invalid company ID' });
      }

      if (!notaryId) {
        return res.status(400).json({ message: 'Notary ID is required' });
      }

      // Only admins can manage notary assignments
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Only administrators can manage notary assignments' });
      }

      // Verify the notary exists and is active
      const notary = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, notaryId),
            eq(users.role, 'notary'),
            eq(users.isActive, true)
          )
        )
        .limit(1);

      if (!notary.length) {
        return res.status(404).json({ message: 'Notary not found or inactive' });
      }

      // Verify the company exists
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company.length) {
        return res.status(404).json({ message: 'Title company not found' });
      }

      // Check if assignment already exists
      const existingAssignment = await db
        .select()
        .from(titleCompanyNotaryAssignments)
        .where(
          and(
            eq(titleCompanyNotaryAssignments.titleCompanyId, companyId),
            eq(titleCompanyNotaryAssignments.notaryId, notaryId)
          )
        )
        .limit(1);

      if (existingAssignment.length) {
        return res.status(409).json({ message: 'Notary is already assigned to this title company' });
      }

      // If setting as default, remove default from other assignments
      if (isDefault) {
        await db
          .update(titleCompanyNotaryAssignments)
          .set({ 
            isDefault: false, 
            updatedAt: new Date(),
            updatedBy: req.user.id
          })
          .where(
            and(
              eq(titleCompanyNotaryAssignments.titleCompanyId, companyId),
              eq(titleCompanyNotaryAssignments.isDefault, true)
            )
          );
      }

      // Create the assignment
      const [newAssignment] = await db
        .insert(titleCompanyNotaryAssignments)
        .values({
          titleCompanyId: companyId,
          notaryId,
          isDefault,
          assignedBy: req.user.id,
          notes,
          status: 'active'
        })
        .returning();

      console.log(`✅ Admin ${req.user.username} assigned notary ${notary[0].firstName} ${notary[0].lastName} to company ${company[0].companyName}${isDefault ? ' as default' : ''}`);

      res.json({ 
        success: true, 
        data: newAssignment,
        message: `Notary ${notary[0].firstName} ${notary[0].lastName} assigned successfully${isDefault ? ' as default preferred notary' : ''}` 
      });

    } catch (error) {
      console.error('Error adding notary assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Update notary assignment (e.g., change default status)
   * PUT /api/title-companies/:companyId/notary-assignments/:assignmentId
   */
  app.put('/api/title-companies/:companyId/notary-assignments/:assignmentId', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const assignmentId = parseInt(req.params.assignmentId);
      const { isDefault, notes, status } = req.body;

      if (!companyId || isNaN(companyId) || !assignmentId || isNaN(assignmentId)) {
        return res.status(400).json({ message: 'Invalid company ID or assignment ID' });
      }

      // Only admins can manage notary assignments
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Only administrators can manage notary assignments' });
      }

      // Verify assignment exists and belongs to the company
      const [assignment] = await db
        .select()
        .from(titleCompanyNotaryAssignments)
        .where(
          and(
            eq(titleCompanyNotaryAssignments.id, assignmentId),
            eq(titleCompanyNotaryAssignments.titleCompanyId, companyId)
          )
        )
        .limit(1);

      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // If setting as default, remove default from other assignments
      if (isDefault === true) {
        await db
          .update(titleCompanyNotaryAssignments)
          .set({ 
            isDefault: false,
            updatedAt: new Date(),
            updatedBy: req.user.id
          })
          .where(
            and(
              eq(titleCompanyNotaryAssignments.titleCompanyId, companyId),
              eq(titleCompanyNotaryAssignments.isDefault, true)
            )
          );
      }

      // Update the assignment
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: req.user.id
      };

      if (typeof isDefault === 'boolean') updateData.isDefault = isDefault;
      if (notes !== undefined) updateData.notes = notes;
      if (status !== undefined) updateData.status = status;

      const [updatedAssignment] = await db
        .update(titleCompanyNotaryAssignments)
        .set(updateData)
        .where(eq(titleCompanyNotaryAssignments.id, assignmentId))
        .returning();

      console.log(`✅ Admin ${req.user.username} updated notary assignment ${assignmentId}`);

      res.json({ 
        success: true, 
        data: updatedAssignment,
        message: 'Assignment updated successfully' 
      });

    } catch (error) {
      console.error('Error updating notary assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Remove notary assignment from title company
   * DELETE /api/title-companies/:companyId/notary-assignments/:assignmentId
   */
  app.delete('/api/title-companies/:companyId/notary-assignments/:assignmentId', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const assignmentId = parseInt(req.params.assignmentId);

      if (!companyId || isNaN(companyId) || !assignmentId || isNaN(assignmentId)) {
        return res.status(400).json({ message: 'Invalid company ID or assignment ID' });
      }

      // Only admins can manage notary assignments
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Only administrators can manage notary assignments' });
      }

      // Verify assignment exists and belongs to the company
      const [assignment] = await db
        .select()
        .from(titleCompanyNotaryAssignments)
        .where(
          and(
            eq(titleCompanyNotaryAssignments.id, assignmentId),
            eq(titleCompanyNotaryAssignments.titleCompanyId, companyId)
          )
        )
        .limit(1);

      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Remove the assignment
      await db
        .delete(titleCompanyNotaryAssignments)
        .where(eq(titleCompanyNotaryAssignments.id, assignmentId));

      console.log(`✅ Admin ${req.user.username} removed notary assignment ${assignmentId} from company ${companyId}`);

      res.json({ 
        success: true, 
        message: 'Notary assignment removed successfully' 
      });

    } catch (error) {
      console.error('Error removing notary assignment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Get default preferred notary for a title company (used in job creation)
   * GET /api/title-companies/:companyId/default-notary
   */
  app.get('/api/title-companies/:companyId/default-notary', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);

      if (!companyId || isNaN(companyId)) {
        return res.status(400).json({ message: 'Invalid company ID' });
      }

      // Get the default preferred notary
      const [defaultNotary] = await db
        .select({
          notaryId: titleCompanyNotaryAssignments.notaryId,
          notaryFirstName: users.firstName,
          notaryLastName: users.lastName,
          notaryEmail: users.email,
          notaryIdCode: users.notaryIdCode,
          notaryIsActive: users.isActive,
        })
        .from(titleCompanyNotaryAssignments)
        .innerJoin(users, eq(titleCompanyNotaryAssignments.notaryId, users.id))
        .where(
          and(
            eq(titleCompanyNotaryAssignments.titleCompanyId, companyId),
            eq(titleCompanyNotaryAssignments.isDefault, true),
            eq(titleCompanyNotaryAssignments.status, 'active'),
            eq(users.isActive, true)
          )
        )
        .limit(1);

      if (!defaultNotary) {
        return res.json({ 
          success: true, 
          data: null,
          message: 'No default preferred notary assigned'
        });
      }

      res.json({ 
        success: true, 
        data: {
          preferredNotaryId: defaultNotary.notaryId,
          preferredNotaryName: `${defaultNotary.notaryFirstName} ${defaultNotary.notaryLastName}`,
          preferredNotaryFirstName: defaultNotary.notaryFirstName,
          preferredNotaryLastName: defaultNotary.notaryLastName,
          preferredNotaryEmail: defaultNotary.notaryEmail,
          preferredNotaryIdCode: defaultNotary.notaryIdCode,
          preferredNotaryActive: defaultNotary.notaryIsActive
        }
      });

    } catch (error) {
      console.error('Error fetching default notary:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Get all title companies assigned to a notary (for notary dashboard)
   * GET /api/notaries/:notaryId/assigned-companies
   */
  app.get('/api/notaries/:notaryId/assigned-companies', verifyToken, async (req: any, res) => {
    try {
      const notaryId = parseInt(req.params.notaryId);

      if (!notaryId || isNaN(notaryId)) {
        return res.status(400).json({ message: 'Invalid notary ID' });
      }

      // Check if user has permission (admin, or the notary themselves)
      if (!hasAdminPrivileges(req.user) && req.user.id !== notaryId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get assigned companies
      const assignments = await db
        .select({
          assignmentId: titleCompanyNotaryAssignments.id,
          companyId: titleCompanyNotaryAssignments.titleCompanyId,
          companyName: companies.companyName,
          companyEmail: companies.email,
          companyCity: companies.city,
          companyState: companies.state,
          isDefault: titleCompanyNotaryAssignments.isDefault,
          assignedAt: titleCompanyNotaryAssignments.assignedAt,
          status: titleCompanyNotaryAssignments.status,
        })
        .from(titleCompanyNotaryAssignments)
        .innerJoin(companies, eq(titleCompanyNotaryAssignments.titleCompanyId, companies.id))
        .where(
          and(
            eq(titleCompanyNotaryAssignments.notaryId, notaryId),
            eq(titleCompanyNotaryAssignments.status, 'active')
          )
        )
        .orderBy(
          desc(titleCompanyNotaryAssignments.isDefault),
          asc(companies.companyName)
        );

      res.json({ success: true, data: assignments });

    } catch (error) {
      console.error('Error fetching notary assigned companies:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

} 