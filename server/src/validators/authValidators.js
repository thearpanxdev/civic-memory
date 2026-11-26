import { z } from 'zod';
import {
  isValidState,
  getCanonicalState,
  isValidDistrictForState,
} from '../utils/indiaGeoData.js';

const passwordValidation = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  full_name: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  password: passwordValidation,
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+() -]{7,20}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  // Explicitly ignore or reject supplied role - public registration is strictly for citizens
  role: z.string().optional(),
});

/**
 * Strict schema for enhanced citizen registration with residential address details
 */
export const citizenRegisterSchema = z
  .object({
    full_name: z
      .string({ required_error: 'Full name is required' })
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .toLowerCase()
      .email('Please enter a valid email address'),
    phone: z
      .string({ required_error: 'Mobile phone number is required' })
      .trim()
      .transform((val) => val.replace(/[\s\-]/g, ''))
      .refine(
        (val) => /^(\+91)?[6-9]\d{9}$/.test(val),
        'Please enter a valid 10-digit Indian mobile number starting with 6-9'
      ),
    password: passwordValidation,
    confirm_password: z.string().optional(),
    // Residential Address & Location Details
    state: z
      .string({ required_error: 'State is required' })
      .trim()
      .min(2, 'State must be at least 2 characters')
      .max(60, 'State cannot exceed 60 characters')
      .refine(
        (val) => isValidState(val),
        'Please select a valid Indian State or Union Territory'
      )
      .transform((val) => getCanonicalState(val) || val),
    district: z
      .string({ required_error: 'District is required' })
      .trim()
      .min(2, 'District must be at least 2 characters')
      .max(60, 'District cannot exceed 60 characters'),
    ulb: z
      .string({ required_error: 'Municipality / Urban Local Body is required' })
      .trim()
      .min(2, 'Municipality / ULB must be at least 2 characters')
      .max(100, 'Municipality / ULB cannot exceed 100 characters'),
    locality: z
      .string({ required_error: 'Locality / Area is required' })
      .trim()
      .min(2, 'Locality / Area must be at least 2 characters')
      .max(100, 'Locality / Area cannot exceed 100 characters'),
    street: z
      .string({ required_error: 'Street / Road is required' })
      .trim()
      .min(2, 'Street / Road must be at least 2 characters')
      .max(100, 'Street / Road cannot exceed 100 characters'),
    pin_code: z
      .string({ required_error: 'PIN code is required' })
      .trim()
      .regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
    house_number: z
      .string()
      .trim()
      .max(50, 'House/Flat number cannot exceed 50 characters')
      .optional()
      .or(z.literal('')),
    landmark: z
      .string()
      .trim()
      .max(100, 'Landmark cannot exceed 100 characters')
      .optional()
      .or(z.literal('')),
    locality_verification_level: z
      .enum(['postal_matched', 'government_dataset_matched', 'ai_assessed', 'manual_unverified'])
      .optional()
      .default('manual_unverified'),
    ulb_verification_status: z
      .enum(['VERIFIED', 'UNVERIFIED', 'CUSTOM'])
      .optional()
      .default('UNVERIFIED'),
    // Disallow ward / ward_number in registration form
    ward: z.any().optional(),
    ward_number: z.any().optional(),
    ward_id: z.any().optional(),
    role: z.string().optional(),
  })
  .refine(
    (data) => !data.confirm_password || data.password === data.confirm_password,
    {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    }
  )
  .refine(
    (data) => isValidDistrictForState(data.state, data.district),
    {
      message: 'Selected District does not belong to the selected State',
      path: ['district'],
    }
  );

export const verifyRegistrationOtpSchema = z.object({
  registration_id: z
    .string({ required_error: 'Registration ID is required' })
    .uuid('Invalid registration identifier'),
  email_otp: z
    .string({ required_error: 'Email OTP is required' })
    .trim()
    .regex(/^\d{6}$/, 'Email OTP must be a 6-digit number'),
  mobile_otp: z
    .string({ required_error: 'Mobile OTP is required' })
    .trim()
    .regex(/^\d{6}$/, 'Mobile OTP must be a 6-digit number'),
});

export const resendRegistrationOtpSchema = z.object({
  registration_id: z
    .string({ required_error: 'Registration ID is required' })
    .uuid('Invalid registration identifier'),
  type: z.enum(['email', 'mobile', 'both']).default('both'),
});

export const forgotPasswordRequestSchema = z.object({
  identifier: z
    .string({ required_error: 'Email address or mobile phone number is required' })
    .trim()
    .min(3, 'Identifier must be at least 3 characters')
    .refine(
      (val) => {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        const isPhone = /^(\+91)?[6-9]\d{9}$/.test(val.replace(/[\s\-]/g, ''));
        return isEmail || isPhone;
      },
      'Please enter a valid email address or 10-digit mobile number'
    ),
});

export const verifyResetOtpSchema = z.object({
  reset_id: z
    .string({ required_error: 'Reset ID is required' })
    .uuid('Invalid reset identifier'),
  otp: z
    .string({ required_error: 'Recovery OTP is required' })
    .trim()
    .regex(/^\d{6}$/, 'Recovery code must be a 6-digit number'),
});

export const resendResetOtpSchema = z.object({
  reset_id: z
    .string({ required_error: 'Reset ID is required' })
    .uuid('Invalid reset identifier'),
});

export const resetPasswordSchema = z
  .object({
    reset_token: z
      .string({ required_error: 'Reset token is required' })
      .min(32, 'Invalid reset token format'),
    new_password: passwordValidation,
    confirm_password: z.string().optional(),
  })
  .refine(
    (data) => !data.confirm_password || data.new_password === data.confirm_password,
    {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    }
  );

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});
