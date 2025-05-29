// store/useLocationStore.ts
import { create } from 'zustand';

interface Location {
  address: string;
  lat: number;
  lon: number;
}

interface LocationState {
  pickup: Location | null;
  dropoff: Location | null;
  setPickup: (data: Partial<Location>) => void;
  setDropoff: (data: Partial<Location>) => void;
  clearLocations: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  pickup: null,
  dropoff: null,

  // Update only changed fields for pickup
  setPickup: (data) =>
    set((state) => ({
      pickup: state.pickup
        ? { ...state.pickup, ...data }
        : { address: '', lat: 0, lon: 0, ...data },
    })),

  // Update only changed fields for dropoff
  setDropoff: (data) =>
    set((state) => ({
      dropoff: state.dropoff
        ? { ...state.dropoff, ...data }
        : { address: '', lat: 0, lon: 0, ...data },
    })),

  clearLocations: () => set({ pickup: null, dropoff: null }),
}));
