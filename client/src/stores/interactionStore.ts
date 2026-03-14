import { create } from "zustand";
import type { Interaction } from "../types/models";

interface InteractionState {
  interactions: Interaction[];
  addInteraction: (interaction: Interaction) => void;
  setAll: (interactions: Interaction[]) => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  interactions: [],

  addInteraction: (interaction) =>
    set((state) => {
      if (state.interactions.some((i) => i.id === interaction.id)) {
        return state;
      }
      return { interactions: [...state.interactions, interaction] };
    }),

  setAll: (interactions) => set({ interactions }),
}));
