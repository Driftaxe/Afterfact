import { z } from 'zod';
import { isValidCalendarDate } from './dates';

/**
 * Approved primitive field types for dynamic clarification forms.
 * Model prompts and extraction passes are strictly forbidden from specifying
 * arbitrary HTML, client JSX, executable scripts, or unapproved types.
 */
export const ClarificationFieldTypeSchema = z.enum([
  'select',
  'short_text',
  'date',
  'number',
  'boolean',
]);
export type ClarificationFieldType = z.infer<typeof ClarificationFieldTypeSchema>;

/**
 * Select option representation for 'select' field type.
 */
export const ClarificationOptionSchema = z.object({
  value: z.string().min(1, { message: 'Option value cannot be empty' }),
  label: z.string().min(1, { message: 'Option label cannot be empty' }),
});
export type ClarificationOption = z.infer<typeof ClarificationOptionSchema>;

/**
 * Bounded constraints for input fields.
 */
export const ClarificationConstraintsSchema = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    unit: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['min'],
        message: 'Constraint min cannot exceed max',
      });
    }
    if (c.minLength !== undefined && c.maxLength !== undefined && c.minLength > c.maxLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minLength'],
        message: 'Constraint minLength cannot exceed maxLength',
      });
    }
  });

export type ClarificationConstraints = z.infer<typeof ClarificationConstraintsSchema>;

/**
 * Pattern detecting executable scripts or dangerous HTML in prompts or labels.
 */
const SCRIPT_INJECTION_PATTERN = /<script\b|javascript:|onload=|onerror=/i;

/**
 * Clarification Question Schema.
 * Represents a single structured clarification prompt presented to the user.
 */
export const ClarificationQuestionSchema = z
  .object({
    questionId: z.string().min(1, { message: 'Question ID is required' }),
    propertyKey: z.string().min(1, { message: 'Property key being clarified is required' }),
    prompt: z.string().min(1, { message: 'Question prompt cannot be empty' }),
    reason: z.string().min(1, { message: 'Material reason for question is required' }),
    fieldType: ClarificationFieldTypeSchema,
    required: z.boolean().default(true),
    allowUnknown: z.literal(true).default(true),
    options: z.array(ClarificationOptionSchema).optional(),
    constraints: ClarificationConstraintsSchema.optional(),
  })
  .superRefine((q, ctx) => {
    // Check against script or markup injection in text fields
    if (SCRIPT_INJECTION_PATTERN.test(q.prompt) || SCRIPT_INJECTION_PATTERN.test(q.reason)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prompt'],
        message: 'Question prompt or reason contains disallowed executable scripts or markup',
      });
    }

    // Select fields must provide at least 2 distinct options
    if (q.fieldType === 'select') {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: "Clarification question of type 'select' must provide at least 2 options",
        });
      } else {
        const optionValues = new Set<string>();
        for (const opt of q.options) {
          if (optionValues.has(opt.value)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['options'],
              message: `Duplicate option value: ${opt.value}`,
            });
          }
          optionValues.add(opt.value);
        }
      }
    }

    // short_text defaults to max 60 chars unless constrained lower
    if (q.fieldType === 'short_text' && q.constraints?.maxLength !== undefined && q.constraints.maxLength > 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['constraints', 'maxLength'],
        message: "Clarification question of type 'short_text' cannot exceed 60 characters",
      });
    }
  });

export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

/**
 * Canonical Clarification Question Set.
 * Bounded to at most 2 rounds per claim.
 */
export const ClarificationQuestionSetSchema = z
  .object({
    questionSetId: z.string().min(1, { message: 'Question set ID is required' }),
    runId: z.string().min(1, { message: 'Run ID is required' }),
    revision: z.number().int().min(1, { message: 'Revision must be >= 1' }),
    round: z.number().int().min(1).max(2, { message: 'Clarification rounds are bounded to at most 2' }),
    questions: z.array(ClarificationQuestionSchema).min(1, { message: 'At least one question is required' }),
  })
  .superRefine((set, ctx) => {
    const questionIds = new Set<string>();
    for (const q of set.questions) {
      if (questionIds.has(q.questionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions'],
          message: `Duplicate question ID in question set: ${q.questionId}`,
        });
      }
      questionIds.add(q.questionId);
    }
  });

export type ClarificationQuestionSet = z.infer<typeof ClarificationQuestionSetSchema>;

/**
 * Individual Answer Item submitted by client.
 */
export const ClarificationAnswerItemSchema = z.object({
  questionId: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  isUnknown: z.boolean().optional(),
});
export type ClarificationAnswerItem = z.infer<typeof ClarificationAnswerItemSchema>;

/**
 * Submission payload of clarification answers.
 */
export const ClarificationAnswersSubmissionSchema = z.object({
  questionSetId: z.string().min(1),
  runId: z.string().min(1),
  revision: z.number().int().min(1),
  answers: z.array(ClarificationAnswerItemSchema),
});
export type ClarificationAnswersSubmission = z.infer<typeof ClarificationAnswersSubmissionSchema>;

/**
 * Validation Issue representation.
 */
export interface ClarificationValidationIssue {
  questionId: string;
  field: string;
  message: string;
}

/**
 * Result of validating clarification answers against the canonical question set.
 */
export interface ClarificationValidationResult {
  valid: boolean;
  issues: ClarificationValidationIssue[];
  isReady: boolean; // True if all required questions have known, valid answers
}

/**
 * Pure validation boundary enforcing answer binding rules:
 * - Checks question-set match and revision match (rejects stale revision).
 * - Checks question IDs against stored questions (rejects unknown question ID).
 * - Checks for duplicate answers in submission.
 * - Enforces type and value constraints per question field type.
 * - Validates select options against permitted options.
 * - Accepts explicit unknown without automatically declaring readiness.
 */
export function validateClarificationAnswers(
  questionSet: ClarificationQuestionSet,
  submission: ClarificationAnswersSubmission
): ClarificationValidationResult {
  const issues: ClarificationValidationIssue[] = [];

  // 1. Revision and set identity check
  if (submission.questionSetId !== questionSet.questionSetId) {
    issues.push({
      questionId: 'questionSetId',
      field: 'questionSetId',
      message: `Question set ID mismatch: expected ${questionSet.questionSetId}, received ${submission.questionSetId}`,
    });
  }

  if (submission.revision !== questionSet.revision) {
    issues.push({
      questionId: 'revision',
      field: 'revision',
      message: `Stale clarification revision: expected ${questionSet.revision}, received ${submission.revision}`,
    });
  }

  // 2. Map questions
  const questionMap = new Map<string, ClarificationQuestion>();
  for (const q of questionSet.questions) {
    questionMap.set(q.questionId, q);
  }

  // 3. Check for duplicates in submission
  const seenQuestionIds = new Set<string>();
  const answeredQuestionIds = new Set<string>();
  let hasUnknownRequired = false;

  for (const answer of submission.answers) {
    if (seenQuestionIds.has(answer.questionId)) {
      issues.push({
        questionId: answer.questionId,
        field: 'questionId',
        message: `Duplicate answer submitted for question ID: ${answer.questionId}`,
      });
      continue;
    }
    seenQuestionIds.add(answer.questionId);

    const question = questionMap.get(answer.questionId);
    if (!question) {
      issues.push({
        questionId: answer.questionId,
        field: 'questionId',
        message: `Unknown question ID not present in question set: ${answer.questionId}`,
      });
      continue;
    }

    answeredQuestionIds.add(answer.questionId);

    // 4. Handle explicit unknown
    if (answer.isUnknown === true || answer.value === null) {
      if (question.required) {
        hasUnknownRequired = true;
      }
      continue;
    }

    // 5. Value type and constraint checks
    switch (question.fieldType) {
      case 'short_text': {
        if (typeof answer.value !== 'string') {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Expected string for short_text, received ${typeof answer.value}`,
          });
          break;
        }
        const maxLen = question.constraints?.maxLength ?? 60;
        const minLen = question.constraints?.minLength ?? 0;
        if (answer.value.length > maxLen) {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Text exceeds maximum length of ${maxLen} characters`,
          });
        }
        if (answer.value.length < minLen) {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Text is shorter than minimum length of ${minLen} characters`,
          });
        }
        break;
      }

      case 'number': {
        if (typeof answer.value !== 'number' || !Number.isFinite(answer.value)) {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Expected finite number, received ${typeof answer.value}`,
          });
          break;
        }
        if (question.constraints?.min !== undefined && answer.value < question.constraints.min) {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Value ${answer.value} is below minimum allowed value of ${question.constraints.min}`,
          });
        }
        if (question.constraints?.max !== undefined && answer.value > question.constraints.max) {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Value ${answer.value} exceeds maximum allowed value of ${question.constraints.max}`,
          });
        }
        break;
      }

      case 'boolean': {
        if (typeof answer.value !== 'boolean') {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Expected boolean for boolean field, received ${typeof answer.value}`,
          });
        }
        break;
      }

      case 'date': {
        if (typeof answer.value !== 'string' || !isValidCalendarDate(answer.value)) {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Expected calendar date formatted YYYY-MM-DD, received ${answer.value}`,
          });
        }
        break;
      }

      case 'select': {
        if (typeof answer.value !== 'string') {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Expected string option value for select field, received ${typeof answer.value}`,
          });
          break;
        }
        const validOption = question.options?.some((opt) => opt.value === answer.value);
        if (!validOption) {
          issues.push({
            questionId: question.questionId,
            field: 'value',
            message: `Nonexistent select option: '${answer.value}'`,
          });
        }
        break;
      }
    }
  }

  // 6. Check for missing required questions
  let missingRequired = false;
  for (const q of questionSet.questions) {
    if (q.required && !answeredQuestionIds.has(q.questionId)) {
      missingRequired = true;
      issues.push({
        questionId: q.questionId,
        field: 'value',
        message: `Missing required answer for question: ${q.questionId}`,
      });
    }
  }

  const valid = issues.length === 0;
  // Ready means all required questions are answered with KNOWN, valid values
  const isReady = valid && !hasUnknownRequired && !missingRequired;

  return { valid, issues, isReady };
}
