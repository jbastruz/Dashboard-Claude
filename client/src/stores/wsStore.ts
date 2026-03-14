import { create } from "zustand";
import type { WsClient, WsStatus } from "../api/ws";

interface WsState {
  status: WsStatus;
  wsClient: WsClient | null;
  setStatus: (status: WsStatus) => void;
  setWsClient: (client: WsClient | null) => void;
}

export const useWsStore = create<WsState>((set) => ({
  status: "disconnected",
  wsClient: null,
  setStatus: (status) => set({ status }),
  setWsClient: (client) => set({ wsClient: client }),
}));
