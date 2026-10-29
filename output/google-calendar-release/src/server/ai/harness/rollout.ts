export class HarnessFeatureFlag {
  private readonly ownerIds: ReadonlySet<string>

  constructor(private readonly globallyEnabled: boolean, enabledOwnerIds: readonly string[]) {
    this.ownerIds = new Set(enabledOwnerIds)
  }

  isEnabled(ownerId: string): boolean {
    return this.globallyEnabled && this.ownerIds.has(ownerId)
  }
}

export type HarnessConcurrencyLimits = { perOwner: number; perProvider: number }
export type HarnessLease = { release(): void }

export class HarnessConcurrencyLimiter {
  private readonly ownerCounts = new Map<string, number>()
  private readonly providerCounts = new Map<string, number>()

  constructor(private readonly limits: HarnessConcurrencyLimits) {
    assertPositive(limits.perOwner, 'perOwner')
    assertPositive(limits.perProvider, 'perProvider')
  }

  tryAcquire(ownerId: string, provider: string): HarnessLease | null {
    const ownerCount = this.ownerCounts.get(ownerId) ?? 0
    const providerCount = this.providerCounts.get(provider) ?? 0
    if (ownerCount >= this.limits.perOwner || providerCount >= this.limits.perProvider) return null
    this.ownerCounts.set(ownerId, ownerCount + 1)
    this.providerCounts.set(provider, providerCount + 1)
    let released = false
    return {
      release: () => {
        if (released) return
        released = true
        decrement(this.ownerCounts, ownerId)
        decrement(this.providerCounts, provider)
      },
    }
  }
}

export type HarnessCallMetric = {
  step: 'TRANSCRIBING' | 'ORGANIZING' | 'RETRIEVING_REFERENCES' | 'MATERIALIZING' | 'EXECUTING'
  provider: string
  model: string
  result: 'SUCCESS' | 'ERROR' | 'STALE_RESULT' | 'INPUT_TOO_LARGE'
  inputTokens: number
  outputTokens: number
  latencyMs: number
  estimatedCost: number
}

export interface HarnessMetrics {
  recordCall(metric: HarnessCallMetric): void
}

export class InMemoryHarnessMetrics implements HarnessMetrics {
  private readonly values: HarnessCallMetric[] = []

  recordCall(metric: HarnessCallMetric): void {
    validateMetric(metric)
    this.values.push({ ...metric })
  }

  snapshot(): HarnessCallMetric[] {
    return this.values.map((value) => ({ ...value }))
  }
}

function validateMetric(metric: HarnessCallMetric) {
  if (!/^[a-zA-Z0-9._-]{1,80}$/u.test(metric.provider)) throw new Error('Provider inválido para métrica.')
  if (!/^[a-zA-Z0-9._-]{1,120}$/u.test(metric.model)) throw new Error('Modelo inválido para métrica.')
  for (const [name, value] of Object.entries({
    inputTokens: metric.inputTokens,
    outputTokens: metric.outputTokens,
    latencyMs: metric.latencyMs,
    estimatedCost: metric.estimatedCost,
  })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Métrica ${name} inválida.`)
  }
}

function decrement(map: Map<string, number>, key: string) {
  const next = (map.get(key) ?? 1) - 1
  if (next === 0) map.delete(key)
  else map.set(key, next)
}

function assertPositive(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Limite ${name} inválido.`)
}
