import { z } from 'zod';

export const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Output schema returned by Gemini AI department routing
 */
export const departmentRoutingOutputSchema = z.object({
  recommended_department: z.string().min(1, 'Recommended department is required'),
  secondary_department: z.string().nullable().optional().default(null),
  routing_reason: z.string().min(1, 'Routing reason is required'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  confidence_score: z.number().int().min(0).max(100),
  requires_manual_review: z.boolean(),
});

/**
 * Schema for creating a new municipal department
 */
export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name must be at least 2 characters').max(100),
  code: z.string().trim().min(2, 'Department code must be at least 2 characters').max(20).toUpperCase(),
  description: z.string().trim().max(500).optional().default(''),
  responsibilities: z.string().trim().max(1000).optional().default(''),
  routing_rules: z.string().trim().max(1000).optional().default(''),
  is_active: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional().default(1),
});

/**
 * Schema for updating an existing municipal department
 */
export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(2).max(20).toUpperCase().optional(),
  description: z.string().trim().max(500).optional(),
  responsibilities: z.string().trim().max(1000).optional(),
  routing_rules: z.string().trim().max(1000).optional(),
  is_active: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
});

/**
 * Schema for reassigning a complaint to another department
 */
export const reassignDepartmentSchema = z.object({
  target_department_id: z.string().trim().min(1, 'Target department ID is required'),
  reassignment_reason: z.string().trim().min(5, 'Reassignment reason must be at least 5 characters').max(500),
});
