# Topic Analytics 数据模型 — v2 终版（Blocker Fix）

> **本轮定位**：仅针对上一版的 9 个 blocker 做精准修正，不重写整套架构。
> **未改正式代码**：`src/生活站.html` 未触碰。
> **下一步**：等用户批准后才进 Phase 1（数据+计算层），Phase 2（UI）不在本轮。

---

## Blocker 总览

| # | Blocker | 严重度 | 影响 |
|---|---------|-------|------|
| 1 | `link_type` 含 `inherited` 与 `inherited_from_*` 语义冲突 | High | Schema 自相矛盾 |
| 2 | Analytics 没真正以 `db_topic_events` 为 Evidence 输入 | **Critical** | Evidence 表变装饰 |
| 3 | 0 evidence 时返回 Exposure | High | 凭空产出档位 |
| 4 | E6 由文本关键词自动推断 | High | Reuse 误判 |
| 5 | Co-topic 用 `weighted_support >= 3` 替代 `raw_support_count` | High | 误关联 |
| 6 | Provenance merge 用 `max(rel)×max(conf)` | Medium | effective 被放大 |
| 7 | Context Prior 两套并行公式 | Medium | 维护灾难 |
| 8 | Case A/B/C/D 内部自相矛盾 | High | 测试失真 |
| 9 | Phase 1 验收条件不全 | High | 漏掉回归路径 |

---

## 1. Final Schema Diff

### 1.1 `db_topic_links`（语义关系层 — 只回答"这条记录与什么 Topic 有关"）

| 字段 | 原状 | 修正后 | 备注 |
|------|------|--------|------|
| `link_id` | 保留 | 保留 | PK |
| `record_type` | 保留 | 保留 | task / plan / project / course / note / ... |
| `record_id` | 保留 | 保留 | |
| `topic_id` | 保留 | 保留 | |
| `link_type` | `'direct'\|'contextual'\|'inherited'` | **`'direct'\|'contextual'`** | **删除 `inherited`** |
| `relation_source` | 保留 | 保留 | manual / rule / ai_suggested / migrated_inference |
| `relevance` | 保留 | 保留 | 0-1，单条 provenance 维度 |
| `confidence` | 保留 | 保留 | 0-1 |
| `review_status` | 保留 | 保留 | pending / confirmed / rejected |
| `inherited_from_type` | 保留 | 保留 | **继承关系仅走此字段**，与 `link_type` 解耦 |
| `inherited_from_id` | 保留 | 保留 | 同上 |
| `inheritance_depth` | 保留 | 保留 | 0 / 1 / 2 |
| `context_key` | 保留 | 保留 | |
| **`provenance`** | **缺** | **新增** | `[{relation_source, link_type, relevance, confidence, inherited_from_type, inherited_from_id, inheritance_depth}, ...]` |
| `created_at` | 保留 | 保留 | |
| `updated_at` | 保留 | 保留 | |

**绝不存储**：`effective_weight`、`nature`、`stage` — 这三个属于 Evidence 层，不能倒灌。

### 1.2 `db_topic_events`（Evidence 层 — 真正决定"Familiarity/Deph/Momentum 怎么算"）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `event_id` | uuid | ✅ | PK |
| `topic_id` | uuid | ✅ | FK |
| `source_link_id` | uuid | ✅ | FK `db_topic_links.link_id` |
| `source_record_id` | string | ✅ | 原始记录 ID |
| `record_type` | enum | ✅ | task / plan / project / course / note |
| `date` | date | ✅ | 事件日期 |
| `stage` | enum | ✅ | `E1` / `E2` / `E3` / `E4` / `E5` / `ReuseCandidate` / `Unknown`（**E6 由升级函数写入，不在 inferStage 直接产出**） |
| `nature` | enum | ✅ | `Knowledge` / `Practice` / `Admin` / `Unknown`（默认 `Unknown`） |
| `context_key` | string | ✅ | |
| `effective_weight` | number | ✅ | `relevance × confidence`（来自 canonical link） |
| `evidence_type` | enum | ✅ | read / search / note / explain / compare / integrate / build / implement / output / reuse / migration / manual |
| `event_key` | string | ✅ | **deterministic 幂等键**：默认 `source_link_id`（同一 Evidence 重建 10 次只产 1 条）；高阶可由 `source_link_id + evidence_type + evidence_date + record_version` 组合 |
| `created_at` | datetime | ✅ | |

**幂等规则**：
- 写入前 `SELECT WHERE event_key = ?`；存在 → `UPDATE`（覆盖 stage / nature / effective / context_key / date），不存在 → `INSERT`
- **rebuild 时 replace 而非 append**，保证 10 次重建数据库仍只有 1 条
- 验证用 `Repeated migration → no duplicate events`（migration / rebuild 幂等测试）

### 1.3 `db_topics`

保持不变。

### 1.4 业务表扩展

| 表 | 字段 | 说明 |
|----|------|------|
| `year_plan` | `topic_context: {primary, context[]}` | 仅 Prior / 候选池 |
| `projects` | `topic_context: {primary, context[]}` | 同上 |
| `courses` | `topic_context: {primary, context[]}` | 同上 |
| `today_tasks` | `nature: enum`、`context_key` | 任务维度 |
| `study_tasks` | `nature: enum`、`context_key` | 任务维度 |

### 1.5 Schema 版本

```js
const TOPIC_ANALYTICS_SCHEMA_VERSION = 1;  // 独立命名，不复用 SCHEMA_VERSION
```

启动时校验：不匹配 → 提示迁移，**禁止静默回退**。

---

## 2. Final Evidence Flow

```
[Raw Record] task / plan / project / course / note
        │
        │  linkRules(manual | rule | ai_suggested)
        │  relevance = prior_strength × content_support
        │  confidence 来源：manual=1.0 / rule=0.85 / ai_suggested=0.55 / migrated_inference=0.40
        ▼
[Topic Link] db_topic_links
   • link_type: direct | contextual
   • relevance, confidence（单条 provenance 维度）
   • provenance[]（多源合并痕迹）
   • inherited_from_* 仅作 lineage 标记
   • review_status: pending | confirmed | rejected
        │
        │  Evidence Builder（写时一次性计算）
        │  过滤：rejected → 跳过
        │  过滤：effective_weight 入 event，但 <.40 不进 Familiarity 候选
        │  stage ← inferStage(record)（仅 E1-E5 + ReuseCandidate）
        │  nature ← inferNature(record)
        ▼
[Topic Event / Evidence] db_topic_events
   • stage, nature, effective_weight, context_key, date
   • 唯一索引：event_key（默认 = source_link_id；rebuild replace 而非 append）
        │
        │  Analytics Layer（只读 db_topic_events）
        │  ❌ 不再现场 inferStage()
        │  ❌ 不再回读原始 Task 算 Stage
        ▼
[Depth / Momentum / Familiarity / Co-topic]
```

### 2.1 Evidence Builder 规则（写时落库，不读时算）

```js
function buildEvent(link, record, ctx) {
  if (link.review_status === 'rejected') return null;            // 1. rejected 不产 event

  const stage = inferStage(record);                              // 2. 仅 E1-E5 + ReuseCandidate
  const nature = inferNature(record);                            // 3. 推断 nature
  const effective = link.relevance * link.confidence;            // 4. canonical effective
  const eventKey = (link.link_id, ctx.date);

  return {
    event_id: uuid(),
    topic_id: link.topic_id,
    source_link_id: link.link_id,
    source_record_id: record.id,
    record_type: link.record_type,
    date: ctx.date,
    stage,                                                       // 不存 effective → 不存错
    nature,
    context_key: record.context_key ?? '_default',
    effective_weight: effective,
    evidence_type: inferEvidenceType(record),
    created_at: now(),
    _key: eventKey,                                              // 唯一约束占位
  };
}
```

### 2.2 Stage 推断边界（关键）

```js
const STAGE_KEYWORDS = {
  E1: [/读/, /看/, /搜/, /浏览/, /翻/],                  // Explore
  E2: [/学/, /笔记/, /解释/, /总结/, /理解/],            // Learn
  E3: [/比较/, /整合/, /框架/, /梳理/, /对比/],          // Synthesize
  E4: [/做/, /实现/, /跑通/, /完成初版/, /上线初版/],    // Apply
  E5: [/报告/, /完整代码/, /成品/, /文档化/, /交付/],    // Output
  // E6 不在关键词层 — 必须 ReuseCandidate → 升级
};

function inferStage(record) {
  const matched = matchKeyword(record, STAGE_KEYWORDS);
  if (matched) return matched;  // E1..E5

  if (/复用|再次使用|迁移/.test(record.text)) return 'ReuseCandidate';
  return 'Unknown';
}
```

---

## 3. Final Familiarity Gate

### 3.1 6 档枚举（含 Unrated — 修正 blocker #3）

```js
const FAMILIARITY_LEVELS = ['Unrated', 'Exposure', 'Learning', 'Working', 'Proficient', 'Integrated'];
//  6 档：无证据 → Unrated；其余按证据强度升档
```

### 3.2 输入过滤（修正 blocker #2）

```js
function familiarEvents(topic_id) {
  return db_topic_events.filter(e =>
    e.topic_id === topic_id &&
    e.stage !== 'Unknown' &&
    e.nature !== 'Admin' &&
    e.nature !== 'Unknown' &&
    e.effective_weight >= FAMILIARITY_EVIDENCE_THRESHOLD   // .40
  );
}
```

### 3.3 计算函数（只读 events，不读 task）

```js
function calculateFamiliarity(topic_id) {
  const events = familiarEvents(topic_id);
  if (events.length === 0) return { level: 'Unrated', evidence_count: 0, stability: 'none' };

  const byStage = countBy(events, 'stage');
  const ctxSet = new Set(events.map(e => e.context_key));

  // 顺序判定：Integrated > Proficient > Working > Learning > Exposure
  if (byStage.E6 >= 1 && ctxSet.size >= 2 && byStage.E4 >= 1)
    return { level: 'Integrated', evidence_count: events.length, stability: stabilityOf(events) };

  if (byStage.E4 >= 2 && (byStage.E5 >= 1 || byStage.E3 >= 1) && (ctxSet.size >= 2 || multiTaskInSameCtx(events)))
    return { level: 'Proficient', evidence_count: events.length, stability: stabilityOf(events) };

  if (byStage.E4 >= 1)
    return { level: 'Working', evidence_count: events.length,
             stability: events.length === 1 ? 'low' : stabilityOf(events) };

  if (byStage.E2 >= 2 || byStage.E3 >= 1)
    return { level: 'Learning', evidence_count: events.length, stability: stabilityOf(events) };

  if (byStage.E1 >= 1)
    return { level: 'Exposure', evidence_count: events.length, stability: 'low' };

  return { level: 'Unrated', evidence_count: 0, stability: 'none' };
}
```

### 3.4 E6 ReuseCandidate → E6 升级（修正 blocker #4）

```js
// 写入 db_topic_events 时若 stage='ReuseCandidate'，必须经过 promoteReuse 升级才能进 Familiarity
function promoteReuse(event) {
  if (event.stage !== 'ReuseCandidate') return false;

  // 跨 context + 有 lineage 来源 stage (E3/E4/E5)
  const lineage = db_topic_events.filter(e =>
    e.topic_id === event.topic_id &&
    e.context_key !== event.context_key &&
    ['E3', 'E4', 'E5'].includes(e.stage)
  );
  if (lineage.length === 0) return false;

  event.stage = 'E6';
  event.promoted_at = now();
  return true;
}
```

文本出现 `复用 / 再次使用 / 迁移` **只能生成 ReuseCandidate**，**绝不能直接 E6**。

### 3.5 各状态过滤矩阵

| 状态 | 进 Familiarity? | 进 Knowledge Depth? | 进 Momentum? | 入 event 表? |
|------|----------------|---------------------|---------------|---------------|
| Admin | ❌ | ❌ | ❌ | ✅（保留 raw 痕迹） |
| Unknown（stage / nature） | ❌ | ❌ | ❌ | ✅ |
| Rejected link | ❌ | ❌ | ❌ | ❌（不生成） |
| `effective < .40` | ❌ | ❌ | ✅ | ✅ |
| ReuseCandidate 未升级 | ❌ | ❌（仅 Depth Frontier） | ✅ | ✅ |
| E6 已升级 | ✅ | ✅ | ✅ | ✅ |

---

## 4. Final Co-topic Formula

### 4.1 双指标 + per-link threshold（三层 gate）

```js
// Step 1：对单条 Topic Link，只允许 effective >= .20 的进 record 的 co-topic candidate set
function recordCoTopicCandidates(record, allTopics) {
  const links = db_topic_links.filter(l => l.record_id === record.id);
  const candidates = new Set();
  for (const link of links) {
    const eff = link.relevance * link.confidence;
    if (eff >= COTOPIC_CANDIDATE_THRESHOLD) candidates.add(link.topic_id);
  }
  return candidates;   // 同一 record 内通过门槛的 topic 集合
}

// Step 2：对 Topic Pair 计算
function computeCoTopic(topicA, topicB) {
  // 两次共现：两 topic 都通过单 link .20 门槛的独立 record
  const records = allRecords().filter(r => {
    const cands = recordCoTopicCandidates(r);
    return cands.has(topicA) && cands.has(topicB);
  });

  return {
    raw_support_count: records.length,                                       // 出现 record 数
    weighted_support:  records.reduce((s, r) => {
      const a = effectiveOf(r, topicA);
      const b = effectiveOf(r, topicB);
      return s + Math.min(a, b);                                              // Σ min(effA, effB)
    }, 0),
  };
}
```

### 4.2 Topic Pair 候选 Gate（修正 v1 bug）

```js
const TOPIC_ANALYTICS_CONFIG = {
  // 单 link 门槛（决定 record 是否让 topic 进入 co-topic set）
  COTOPIC_CANDIDATE_THRESHOLD: 0.20,

  // Topic Pair 门槛（决定 pair 是否成为 candidate）
  COTOPIC_MIN_COUNT:          3,
};

function isCoTopicCandidate(stats) {
  // ✅ 正确：只在 Topic Pair 层面用 raw_support_count
  return stats.raw_support_count >= COTOPIC_MIN_COUNT;
  // ❌ 错（v1 bug）：
  //   return stats.maxEffectiveWeight >= 0.20 && stats.raw_support_count >= 3;
  //   （pair 层面只看 record 共现次数；.20 是单 link 门槛，不在 pair 层判断）
}

function isAssociation(stats) {
  // 关联强度：用于显示连接线粗细 / 排序，不替代 candidate
  return stats.weighted_support;
}
```

**流程总结**：
```
单条 Link: effective >= .20   →  record 的 co-topic candidate set
                                       ↓
同一 record 内两 topic 都在 set → 算 1 次共现
                                       ↓
Topic Pair: raw_support_count   →  ≥ 3 → candidate
            weighted_support    →  Association 强度（不替代 candidate）
```

### 4.3 Provenance Merge（修正 blocker #6 + #7）

```js
function mergeProvenance(links) {
  // 每条 provenance 独立算 effective
  const provenances = links.flatMap(l => (l.provenance ?? [l]).map(p => ({
    relation_source: p.relation_source,
    link_type: p.link_type ?? l.link_type,
    relevance: p.relevance,
    confidence: p.confidence,
    inherited_from_type: p.inherited_from_type ?? l.inherited_from_type,
    inherited_from_id: p.inherited_from_id ?? l.inherited_from_id,
    inheritance_depth: p.inheritance_depth ?? l.inheritance_depth,
    effective: p.relevance * p.confidence,
  })));

  // canonical effective = max(effective)
  const canonical_effective = Math.max(...provenances.map(p => p.effective));

  // canonical link_type = 优先级：direct > contextual
  const types = new Set(provenances.map(p => p.link_type));
  const canonical_link_type = types.has('direct') ? 'direct' : 'contextual';

  // canonical relevance = 取 max(effective) 对应那条的 relevance
  const canonical_relevance = provenances.find(p => p.effective === canonical_effective).relevance;

  return {
    provenance: provenances,
    relevance: canonical_relevance,
    confidence: canonical_effective / canonical_relevance,
    link_type: canonical_link_type,
    effective: canonical_effective,
    // ❌ 禁止：max(relevance) × max(confidence)
  };
}
```

### 4.4 Context Prior 统一公式（修正 blocker #7）

```js
function computeLinkRelevance(record, topic, ctx) {
  const prior_strength = topicContextPrior(topic, ctx);   // 0-1，topic 在此 context 的历史强度
  const content_support = contentMatchStrength(record, topic);  // 0-1，文本/字段与 topic 词的匹配
  const relevance = clamp01(prior_strength * content_support + Math.min(prior_strength, content_support) * 0.1);
  // 所有 magic number 入 TOPIC_ANALYTICS_CONFIG
  return relevance;
}
```

合并所有 magic number：

```js
const TOPIC_ANALYTICS_CONFIG = {
  // Familiarity
  FAMILIARITY_EVIDENCE_THRESHOLD: 0.40,

  // Co-topic
  COTOPIC_CANDIDATE_THRESHOLD:    0.20,
  COTOPIC_MIN_COUNT:              3,

  // Context Prior
  PRIOR_BASE_WEIGHT:              0.55,
  CONTENT_BASE_WEIGHT:            0.45,
  INHERITANCE_DEPTH_DECAY:        [1.0, 0.7, 0.4],   // depth 0/1/2

  // Relation source 置信度
  SOURCE_CONFIDENCE: {
    manual: 1.0,
    rule:   0.85,
    ai_suggested: 0.55,
    migrated_inference: 0.40,
  },

  // 阶段阈值
  LEARNING_MIN_E2:                2,
  WORKING_MIN_E4:                 1,
  PROFICIENT_MIN_E4:              2,
  INTEGRATED_MIN_CONTEXT:         2,
};
```

---

## 5. Corrected Cases A-D

### Case A — Context 是候选空间，不强制全量继承

**Setup**

| 记录 | 标题 | context | nature |
|------|------|---------|--------|
| Project | "电商系统" | [Backend, Performance, Scaling] | Knowledge |
| Task | "写 Redis 缓存文档" | Backend | Knowledge |

- `inferStage('写 Redis 缓存文档')` 标题不含 Performance/Scaling → 匹配 `E2` 关键词 → stage=`E2`，nature=`Knowledge`
- Task 自身 link: Performance = `contextual`，relevance=0.30，confidence=0.90（ai_suggested）
- Project 继承 link: Performance = `contextual`，relevance=0.60，confidence=0.85（rule），`inherited_from=project`

**链路**

1. Task 标题不含 Performance → Task 自身 relevance=0.30（content_support 低，prior_strength 也低）
2. Project 继承 link（depth=1）：relevance=0.60
3. 两条 link 在 canonical Topic Link 合并 → `provenance[]` 两条，`effective = max(0.30×0.90, 0.60×0.85) = max(0.27, 0.51) = 0.51`
4. Evidence Builder 生成 event：`stage='E2'`, `nature='Knowledge'`, `effective=0.51`

**预期输出**

```yaml
Performance:
  familiarity: Learning
  evidence_count: 1
  stability: low
  notes: 'Context 是 Prior Pool；Task 标题不等于强制继承 — title 弱链接靠 Project 上下文托起'
```

✅ 验证：Context 是候选空间（标题没命中仍能产生链接），但 evidence 仅 1 条 stability=low。

---

### Case B — Admin 不污染 + 1 条 E2 不到 Learning

**Setup**

| 记录 | 标题 | nature |
|------|------|--------|
| Task | "整理 Performance 笔记归档" | `Admin`（用户手动标记） |
| Task | "读 Performance 入门书" | `Knowledge`（自动推断） |

- Task 1: nature=`Admin` → Evidence Builder 写 event 但**不进 Familiarity**
- Task 2: `inferStage('读 Performance 入门书')` → 匹配 `E1`（读）→ stage=`E1`（注：不是 E2，关键词匹配优先级 E1 > E2）

**链路**

1. Task 1 event: `nature='Admin'`，在 `familiarEvents()` 被过滤
2. Task 2 event: `stage='E1'`, `effective=0.45`，**仅 1 条 E1**

**预期输出**

```yaml
Performance:
  familiarity: Exposure                  # E1>=1
  evidence_count: 1
  stability: low
  admin_evidence_suppressed: 1           # 透明记录，不静默吞
```

✅ 验证：
- Admin event 进库但**不污染 Familiarity**
- 若仅 1 条 E2（不是 E1），仍 `Learning evidence observed: 1`（**不直接返回 Learning** — 因 LEARNING_MIN_E2=2）

**额外边界**

| 输入 | Familiarity | 说明 |
|------|-------------|------|
| 0 evidence | **Unrated** | blocker #3 已修 |
| 1 条 E1 | Exposure | stability=low |
| 1 条 E2 | **`Learning evidence observed: 1`** | 未升档，透明展示 |
| 2 条 E2 | Learning | 满足阈值 |

---

### Case C — 1 高置信度 E4 → Working + stability=low

**Setup**

| 记录 | 标题 | nature |
|------|------|--------|
| Task | "实现 Redis LRU 缓存" | `Practice` |

- `inferStage('实现 Redis LRU 缓存')` → 匹配 `E4`（做/实现）→ stage=`E4`
- relevance=0.80，confidence=0.95 → effective=0.76

**预期输出**

```yaml
Redis:
  familiarity: Working
  evidence_count: 1
  stability: low            # 单条 E4 触发 stability=low 分支
  depth: E4                 # Depth Frontier = E4
```

✅ 验证：单条高置信度 E4 → Working 但 stability=low，与 3.3 代码分支一致。

---

### Case D — 跨 Context Reuse 必须 lineage 证明

**Setup**

| 记录 | 标题 | context | nature | inferStage |
|------|------|---------|--------|-----------|
| Task A1 | "读 Redis 文档" | Backend | Knowledge | `E1` |
| Task A2 | "用 Redis 做缓存" | Backend | Practice | `E4` |
| Task A3 | "把 Redis 用到新项目" | Scaling | Practice | **ReuseCandidate**（文本命中"用"+"新项目"，但有"复用"含义词） |
| Task B | "学 Memcached" | Backend | Knowledge | `E2` |

- Task A3 relevance=0.38（用户手动 relevance=0.40，系统四舍五入为 0.38？— 实际手动可设 0.38）
  - 注：effective = 0.38 × 0.95 = **0.361 < 0.40**（FAMILIARITY_EVIDENCE_THRESHOLD）

**链路**

1. A3 event 写入：`stage='ReuseCandidate'`, `effective=0.361`
2. `promoteReuse(A3)` 检查跨 context lineage：
   - 同 topic 不同 context_key 且 stage ∈ {E3,E4,E5} 的 event → A1/A2 都在 Backend context，**无 Scaling context 的 E3/E4/E5 lineage**
   - **降级为 Unknown**，stage 改为 `Unknown`，不升级为 E6
3. Co-topic Redis × Memcached：
   - 共现 record：A1(Redis)、A2(Redis)、B(Memcached) → distinct record pair：{A1-B, A2-B}
   - **raw_support_count = 2**（A3 已被降级 Unknown，不参与共现统计）
   - maxEffectiveWeight：0.45（来自 A1/Memcached）
   - Gate: `0.45 >= 0.20 AND 2 >= 3` → **第二条件不满足 → 不入 candidate**

**预期输出**

```yaml
Redis:
  familiarity: Working                  # 仅 A2 一条 E4 + A1 一条 E1，但 E1 不升级 Learning
  evidence_count: 2                     # A1+E1 + A2+E4 都 >= .40
  stability: medium
  depth: E4
  reuse_pending: 1                       # 透明：1 个 ReuseCandidate 待人工确认

CoTopic Redis-Memcached:
  raw_support_count: 2
  weighted_support: 0.87
  candidate: false                      # < 3
  reason: 'min_count not met'
```

✅ 验证：
- A3 因 effective < .40 不进 Familiarity（blocker #5 数据职责）
- E6 降级 Unknown（blocker #4 文本不能直接升 E6）
- Co-topic 双指标分离，gate 不被 weighted_support 顶替

---

## 6. Phase 1 验收条件（增补 — blocker #9）

除 Case A-D 外必须验证：

| # | 验收项 | 期望 |
|---|--------|------|
| 1 | Repeated migration → no duplicate links/events | `(record_id, topic_id, link_type)` 唯一索引，重复触发只 update 不 insert；`(source_link_id, date)` 唯一约束 |
| 2 | Rejected link → no analytics contribution | `review_status='rejected'` 在 Evidence Builder 跳过，不生成 event |
| 3 | Admin → no knowledge evidence | `nature='Admin'` 在 Familiarity & Knowledge Depth 全过滤 |
| 4 | Unknown → no knowledge evidence | `nature='Unknown'` 同 Admin |
| 5 | effective < .40 → no Familiarity evidence | `familiarEvents()` filter |
| 6 | Modifying relevance/confidence → events/analytics rebuild | `EventStore.rebuildFromLinks(link_id)` 触发后 analytics 重算（不是 lazy） |
| 7 | Schema version gate | 启动校验 `TOPIC_ANALYTICS_SCHEMA_VERSION`，不匹配 → 提示迁移 |
| 8 | Test isolation | 测试数据走 `dc_lifestation_test_*` 命名空间 + `TOPIC_TEST_MODE = true`，UI 红色 TEST MODE 边框 |

### 测试 fixture 命名规范

```
数据表前缀：dc_lifestation_test_
Topic 命名：[TEST] Redis / [TEST] Memcached / [TEST] Performance
记录标题前缀：[TEST]
TOPIC_TEST_MODE = true → UI 红边 + "TEST DATA" 标签
```

---

## 7. Phase 1 实施范围（已锁定，不扩展）

```
1. Schema 字段落地（topic_links, topic_events, business tables）
2. TOPIC_ANALYTICS_CONFIG 单一来源
3. Evidence Builder 函数（写时落库）
4. inferStage()（仅 E1-E5 + ReuseCandidate）
5. inferNature()（Knowledge / Practice / Admin / Unknown）
6. promoteReuse()（ReuseCandidate → E6 升级）
7. calculateFamiliarity()（重写为只读 events）
8. computeCoTopic()（修 bug）
9. mergeProvenance()（修正 merge 公式）
10. computeLinkRelevance()（统一 Context Prior 公式）
11. EventStore.rebuildFromLinks()（修改 link 时触发）
12. Backfill 函数（已有 records → 推 link/event）
13. 测试 namespace + TEST MODE 标志 + 4 Case 自动化 fixture
```

**Phase 2（UI：chips / picker / confirm / Familiarity 展示）不实施**，等用户验收 Phase 1 完整链路后再做。

---

## 8. 与上一版的关键差异（仅 Diff，不重写）

| 模块 | 上一版问题 | 本版修正 |
|------|-----------|----------|
| `link_type` | 含 `inherited` 与 `inherited_from_*` 冲突 | 删 `inherited`，继承仅走 `inherited_from_*` |
| `db_topic_events` | 写入但不消费 | Familiarity 只读 events；不再现场 inferStage() |
| 0 evidence | 返回 Exposure | **Unrated** |
| E6 推断 | 文本关键词直接产出 | 仅 `ReuseCandidate`；E6 必须 `promoteReuse` 升级 |
| Co-topic gate | `weighted_support >= 3` | `maxEffectiveWeight >= .20 AND raw_support_count >= 3` |
| Provenance merge | `max(rel) × max(conf)` | 每条 provenance 独立算 effective，取 max；link_type 优先级 direct > contextual |
| Context Prior | 两套并行公式（inferLinksForRecord + computeInheritanceRelevance） | 统一为 `prior_strength × content_support → relevance`，参数全部入 `TOPIC_ANALYTICS_CONFIG` |
| Case A | 默认继承 | 标题弱链接靠 Project 上下文托起，stability=low |
| Case B | 1 条 E2 直接 Learning | `Learning evidence observed: 1` 透明展示，未升档 |
| Case D | A3 标题词 → E6 → Familiarity | effective=.38 < .40 不入 Familiarity；无 cross-context lineage 降级 Unknown |
| Test namespace | 缺 | `dc_lifestation_test_*` + `TOPIC_TEST_MODE` + UI 红边 |
| Schema version | 复用 SCHEMA_VERSION | `TOPIC_ANALYTICS_SCHEMA_VERSION = 1` 独立 |

---

## 9. Phase 1 完成后的展示物

实施完成后给用户呈现：

```
1. 4 个 Case 的完整事件链截图（A/B/C/D 各自 events 表 + Familiarity 输出）
2. 8 项验收的测试报告（表 + 通过/失败）
3. rebuild 链路演示（修改 relevance → events 重建 → analytics 变化）
4. 测试数据清理（提供一键清空 dc_lifestation_test_*）
```

**收到"OK 开干"后启动 Phase 1。**