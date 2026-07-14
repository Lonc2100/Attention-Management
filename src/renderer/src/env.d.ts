import type { TimeEfficiencyApi } from '../../shared/contracts'

declare global {
  interface Window {
    timeEfficiency: TimeEfficiencyApi
  }
}

export {}
