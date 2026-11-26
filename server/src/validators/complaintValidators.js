import { z } from 'zod';

/**
 * Validation schemas for Citizen Complaint submission and resolution verification
 */

export const MUNICIPAL_CATEGORIES = [
  'Roads and Infrastructure',
  'Sanitation and Waste Management',
  'Water Supply',
  'Drainage and Sewerage',
  'Street Lighting',
];

export const MULTIMODAL_ISSUE_CATEGORIES = [
  'Road damage',
  'Waterlogging',
  'Drainage and sewage',
  'Garbage accumulation',
  'Streetlight failure',
  'Water supply',
  'Public infrastructure damage',
  'Electricity-related civic issues',
  'Other',
];

export const MULTIMODAL_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export const VALID_CATEGORIES = [
  ...MUNICIPAL_CATEGORIES,
  ...MULTIMODAL_ISSUE_CATEGORIES,
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
  duplicate_of_id: z
    .string()
    .trim()
    .optional()
    .nullable(),
  language_preference: z
    .string()
    .trim()
    .default('auto'),
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

/**
 * Request validation schema for AI Complaint Analysis (POST /api/complaints/analyze)
 */
export const analyzeComplaintSchema = z.object({
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
  address: z.string().trim().max(500).optional().nullable(),
  landmark: z.string().trim().max(200).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  additional_info: z.string().trim().max(1000).optional().nullable(),
  language_preference: z.string().trim().default('auto'),
});

/**
 * Multimodal structured JSON schema returned by Gemini AI analysis
 */
export const multimodalGeminiOutputSchema = z.object({
  issue_category: z.enum(MULTIMODAL_ISSUE_CATEGORIES, {
    errorMap: () => ({
      message: `Invalid issue category. Must be one of: ${MULTIMODAL_ISSUE_CATEGORIES.join(', ')}`,
    }),
  }),
  issue_subcategory: z.string().trim().default(''),
  description_summary: z
    .string({ required_error: 'description_summary is required.' })
    .trim()
    .min(1, 'description_summary cannot be empty.'),
  severity: z.enum(MULTIMODAL_SEVERITIES, {
    errorMap: () => ({
      message: `Invalid severity. Must be one of: ${MULTIMODAL_SEVERITIES.join(', ')}`,
    }),
  }),
  detected_objects: z.array(z.string().trim()).default([]),
  visible_evidence: z.array(z.string().trim()).default([]),
  potential_public_safety_risk: z.string().trim().default(''),
  recommended_department: z.string().trim().min(1, 'recommended_department is required.'),
  confidence_score: z.coerce.number().min(0).max(100).default(0),
  additional_information_required: z.array(z.string().trim()).default([]),
});

/**
 * Server-side validation schema for Gemini's structured response
 */
export const geminiAnalysisOutputSchema = z.object({
  suggestedCategory: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({
      message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    }),
  }),
  summary: z
    .string({ required_error: 'Summary is required.' })
    .trim()
    .min(1, 'Summary cannot be empty.')
    .max(1000, 'Summary cannot exceed 1000 characters.'),
  keyDetails: z
    .array(z.string().trim().min(1))
    .default([]),
  confidence: z.enum(['high', 'medium', 'low'], {
    errorMap: () => ({ message: 'Confidence must be high, medium, or low.' }),
  }),
  needsClarification: z.boolean({
    required_error: 'needsClarification must be a boolean.',
  }),
  clarificationQuestion: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => val || null),
});

/**
 * Validation schema for checking nearby duplicate complaints
 */
export const checkDuplicatesSchema = z.object({
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
  category: z.string().trim().optional().nullable(),
  ward_id: z.string().trim().optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  landmark: z.string().trim().max(200).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

/**
 * Validation schema for Gemini's semantic duplicate evaluation output
 */
export const semanticDuplicateOutputSchema = z.object({
  new_complaint_features: z
    .object({
      issue_category: z.string().default(''),
      issue_description: z.string().default(''),
      infrastructure_type: z.string().default(''),
      location_description: z.string().default(''),
      specific_landmarks: z.string().default(''),
      nature_of_damage: z.string().default(''),
      relevant_context: z.string().default(''),
    })
    .default({}),
  candidate_evaluations: z
    .array(
      z.object({
        candidate_id: z.string(),
        semantic_similarity_score: z.coerce.number().min(0).max(100),
        is_semantic_match: z.boolean().default(false),
        match_reasoning: z.string().default(''),
        infrastructure_type: z.string().default(''),
        nature_of_damage: z.string().default(''),
      })
    )
    .default([]),
});

/**
 * Multilingual complaint structured output schema (Zod validation for Gemini output)
 */
export const multilingualComplaintOutputSchema = z.object({
  detected_language: z
    .string({ required_error: 'detected_language is required.' })
    .trim()
    .min(1, 'detected_language cannot be empty.'),
  original_text: z
    .string({ required_error: 'original_text is required.' })
    .trim()
    .min(1, 'original_text cannot be empty.'),
  english_translation: z
    .string({ required_error: 'english_translation is required.' })
    .trim()
    .min(1, 'english_translation cannot be empty.'),
  issue_category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({
      message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    }),
  }),
  issue_summary: z
    .string({ required_error: 'issue_summary is required.' })
    .trim()
    .min(1, 'issue_summary cannot be empty.'),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical'], {
    errorMap: () => ({
      message: 'Invalid severity. Must be Low, Medium, High, or Critical.',
    }),
  }),
  recommended_department: z
    .string({ required_error: 'recommended_department is required.' })
    .trim()
    .min(1, 'recommended_department cannot be empty.'),
  translation_confidence: z.coerce
    .number()
    .min(0)
    .max(100)
    .default(100),
});

/**
 * Schema for official revising translation
 */
export const reviseTranslationSchema = z.object({
  english_translation: z
    .string()
    .trim()
    .min(5, 'Revised translation must be at least 5 characters.')
    .max(3000, 'Revised translation cannot exceed 3000 characters.')
    .optional(),
  translation_notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters.')
    .optional()
    .nullable(),
  action: z
    .enum(['manual_edit', 'regenerate'])
    .default('manual_edit'),
});
