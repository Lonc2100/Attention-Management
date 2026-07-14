import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AfkNote, type PlanInput, type ReviewInput, type Settings, type TimeEfficiencyApi } from '../shared/contracts'

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
  showWindow: () => ipcRenderer.invoke(IPC.showWindow)
}

contextBridge.exposeInMainWorld('timeEfficiency', api)
