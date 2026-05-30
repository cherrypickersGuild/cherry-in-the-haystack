import type { Evaluator } from './types'
import { set2HunterEvaluator } from './set2-hunter.evaluator'
import { set3PolicyEvaluator } from './set3-policy.evaluator'
import { set4QuantEvaluator } from './set4-quant.evaluator'
import { set6GroundedEvaluator } from './set6-grounded.evaluator'

const REGISTRY: Record<string, Evaluator> = {
  [set2HunterEvaluator.id]: set2HunterEvaluator,
  [set3PolicyEvaluator.id]: set3PolicyEvaluator,
  [set4QuantEvaluator.id]: set4QuantEvaluator,
  [set6GroundedEvaluator.id]: set6GroundedEvaluator,
}

export function getEvaluator(id: string): Evaluator {
  const e = REGISTRY[id]
  if (!e) throw new Error(`[bench] Unknown evaluator: ${id}`)
  return e
}

export * from './types'
