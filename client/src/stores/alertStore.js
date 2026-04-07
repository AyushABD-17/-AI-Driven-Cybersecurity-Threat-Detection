import { create } from 'zustand';

const useAlertStore = create((set, get) => ({
  alerts: [],           // Live feed queue
  maxAlerts: 100,       // Max elements to keep in feed
  stats: {
    alertsToday: 0,
    criticalOpen: 0,
    resolved: 0,
    attackBreakdown: [],
  },
  isConnected: false,

  // Socket actions
  setConnectionStatus: (status) => set({ isConnected: status }),
  
  addAlert: (alert) => set((state) => {
    const newAlerts = [alert, ...state.alerts].slice(0, state.maxAlerts);
    return { alerts: newAlerts };
  }),

  updateStats: (newStats) => set((state) => ({
    stats: { ...state.stats, ...newStats }
  })),
  
  clearAlerts: () => set({ alerts: [] }),
}));

export default useAlertStore;
