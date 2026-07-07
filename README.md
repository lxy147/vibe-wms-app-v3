# 运单全流程管理系统 V3

**录单 → 扫描品控 → 异常上报 → 分级审批 → 执行联动** —— 运单全生命周期管理

## 在线地址

V3: https://vibe-wms-app-v3.vercel.app
V2: https://vibe-wms-platform.vercel.app/
GitHub: https://github.com/lxy147/vibe-wms-app-v3

## 技术栈

- **框架**: Next.js 16 + React 19 + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui (new-york) + Radix UI
- **数据库**: Neon PostgreSQL + Prisma ORM
- **部署**: Vercel

## 项目结构

```
app/
├── page.tsx                      # 工作台 Dashboard
├── scan/                         # 扫描品控
│   ├── page.tsx                  # 扫描录入
│   └── records/page.tsx          # 扫描记录
├── tickets/                      # 异常工单
│   ├── page.tsx                  # 工单列表
│   ├── create/page.tsx           # 手工上报
│   └── [id]/page.tsx             # 工单详情
├── approval/page.tsx             # 待审批
├── qc-rules/page.tsx             # 品控规则
├── inventory/page.tsx            # 库存管理
├── compensations/page.tsx        # 赔付记录
├── sync/page.tsx                 # 接口监控
├── settings/page.tsx             # 系统配置
├── login/page.tsx                # 登录页
├── users/page.tsx                # 用户管理
└── api/                          # API 路由
    ├── auth/                     # 认证 API (login/logout/me)
    ├── scan/                     # 扫描 API
    ├── tickets/                  # 工单 API
    ├── qc-rules/                 # 品控规则 API
    ├── config/                   # 配置 API
    ├── sync/                     # 同步监控 API
    ├── cron/                     # 定时任务 API
    └── seed/                     # 种子数据 API
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填写数据库连接信息：

```env
DATABASE_URL="postgresql://..."
V2_API_BASE_URL="https://vibe-wms-platform.vercel.app"
V2_API_KEY="v3-api-key"
CRON_SECRET="your-cron-secret"
ALLOW_SEED="true"
```

### 3. 初始化数据库

```bash
npx prisma db push
```

### 4. 生成种子数据

```bash
# 启动开发服务器
npm run dev

# 访问 http://localhost:3000/api/seed (POST) 生成种子数据
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 测试账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | 123456 | 管理员 | 全部权限 |
| qc_supervisor | 123456 | 品控主管 | 扫描 + 快速放行 |
| approver1_a | 123456 | 一级审批人 | 一级审批 |
| approver1_b | 123456 | 一级审批人 | 一级审批 |
| approver1_c | 123456 | 一级审批人 | 一级审批 |
| approver2_a | 123456 | 二级审批人 | 二级审批 |
| approver2_b | 123456 | 二级审批人 | 二级审批 |
| operator_a | 123456 | 操作员 | 扫描 + 上报 |
| operator_b | 123456 | 操作员 | 扫描 + 上报 |
| operator_c | 123456 | 操作员 | 扫描 + 上报 |

**审批规则**：同级别审批人都可审批，不能审批自己提交的工单。

## 核心功能

### 扫描品控
- 运单号 + SKU 编码扫描录入
- 品控规则引擎自动检测（数量差异、破损、规格不符、标签错误、批次异常）
- 品控暂扣（批次锁定，禁止出库）
- 品控主管快速放行

### 异常工单
- 手工上报物流异常（丢件、破损、拒收、超时、地址错误）
- 扫描自动触发品控异常工单
- V2 接口实时校验运单存在性
- 同类型重复上报防护

### 分级审批
- 可配置金额阈值（小额/中额/大额）
- 一级/二级审批流转
- 乐观锁并发冲突处理
- 审批人离职兜底
- 超时自动流转

### 执行联动
- 事务保证一致性
- 赔付记录（赔付客户/向供应商追偿）
- 库存联动（批次解锁/退货/核销）
- 完整可追溯链

### 跨系统接口
- HTTP API 与 V2 数据互通
- 熔断器降级保护
- 同步日志与监控
- 数据新鲜度标注

## 文档

- [需求理解与假设说明](./doc/ASSUMPTIONS.md)
- [系统间接口文档](./doc/API-DOCS.md)
- [需求规格说明](./doc/exam-v3-exception-waybill-approval-改进版.md)