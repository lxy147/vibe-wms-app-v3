import { db } from './db'
import type { QCRule, ExceptionType, QCSeverity, ApprovalLevel } from '@prisma/client'

// 品控引擎检测结果
export interface QCEvaluationResult {
  passed: boolean
  matchedRules: {
    ruleId: string
    ruleName: string
    exceptionSubType: ExceptionType
    severity: QCSeverity
    autoCreateTicket: boolean
    defaultApprovalLevel: ApprovalLevel
    reason: string
  }[]
}

// 触发条件类型
interface QuantityDiffCondition {
  type: 'quantity_diff'
  threshold: number  // 差异比例，如 0.05 表示 5%
  operator: 'gt' | 'gte' | 'lt' | 'lte'
}

interface DamageLevelCondition {
  type: 'damage_level'
  minLevel: number  // 破损等级 1-4
}

interface SpecMismatchCondition {
  type: 'spec_mismatch'
  fields: string[]  // 需要校验的字段
}

interface LabelErrorCondition {
  type: 'label_error'
  checkFields: string[]  // 需要检查的标签字段
}

interface BatchAbnormalCondition {
  type: 'batch_abnormal'
  matchMode: 'mismatch' | 'unknown'
}

type TriggerCondition = QuantityDiffCondition | DamageLevelCondition | SpecMismatchCondition | LabelErrorCondition | BatchAbnormalCondition

// 扫描数据输入
export interface ScanInput {
  skuCode: string
  skuName: string
  expectedQuantity?: number
  actualQuantity?: number
  damageLevel?: number
  skuSpec?: string
  expectedSpec?: string
  labelInfo?: Record<string, string>
  batchInfo?: string
}

// 品控规则引擎
export async function evaluateQCRules(scanInput: ScanInput): Promise<QCEvaluationResult> {
  const rules = await db.qCRule.findMany({
    where: { isActive: true },
  })

  const matchedRules: QCEvaluationResult['matchedRules'] = []

  for (const rule of rules) {
    const condition = rule.triggerCondition as unknown as TriggerCondition
    const matchResult = evaluateCondition(condition, scanInput)

    if (matchResult.matched) {
      matchedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        exceptionSubType: rule.exceptionSubType,
        severity: rule.severity,
        autoCreateTicket: rule.autoCreateTicket,
        defaultApprovalLevel: rule.defaultApprovalLevel,
        reason: matchResult.reason,
      })
    }
  }

  return {
    passed: matchedRules.length === 0,
    matchedRules: matchedRules.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)),
  }
}

function severityWeight(severity: QCSeverity): number {
  const weights: Record<QCSeverity, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  }
  return weights[severity]
}

function evaluateCondition(condition: TriggerCondition, input: ScanInput): { matched: boolean; reason: string } {
  switch (condition.type) {
    case 'quantity_diff': {
      if (input.expectedQuantity === undefined || input.actualQuantity === undefined) {
        return { matched: false, reason: '未提供数量信息' }
      }
      const diff = Math.abs(input.expectedQuantity - input.actualQuantity) / input.expectedQuantity
      const matched = condition.operator === 'gt' ? diff > condition.threshold
        : condition.operator === 'gte' ? diff >= condition.threshold
        : condition.operator === 'lt' ? diff < condition.threshold
        : diff <= condition.threshold
      return {
        matched,
        reason: matched
          ? `数量差异 ${(diff * 100).toFixed(1)}% ${condition.operator === 'gt' || condition.operator === 'gte' ? '超过' : '低于'}阈值 ${(condition.threshold * 100).toFixed(1)}%`
          : `数量差异 ${(diff * 100).toFixed(1)}% 未超过阈值`,
      }
    }

    case 'damage_level': {
      if (input.damageLevel === undefined) {
        return { matched: false, reason: '未提供破损等级信息' }
      }
      const matched = input.damageLevel >= condition.minLevel
      return {
        matched,
        reason: matched
          ? `破损等级 ${input.damageLevel} 达到阈值 ${condition.minLevel}`
          : `破损等级 ${input.damageLevel} 未达到阈值 ${condition.minLevel}`,
      }
    }

    case 'spec_mismatch': {
      const expectedSpec = (input.expectedSpec || '').trim()
      const actualSpec = (input.skuSpec || '').trim()
      const matched = expectedSpec !== actualSpec
      return {
        matched,
        reason: matched
          ? `规格不匹配：期望 "${expectedSpec}"，实际 "${actualSpec}"`
          : `规格匹配：${expectedSpec}`,
      }
    }

    case 'label_error': {
      if (!input.labelInfo) {
        return { matched: false, reason: '未提供标签信息' }
      }
      const fields = condition.checkFields || []
      const mismatches = fields.filter((f) => {
        const expected = input.labelInfo?.[f] || ''
        return !expected
      })
      return {
        matched: mismatches.length > 0,
        reason: mismatches.length > 0
          ? `标签字段缺失：${mismatches.join(', ')}`
          : '标签信息完整',
      }
    }

    case 'batch_abnormal': {
      const matched = !input.batchInfo || input.batchInfo === 'unknown'
      return {
        matched,
        reason: matched ? '批次信息异常或未知' : '批次信息正常',
      }
    }

    default:
      return { matched: false, reason: '未知规则类型' }
  }
}