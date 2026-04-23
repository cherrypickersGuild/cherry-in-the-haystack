import type { Evaluator } from './types'
import { set1OracleEvaluator } from './set1-oracle.evaluator'
import { set2HunterEvaluator } from './set2-hunter.evaluator'
import { set3PolicyEvaluator } from './set3-policy.evaluator'
import { set4QuantEvaluator } from './set4-quant.evaluator'
import { set5StrictHunterEvaluator } from './set5-strict-hunter.evaluator'
import { set6GroundedEvaluator } from './set6-grounded.evaluator'

const REGISTRY: Record<string, Evaluator> = {
  [set1OracleEvaluator.id]: set1OracleEvaluator,
  [set2HunterEvaluator.id]: set2HunterEvaluator,
  [set3PolicyEvaluator.id]: set3PolicyEvaluator,
  [set4QuantEvaluator.id]: set4QuantEvaluator,
  [set5StrictHunterEvaluator.id]: set5StrictHunterEvaluator,
  [set6GroundedEvaluator.id]: set6GroundedEvaluator,
}

export function getEvaluator(id: string): Evaluator {
  const e = REGISTRY[id]
  if (!e) throw new Error(`[bench] Unknown evaluator: ${id}`)
  return e
}

export * from './types'
