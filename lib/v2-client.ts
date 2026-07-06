import { db } from './db'
import { generateRequestId } from './request-id'

const V2_BASE_URL = process.env.V2_API_BASE_URL || 'https://vibe-wms-platform.vercel.app'
const V2_API_KEY = process.env.V2_API_KEY || 'v3-api-key'
const TIMEOUT_MS = 10000
const MAX_RETRIES = 1
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_RESET_MS = 30000

// 熔断器状态
let failureCount = 0
let circuitOpen = false
let circuitOpenSince = 0

type V2Response<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  fromCache?: boolean
}

async function logSync(params: {
  requestId: string
  endpoint: string
  method: string
  requestSummary?: string
  responseStatus?: number
  success: boolean
  errorMessage?: string
  durationMs: number
}): Promise<void> {
  try {
    await db.syncLog.create({
      data: {
        requestId: params.requestId,
        endpoint: params.endpoint,
        method: params.method,
        requestSummary: params.requestSummary || '',
        responseStatus: params.responseStatus,
        success: params.success,
        errorMessage: params.errorMessage || '',
        durationMs: params.durationMs,
      },
    })
  } catch {
    // 同步日志写入失败不应影响主流程
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'X-API-Key': V2_API_KEY,
          'X-Request-ID': generateRequestId(),
        },
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      if (attempt === retries) throw error
      // 仅对网络错误重试，不对 4xx 重试
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function callV2<T = unknown>(
  endpoint: string,
  options: { method?: string; body?: Record<string, unknown>; params?: Record<string, string> } = {},
): Promise<V2Response<T>> {
  const requestId = generateRequestId()
  const method = options.method || 'GET'
  const startTime = Date.now()

  // 熔断器检查
  if (circuitOpen) {
    const elapsed = Date.now() - circuitOpenSince
    if (elapsed < CIRCUIT_BREAKER_RESET_MS) {
      await logSync({
        requestId,
        endpoint,
        method,
        requestSummary: JSON.stringify(options.params || {}),
        success: false,
        errorMessage: 'Circuit breaker open',
        durationMs: Date.now() - startTime,
      })
      return { success: false, error: 'V2 服务暂不可用，请稍后重试', fromCache: false }
    }
    // 半开状态，允许一个探测请求
    circuitOpen = false
  }

  try {
    const url = new URL(`${V2_BASE_URL}${endpoint}`)
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const response = await fetchWithRetry(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': V2_API_KEY,
        'X-Request-ID': requestId,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      failureCount++
      if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitOpen = true
        circuitOpenSince = Date.now()
      }
      await logSync({
        requestId,
        endpoint,
        method,
        requestSummary: JSON.stringify(options.params || {}),
        responseStatus: response.status,
        success: false,
        errorMessage: `V2 returned ${response.status}`,
        durationMs,
      })
      return { success: false, error: `V2 接口返回错误 ${response.status}`, fromCache: false }
    }

    // 成功，重置熔断器
    failureCount = 0
    circuitOpen = false

    const data = await response.json() as T
    await logSync({
      requestId,
      endpoint,
      method,
      requestSummary: JSON.stringify(options.params || {}),
      responseStatus: response.status,
      success: true,
      durationMs,
    })

    return { success: true, data, fromCache: false }
  } catch (error: unknown) {
    failureCount++
    if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitOpen = true
      circuitOpenSince = Date.now()
    }
    const durationMs = Date.now() - startTime
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    await logSync({
      requestId,
      endpoint,
      method,
      requestSummary: JSON.stringify(options.params || {}),
      success: false,
      errorMessage: errMsg,
      durationMs,
    })
    return { success: false, error: errMsg, fromCache: false }
  }
}

// ====== V2 接口封装 ======

export interface V2WaybillBasic {
  id: string
  externalCode: string
  storeName: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  totalAmount?: number
}

export interface V2WaybillDetail extends V2WaybillBasic {
  items: V2WaybillItem[]
}

export interface V2WaybillItem {
  skuCode: string
  skuName: string
  quantity: number
  skuSpec: string
}

export interface V2PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// 校验运单是否存在
export async function validateWaybill(externalCode: string): Promise<V2Response<V2WaybillBasic>> {
  return callV2<V2WaybillBasic>('/api/external/waybills/validate', {
    params: { code: externalCode },
  })
}

// 获取运单详情（含 SKU 列表）
export async function getWaybillDetail(id: string): Promise<V2Response<V2WaybillDetail>> {
  return callV2<V2WaybillDetail>(`/api/external/waybills/${id}`)
}

// 校验 SKU 是否归属运单
export async function validateSku(waybillId: string, skuCode: string): Promise<V2Response<V2WaybillItem>> {
  return callV2<V2WaybillItem>(`/api/external/waybills/${waybillId}/sku-validate`, {
    params: { skuCode },
  })
}

// 分页获取运单列表
export async function listWaybills(params: {
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
  externalCode?: string
}): Promise<V2Response<V2PaginatedResponse<V2WaybillDetail>>> {
  return callV2<V2PaginatedResponse<V2WaybillDetail>>('/api/external/waybills', {
    params: params as Record<string, string>,
  })
}

// 检查熔断器状态
export function getCircuitBreakerStatus(): { open: boolean; failureCount: number } {
  return { open: circuitOpen, failureCount }
}