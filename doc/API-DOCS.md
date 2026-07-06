# V2-V3 系统间接口文档

## 概述

V3（运单全流程管理系统）通过 HTTP API 与 V2（万能导入系统）进行数据交互。V3 不直接连接 V2 数据库，所有运单数据的获取和校验均通过接口完成。

## 鉴权机制

所有接口使用 `X-API-Key` 请求头进行鉴权：

```
X-API-Key: v3-api-key
```

密钥通过环境变量 `V2_API_KEY` 配置，两端需保持一致。

## 接口列表

### 1. 校验运单是否存在

**端点**: `GET /api/external/waybills/validate?code={externalCode}`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 运单号（externalCode） |

**成功响应 (200)**:
```json
{
  "exists": true,
  "order": {
    "id": "clx...",
    "externalCode": "WB20260001",
    "storeName": "朝阳店",
    "recipientName": "张三",
    "recipientPhone": "13800000001",
    "recipientAddress": "北京市朝阳区某某路1号",
    "totalAmount": 0,
    "createdAt": "2026-06-01T00:00:00.000Z"
  }
}
```

**失败响应 (404)**:
```json
{
  "error": "运单不存在"
}
```

---

### 2. 获取运单详情（含 SKU 列表）

**端点**: `GET /api/external/waybills/{id}`

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | V2 运单 ID（Order.id） |

**成功响应 (200)**:
```json
{
  "id": "clx...",
  "externalCode": "WB20260001",
  "storeName": "朝阳店",
  "recipientName": "张三",
  "recipientPhone": "13800000001",
  "recipientAddress": "北京市朝阳区某某路1号",
  "totalAmount": 0,
  "items": [
    {
      "skuCode": "SKU-001-A",
      "skuName": "商品A-1",
      "quantity": 10,
      "skuSpec": "500ml"
    }
  ],
  "createdAt": "2026-06-01T00:00:00.000Z"
}
```

---

### 3. 校验 SKU 是否归属运单

**端点**: `GET /api/external/waybills/{id}/sku-validate?skuCode={skuCode}`

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | V2 运单 ID |

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| skuCode | string | 是 | SKU 编码 |

**成功响应 (200)**:
```json
{
  "valid": true,
  "item": {
    "skuCode": "SKU-001-A",
    "skuName": "商品A-1",
    "quantity": 10,
    "skuSpec": "500ml"
  }
}
```

**失败响应 (404)**:
```json
{
  "valid": false,
  "error": "SKU 不属于该运单"
}
```

---

### 4. 运单列表（分页）

**端点**: `GET /api/external/waybills`

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| pageSize | int | 20 | 每页数量（最大 50） |
| externalCode | string | - | 运单号模糊搜索 |
| dateFrom | string | - | 起始日期 (ISO 8601) |
| dateTo | string | - | 截止日期 (ISO 8601) |

**成功响应 (200)**:
```json
{
  "items": [
    {
      "id": "clx...",
      "externalCode": "WB20260001",
      "storeName": "朝阳店",
      "recipientName": "张三",
      "recipientPhone": "13800000001",
      "recipientAddress": "北京市朝阳区某某路1号",
      "totalAmount": 0,
      "items": [],
      "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

---

## 超时与重试策略

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 连接超时 | 10 秒 | 超过此时间未建立连接则判定超时 |
| 重试次数 | 1 次 | 仅对网络错误重试，不对 4xx 错误重试 |
| 重试间隔 | 1-2 秒 | 递增间隔 |

## 熔断器策略

- 连续失败 5 次 → 熔断器打开（30 秒）
- 熔断期间所有请求直接返回降级响应
- 30 秒后半开状态，允许一个探测请求
- 探测成功 → 熔断器关闭
- 探测失败 → 继续熔断 30 秒

## V2 不可用时的降级方案

### 读操作
- 使用本地 `WaybillSnapshot` 表缓存数据
- 页面显示黄色提示："V2 服务暂不可用，显示的是本地缓存数据，可能不是最新状态"
- 标注数据来源和同步时间

### 写操作
- 扫描和工单创建返回 503："V2 服务暂不可用，无法验证运单信息，请稍后重试"
- 审批和执行操作不受影响（不依赖 V2 接口）

### 恢复
- 熔断器半开探测成功后自动恢复
- 无需人工介入

## 请求追踪

每次跨系统调用生成唯一 Request ID（UUID），写入 SyncLog 表。通过 Request ID 可完整还原调用链路。

## 接口版本策略

- 当前版本：`/api/external/`（无版本前缀）
- 未来升级：`/api/external/v1/`、`/api/external/v2/`
- 向后兼容原则：新增字段不断向后兼容，废弃字段保留一个版本周期