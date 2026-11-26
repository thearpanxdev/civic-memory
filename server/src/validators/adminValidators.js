import { z } from 'zod';

export const createOfficialSchema = z.object({
  email: z
    .string({ required_error: 'Official email is required.' })
    .trim()
    .email('Invalid email address format.')
    .max(255, 'Email cannot exceed 255 characters.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password cannot exceed 128 characters.'),
  full_name: z
    .string({ required_error: 'Full name is required.' })
    .trim()
    .min(2, 'Full name must be at least 2 characters long.')
    .max(150, 'Full name cannot exceed 150 characters.'),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number cannot exceed 20 characters.')
    .optional()
    .nullable(),
  department_id: z
    .string({ required_error: 'Department ID is required.' })
    .trim()
    .min(1, 'Department ID is required.'),
});

export const updateOfficialDeptSchema = z.object({
  department_id: z
    .string({ required_error: 'Department ID is required.' })
    .trim()
    .min(1, 'Department ID is required.'),
});

export const toggleOfficialStatusSchema = z.object({
  is_active: z.boolean({ required_error: 'is_active boolean flag is required.' }),
});

// ====================================================================
// Task Deadlines Validation Schemas (Admin-Only Authority)
// ====================================================================
export const setDeadlineSchema = z.object({
  deadline_at: z
    .string({ required_error: 'Deadline date and time is required.' })
    .refine((val) => !isNaN(Date.parse(val)), 'Valid deadline date and time is required.'),
  consultation_notes: z
    .string()
    .trim()
    .max(1000, 'Consultation notes cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});

// ====================================================================
// Grievance Support Validation Schemas (Citizens & Engineers)
// ====================================================================
export const createGrievanceSchema = z.object({
  subject: z
    .string({ required_error: 'Subject is required.' })
    .trim()
    .min(3, 'Subject must be at least 3 characters long.')
    .max(200, 'Subject cannot exceed 200 characters.'),
  description: z
    .string({ required_error: 'Description is required.' })
    .trim()
    .min(10, 'Description must be at least 10 characters long.')
    .max(5000, 'Description cannot exceed 5000 characters.'),
  related_complaint_id: z.string().trim().optional().nullable(),
  department_id: z.string().trim().optional().nullable(),
});

export const respondGrievanceSchema = z.object({
  response_text: z
    .string({ required_error: 'Response text is required.' })
    .trim()
    .min(2, 'Response text must be at least 2 characters long.')
    .max(5000, 'Response text cannot exceed 5000 characters.'),
  status: z
    .enum(['Pending', 'Under Review', 'Resolved', 'Rejected'], {
      errorMap: () => ({ message: 'Status must be one of: Pending, Under Review, Resolved, Rejected' }),
    })
    .optional(),
});

export const updateGrievanceStatusSchema = z.object({
  status: z.enum(['Pending', 'Under Review', 'Resolved', 'Rejected'], {
    errorMap: () => ({ message: 'Status must be one of: Pending, Under Review, Resolved, Rejected' }),
  }),
  admin_notes: z
    .string()
    .trim()
    .max(1000, 'Admin notes cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});

// ====================================================================
// Government Tender Management Validation Schemas
// ====================================================================
export const createTenderSchema = z.object({
  complaint_id: z
    .string({ required_error: 'Associated complaint / work order ID is required.' })
    .trim()
    .min(1, 'Associated complaint / work order ID is required.'),
  title: z
    .string({ required_error: 'Tender title is required.' })
    .trim()
    .min(5, 'Title must be at least 5 characters.')
    .max(250, 'Title cannot exceed 250 characters.'),
  description: z
    .string({ required_error: 'Tender description is required.' })
    .trim()
    .min(10, 'Description must be at least 10 characters.')
    .max(10000, 'Description cannot exceed 10000 characters.'),
  location: z
    .string({ required_error: 'Work location is required.' })
    .trim()
    .min(3, 'Location must be at least 3 characters.')
    .max(255, 'Location cannot exceed 255 characters.'),
  pin_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'PIN code must be a valid 6-digit Indian postal code.')
    .optional()
    .nullable(),
  estimated_cost: z
    .number()
    .positive('Estimated cost must be a positive number.')
    .optional()
    .nullable(),
  work_specifications: z
    .string({ required_error: 'Work specifications and requirements are required.' })
    .trim()
    .min(10, 'Work specifications must be at least 10 characters.'),
  submission_deadline: z
    .string({ required_error: 'Tender submission deadline is required.' })
    .refine((val) => !isNaN(Date.parse(val)), 'Valid submission deadline date and time is required.'),
  terms_and_conditions: z
    .string()
    .trim()
    .optional()
    .nullable(),
  portal_type: z.enum(['state', 'central'], {
    errorMap: () => ({ message: "Portal type must be either 'state' or 'central'." }),
  }),
  portal_name: z
    .string({ required_error: 'Government portal name is required.' })
    .trim()
    .min(2, 'Portal name is required.')
    .max(150, 'Portal name cannot exceed 150 characters.'),
  portal_url: z
    .string({ required_error: 'Official portal URL is required.' })
    .trim()
    .url('Portal URL must be a valid URL (e.g., https://eprocure.gov.in).'),
});

export const publishTenderSchema = z.object({
  official_tender_ref: z
    .string({ required_error: 'Official tender reference number is required from the government portal.' })
    .trim()
    .min(3, 'Official tender reference number must be at least 3 characters.'),
  external_tracking_id: z
    .string()
    .trim()
    .max(150, 'External tracking ID cannot exceed 150 characters.')
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});

export const updateTenderStatusSchema = z.object({
  status: z.enum(
    [
      'Draft',
      'Ready for Publication',
      'Published',
      'Bidding Open',
      'Bidding Closed',
      'Under Evaluation',
      'Awarded',
      'Cancelled',
    ],
    {
      errorMap: () => ({
        message:
          'Status must be one of: Draft, Ready for Publication, Published, Bidding Open, Bidding Closed, Under Evaluation, Awarded, Cancelled.',
      }),
    }
  ),
  awarded_contractor_name: z.string().trim().max(255).optional().nullable(),
  awarded_contractor_license: z.string().trim().max(100).optional().nullable(),
  awarded_bid_amount: z.number().positive().optional().nullable(),
  contractor_contact: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
