import { z } from 'zod';

/**
 * Validation schemas for Citizen Complaint submission and resolution verification
 */

export const VALID_CATEGORIES = [
  'Roads and Infrastructure',
  'Sanitation and Waste Management',
  'Water Supply',
  'Drainage and Sewerage',
  'Street Lighting',
];

export const createComplaintSchema = z.object({
  title: z
    .string({ required_error: 'Complaint title is required.' })
    .trim()
    .min(5, 'Title must be at least 5 characters long.')
    .max(200, 'Title cannot exceed 200 characters.'),
  description: z
    .string({ required_error: 'Detailed complaint description is required.' })
    .trim()
    .min(10, 'Description must be at least 10 characters long.')
    .max(3000, 'Description cannot exceed 3000 characters.'),
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({
      message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    }),
  }),
  ward_id: z
    .string({ required_error: 'Ward selection is required.' })
    .trim()
    .min(1, 'Ward selection is required.'),
  latitude: z.coerce
    .number({ invalid_type_error: 'Latitude must be a valid coordinate number.' })
    .min(-90, 'Latitude must be between -90 and 90.')
    .max(90, 'Latitude must be between -90 and 90.'),
  longitude: z.coerce
    .number({ invalid_type_error: 'Longitude must be a valid coordinate number.' })
    .min(-180, 'Longitude must be between -180 and 180.')
    .max(180, 'Longitude must be between -180 and 180.'),
  address: z
    .string({ required_error: 'Location / street address is required.' })
    .trim()
    .min(3, 'Address description must be at least 3 characters long.')
    .max(500, 'Address cannot exceed 500 characters.'),
  landmark: z
    .string()
    .trim()
    .max(200, 'Landmark cannot exceed 200 characters.')
    .optional()
    .nullable(),
  severity: z
    .enum(['low', 'medium', 'high', 'critical'])
    .default('medium'),
});

export const verifyComplaintSchema = z.object({
  is_satisfactory: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true' || val === '1') return true;
      if (val.toLowerCase() === 'false' || val === '0') return false;
    }
    return val;
  }, z.boolean({ required_error: 'Resolution satisfaction confirmation (is_satisfactory) is required.' })),
  feedback: z
    .string()
    .trim()
    .max(1000, 'Feedback notes cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});
