import { z } from 'zod';

export const OFFICIAL_ALLOWED_STATUSES = [
  'Under Review',
  'Verified',
  'Assigned',
  'In Progress',
  'Work Completed',
];

export const assignComplaintSchema = z.object({
  assigned_official_id: z
    .string({ required_error: 'Assigned official ID is required.' })
    .trim()
    .min(1, 'Assigned official ID cannot be empty.'),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters.').optional().nullable(),
});

export const updateOfficialStatusSchema = z.object({
  status: z.enum(OFFICIAL_ALLOWED_STATUSES, {
    errorMap: () => ({
      message: `Invalid status for official transition. Officials may set: ${OFFICIAL_ALLOWED_STATUSES.join(', ')}. Direct resolution requires citizen verification.`,
    }),
  }),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters.').optional().nullable(),
});

export const progressUpdateSchema = z.object({
  message: z
    .string({ required_error: 'Progress message is required.' })
    .trim()
    .min(3, 'Progress message must be at least 3 characters long.')
    .max(1500, 'Progress message cannot exceed 1500 characters.'),
  update_type: z
    .enum(['note', 'inspection', 'crew_dispatched', 'work_update', 'material_requisition', 'repair_completed'], {
      errorMap: () => ({
        message: 'Invalid update type. Must be one of: note, inspection, crew_dispatched, work_update, material_requisition, repair_completed.',
      }),
    })
    .default('work_update'),
});
