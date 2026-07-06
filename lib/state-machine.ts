import { TicketStatus } from '@prisma/client'

// ====== 工单状态机 ======

// 定义所有合法状态转换
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  PENDING_APPROVAL: ['LEVEL1_APPROVING', 'LEVEL2_APPROVING', 'CLOSED'],
  LEVEL1_APPROVING: ['LEVEL2_APPROVING', 'EXECUTING', 'PENDING_APPROVAL', 'CLOSED'],
  LEVEL2_APPROVING: ['EXECUTING', 'PENDING_APPROVAL', 'CLOSED'],
  EXECUTING: ['COMPLETED'],
  COMPLETED: [],
  CLOSED: [],
}

// 校验状态转换是否合法
export function validateTransition(from: TicketStatus, to: TicketStatus): boolean {
  const allowed = TICKET_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

// 获取状态转换的错误消息
export function getTransitionErrorMessage(from: TicketStatus, to: TicketStatus): string {
  if (validateTransition(from, to)) return ''
  return `不允许从 ${from} 转换到 ${to}`
}

// 状态显示名称
export const STATUS_LABELS: Record<TicketStatus, string> = {
  PENDING_APPROVAL: '待审批',
  LEVEL1_APPROVING: '一级审批中',
  LEVEL2_APPROVING: '二级审批中',
  EXECUTING: '执行中',
  COMPLETED: '已完成',
  CLOSED: '已关闭',
}

// 状态颜色映射
export const STATUS_COLORS: Record<TicketStatus, string> = {
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  LEVEL1_APPROVING: 'bg-blue-100 text-blue-800',
  LEVEL2_APPROVING: 'bg-purple-100 text-purple-800',
  EXECUTING: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
}

// 异常类型显示名称
export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  LOST: '丢件',
  DAMAGED: '破损',
  REJECTED_BY_CUSTOMER: '客户拒收',
  TIMEOUT_DELIVERY: '超时未签收',
  WRONG_ADDRESS: '收货地址错误',
  QC_QUANTITY_MISMATCH: '数量不符',
  QC_APPEARANCE_DAMAGE: '外观破损',
  QC_SPEC_MISMATCH: '规格不符',
  QC_LABEL_ERROR: '标签错误',
  QC_BATCH_ABNORMAL: '批次异常',
}

// 异常来源显示名称
export const EXCEPTION_SOURCE_LABELS: Record<string, string> = {
  MANUAL_REPORT: '手工上报',
  SCAN_TRIGGERED: '扫描触发',
}

// 赔付方向显示名称
export const COMPENSATION_DIRECTION_LABELS: Record<string, string> = {
  TO_CUSTOMER: '赔付客户',
  FROM_SUPPLIER: '向供应商追偿',
}

// ====== 扫描批次状态机 ======

export const BATCH_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ['LOCKED'],
  LOCKED: ['RELEASED', 'VOIDED'],
  RELEASED: [],
  VOIDED: [],
}

// 批次状态显示名称
export const BATCH_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: '可出库',
  LOCKED: '品控暂扣',
  RELEASED: '已解锁',
  VOIDED: '已作废',
}

// 批次状态颜色
export const BATCH_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  LOCKED: 'bg-orange-100 text-orange-800',
  RELEASED: 'bg-teal-100 text-teal-800',
  VOIDED: 'bg-gray-100 text-gray-800',
}

// 异常类型对应的下游执行动作
export const EXCEPTION_ACTION_MAP: Record<string, { actions: string[]; compensationDirection: string | null }> = {
  LOST: { actions: ['理赔', '库存核销', '重新发货'], compensationDirection: 'TO_CUSTOMER' },
  DAMAGED: { actions: ['理赔', '退货入库'], compensationDirection: 'TO_CUSTOMER' },
  REJECTED_BY_CUSTOMER: { actions: ['退货入库'], compensationDirection: null },
  TIMEOUT_DELIVERY: { actions: ['理赔', '重新发货'], compensationDirection: 'TO_CUSTOMER' },
  WRONG_ADDRESS: { actions: ['重新发货'], compensationDirection: null },
  QC_QUANTITY_MISMATCH: { actions: ['退回供应商', '向供应商追偿', '重新采购'], compensationDirection: 'FROM_SUPPLIER' },
  QC_APPEARANCE_DAMAGE: { actions: ['退回供应商', '向供应商追偿', '降级处理'], compensationDirection: 'FROM_SUPPLIER' },
  QC_SPEC_MISMATCH: { actions: ['退回供应商', '向供应商追偿', '重新采购'], compensationDirection: 'FROM_SUPPLIER' },
  QC_LABEL_ERROR: { actions: ['退回供应商', '重新采购'], compensationDirection: 'FROM_SUPPLIER' },
  QC_BATCH_ABNORMAL: { actions: ['退回供应商', '向供应商追偿', '重新采购', '降级处理'], compensationDirection: 'FROM_SUPPLIER' },
}