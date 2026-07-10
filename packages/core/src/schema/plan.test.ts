import { describe, expect, it } from 'vitest'

import { fromDraft, MappingPlanSchema, PlanDraftSchema, sanitizePlan, toDraft, type MappingPlan, type PlanDraft } from './plan.js'

const plan = (over: Partial<MappingPlan> = {}): MappingPlan => ({
  columns: [],
  noteColumns: [],
  ignoreColumns: [],
  headerRowIndex: 0,
  defaultCountryCode: '+91',
  degraded: false,
  ...over,
})

const draft = (over: Partial<PlanDraft> = {}): PlanDraft => ({
  columns: [],
  noteColumns: [],
  ignoreColumns: [],
  ...over,
})

describe('PlanDraftSchema', () => {
  // @ai-sdk/google copies a whitelist of JSON Schema keywords into Gemini's
  // OpenAPI subset. Anything the model never sees must not be enforced on its
  // answer, or a good plan is thrown away over a rounding error.
  it('states no bound the model is never shown', () => {
    const column = PlanDraftSchema.shape.columns.element

    expect(column.shape.confidence.safeParse(95).success).toBe(true)
    expect(column.shape.reasoning.safeParse('y'.repeat(600)).success).toBe(true)
    expect(column.shape.sourceColumns.safeParse([]).success).toBe(true)
  })

  it('does not let the model claim the plan came from a model', () => {
    expect(PlanDraftSchema.shape).not.toHaveProperty('degraded')
    expect(PlanDraftSchema.shape).not.toHaveProperty('headerRowIndex')
  })

  it('pins every valueMap target to an allowed value, so a fifth status cannot exist', () => {
    const invented = {
      columns: [
        {
          target: 'crm_status',
          sourceColumns: ['S'],
          strategy: 'enum_map',
          valueMap: [{ from: 'Hot', to: 'OWNED' }],
          confidence: 1,
          reasoning: 'x',
        },
      ],
      noteColumns: [],
      ignoreColumns: [],
    }

    expect(PlanDraftSchema.safeParse(invented).success).toBe(false)
  })
})

describe('fromDraft', () => {
  it('produces a plan that satisfies the strict schema the rest of the code trusts', () => {
    const result = MappingPlanSchema.safeParse(
      fromDraft(
        draft({
          columns: [
            { target: 'name', sourceColumns: ['N'], strategy: 'direct', confidence: 42, reasoning: 'z'.repeat(900) },
          ],
        }),
        2,
      ),
    )

    expect(result.success).toBe(true)
  })

  it('records the header row it was told, not one the model chose', () => {
    expect(fromDraft(draft(), 4).headerRowIndex).toBe(4)
    expect(fromDraft(draft(), 4).degraded).toBe(false)
  })

  // It would otherwise reach coerceDate once per row of the file.
  it('drops a dateFormat too long to be a date pattern, rather than trusting it', () => {
    const withFormat = (dateFormat: string) =>
      fromDraft(
        draft({
          columns: [
            { target: 'created_at', sourceColumns: ['D'], strategy: 'date_parse', dateFormat, confidence: 1, reasoning: 'x' },
          ],
        }),
        0,
      ).columns[0]

    expect(withFormat('dd/MM/yyyy')?.dateFormat).toBe('dd/MM/yyyy')
    expect(withFormat('d'.repeat(5000))).not.toHaveProperty('dateFormat')
  })

  it('omits valueMap entirely when the model sent none', () => {
    const [column] = fromDraft(
      draft({ columns: [{ target: 'name', sourceColumns: ['N'], strategy: 'direct', confidence: 1, reasoning: 'x' }] }),
      0,
    ).columns

    expect(column).not.toHaveProperty('valueMap')
  })
})

describe('toDraft', () => {
  it('round-trips the heuristic plan through the shape the model is asked to correct', () => {
    const source = plan({
      columns: [{ target: 'name', sourceColumns: ['N'], strategy: 'direct', confidence: 0.9, reasoning: 'x' }],
      noteColumns: ['Budget'],
      ignoreColumns: ['Ref'],
      degraded: true,
    })

    const result = PlanDraftSchema.safeParse(toDraft(source))

    expect(result.success).toBe(true)
    expect(result.data?.noteColumns).toEqual(['Budget'])
    expect(result.data).not.toHaveProperty('degraded')
  })
})

describe('sanitizePlan', () => {
  const headers = ['Name', 'Mail', 'Budget', 'Ref']

  it('drops a mapping naming a column that is not in the file', () => {
    const result = sanitizePlan(
      plan({
        columns: [
          { target: 'name', sourceColumns: ['Name'], strategy: 'direct', confidence: 1, reasoning: 'x' },
          { target: 'city', sourceColumns: ['City'], strategy: 'direct', confidence: 1, reasoning: 'x' },
        ],
      }),
      headers,
    )

    expect(result.columns.map((c) => c.target)).toEqual(['name'])
  })

  it('drops a concat mapping when only one of its two columns is real', () => {
    const result = sanitizePlan(
      plan({
        columns: [{ target: 'name', sourceColumns: ['Name', 'Surname'], strategy: 'concat', confidence: 1, reasoning: 'x' }],
      }),
      headers,
    )

    expect(result.columns).toEqual([])
  })

  // Otherwise the value lands in its field and again inside crm_note.
  it('never appends a column to the note when it is already read into a field', () => {
    const result = sanitizePlan(
      plan({
        columns: [{ target: 'email', sourceColumns: ['Mail'], strategy: 'direct', confidence: 1, reasoning: 'x' }],
        noteColumns: ['Mail', 'Budget', 'Ref', 'Ghost'],
        ignoreColumns: ['Ref'],
      }),
      headers,
    )

    expect(result.noteColumns).toEqual(['Budget'])
  })

  it('keeps a column in the note when the mapping that claimed it was itself dropped', () => {
    const result = sanitizePlan(
      plan({
        columns: [{ target: 'name', sourceColumns: ['Ghost'], strategy: 'direct', confidence: 1, reasoning: 'x' }],
        noteColumns: ['Budget'],
      }),
      headers,
    )

    expect(result.noteColumns).toEqual(['Budget'])
  })
})
