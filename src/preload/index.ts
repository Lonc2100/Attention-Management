import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AfkNote,
  type ActivityRuleMutationInput,
  type MoveActivityRuleInput,
  type PlanInput,
  type ProjectAliasInput,
  type RemoveActivityCorrectionInput,
  type ReviewInput,
  type Settings,
  type SaveActivityCorrectionInput,
  type TimeEfficiencyApi
} from '../shared/contracts'

const api: TimeEfficiencyApi = {
  bootstrap: () => ipcRenderer.invoke(IPC.bootstrap),
  refreshActivity: (date) => ipcRenderer.invoke(IPC.refreshActivity, date),
  savePlan: (input: PlanInput) => ipcRenderer.invoke(IPC.savePlan, input),
  saveReview: (input: ReviewInput) => ipcRenderer.invoke(IPC.saveReview, input),
  saveAfkNote: (input: AfkNote) => ipcRenderer.invoke(IPC.saveAfkNote, input),
  updateSettings: (patch: Partial<Settings>) => ipcRenderer.invoke(IPC.updateSettings, patch),
  setTracking: (enabled: boolean) => ipcRenderer.invoke(IPC.setTracking, enabled),
  runAiReview: () => ipcRenderer.invoke(IPC.runAiReview),
  getDiagnostics: () => ipcRenderer.invoke(IPC.getDiagnostics),
  setProjectAlias: (input: ProjectAliasInput) => ipcRenderer.invoke(IPC.setProjectAlias, input),
  getActivityDetails: (date: string) => ipcRenderer.invoke(IPC.getActivityDetails, date),
  saveActivityCorrection: (input: SaveActivityCorrectionInput) => ipcRenderer.invoke(IPC.saveActivityCorrection, input),
  removeActivityCorrection: (input: RemoveActivityCorrectionInput) => ipcRenderer.invoke(IPC.removeActivityCorrection, input),
  setActivityRuleEnabled: (input: ActivityRuleMutationInput & { enabled: boolean }) => ipcRenderer.invoke(IPC.setActivityRuleEnabled, input),
  moveActivityRule: (input: MoveActivityRuleInput) => ipcRenderer.invoke(IPC.moveActivityRule, input),
  removeActivityRule: (input: ActivityRuleMutationInput) => ipcRenderer.invoke(IPC.removeActivityRule, input),
  showWindow: () => ipcRenderer.invoke(IPC.showWindow),
  showWidget: () => ipcRenderer.invoke(IPC.showWidget),
  hideWidget: () => ipcRenderer.invoke(IPC.hideWidget),
  setWidgetExpanded: (expanded: boolean) => ipcRenderer.invoke(IPC.setWidgetExpanded, expanded)
}

contextBridge.exposeInMainWorld('timeEfficiency', api)
