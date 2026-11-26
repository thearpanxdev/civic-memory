import { z } from 'zod';

export const VALID_PERIODS = ['7d', '30d', '90d', '180d', '365d', 'all'];

export const generateReportRequestSchema = z
  .object({
    period: z.enum(VALID_PERIODS).optional(),
    time_period: z.enum(VALID_PERIODS).optional(),
    ward_id: z.string().trim().optional().nullable(),
    category: z.string().trim().optional().nullable(),
    custom_focus: z.string().trim().max(500).optional().nullable(),
  })
  .transform((data) => ({
    period: data.time_period || data.period || '30d',
    ward_id: data.ward_id,
    category: data.category,
    custom_focus: data.custom_focus,
  }));

export const intelligenceReportOutputSchema = z.object({
  title: z.string().min(1).default('Municipal Civic Intelligence Report'),
  executive_summary: z.string().min(1),
  major_civic_concerns: z
    .array(
      z
        .object({
          title: z.string().optional(),
          concern: z.string().optional(),
          category: z.string().default('General'),
          evidence: z.string().optional(),
          description: z.string().optional(),
          severity: z.string().default('medium'),
          impacted_ward: z.string().optional(),
          supporting_tickets: z.array(z.string()).default([]),
          supporting_ticket_numbers: z.array(z.string()).default([]),
        })
        .transform((item) => ({
          title: item.title || item.concern || 'Civic Issue',
          concern: item.concern || item.title || 'Civic Issue',
          category: item.category,
          evidence: item.evidence || item.description || '',
          description: item.description || item.evidence || '',
          severity: item.severity.toLowerCase(),
          impacted_ward: item.impacted_ward || '',
          supporting_tickets:
            item.supporting_tickets.length > 0
              ? item.supporting_tickets
              : item.supporting_ticket_numbers,
          supporting_ticket_numbers:
            item.supporting_ticket_numbers.length > 0
              ? item.supporting_ticket_numbers
              : item.supporting_tickets,
        }))
    )
    .default([]),
  recurring_problems_summary: z.string().default(''),
  recurring_problems_analysis: z.any().optional(),
  chronic_failure_clusters: z
    .array(
      z.object({
        location: z.string(),
        category: z.string(),
        recurrence_count: z.coerce.number().default(1),
        description: z.string().default(''),
        root_ticket: z.string().default(''),
        supporting_tickets: z.array(z.string()).default([]),
      })
    )
    .default([]),
  geographic_hotspots_summary: z.string().default(''),
  geographic_hotspots: z.any().optional(),
  top_hotspots: z
    .array(
      z.object({
        cluster_id: z.string().default(''),
        location: z.string(),
        total_complaints: z.coerce.number().default(0),
        unresolved_count: z.coerce.number().default(0),
        dominant_category: z.string().default(''),
        insight: z.string().default(''),
      })
    )
    .default([]),
  historical_comparison: z.string().default(''),
  historical_comparisons: z.any().optional(),
  recommended_inspection_priorities: z
    .array(
      z
        .object({
          priority: z.coerce.number().default(1),
          target_location: z.string().optional(),
          location: z.string().optional(),
          department: z.string(),
          recommended_action: z.string().optional(),
          action: z.string().optional(),
          urgency: z.string().default('medium'),
          rationale: z.string().optional(),
          supporting_tickets: z.array(z.string()).default([]),
        })
        .transform((item) => ({
          priority: item.priority,
          target_location: item.target_location || item.location || '',
          location: item.location || item.target_location || '',
          department: item.department,
          recommended_action: item.recommended_action || item.action || '',
          action: item.action || item.recommended_action || '',
          urgency: item.urgency,
          rationale: item.rationale || '',
          supporting_tickets: item.supporting_tickets,
        }))
    )
    .default([]),
  grounded_citations: z
    .union([
      z.object({
        total_complaints_analyzed: z.coerce.number().default(0),
        unique_issues_count: z.coerce.number().default(0),
        recurring_issues_count: z.coerce.number().default(0),
        supporting_ticket_numbers: z.array(z.string()).default([]),
      }),
      z.array(z.string()),
    ])
    .default([]),
});
