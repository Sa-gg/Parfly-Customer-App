import { create } from 'zustand';

interface DeliveryData {
  sender_id: number | null;
  receiver_id: number | null;
  driver_id: number | null;

  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number | null;
  pickup_long: number | null;
  dropoff_lat: number | null;
  dropoff_long: number | null;

  parcel_amount: number;
  payer: 'sender' | 'receiver' | null;
  add_info: string;
  status: string;

  receiver_name: string;
  receiver_contact: string;

  delivery_fee: number;
  commission_amount: number;
  driver_earnings: number;
  commission_deducted: boolean;
  additional_compensation: number;
  tip: number;

  distance_km: number;         // <-- added
  duration_minutes: number;    // <-- added

  accepted_at?: string | null;
  received_at?: string | null;
}

interface DeliveryStore {
  deliveryData: DeliveryData;
  setDeliveryField: <K extends keyof DeliveryData>(field: K, value: DeliveryData[K]) => void;
  resetDeliveryData: () => void;
}

const defaultData: DeliveryData = {
  sender_id: null,
  receiver_id: null,
  driver_id: null,

  pickup_address: '',
  dropoff_address: '',
  pickup_lat: null,
  pickup_long: null,
  dropoff_lat: null,
  dropoff_long: null,

  parcel_amount: 0,
  payer: null,
  add_info: '',
  status: 'pending',

  receiver_name: '',
  receiver_contact: '',

  delivery_fee: 0,
  commission_amount: 0,
  driver_earnings: 0,
  commission_deducted: false,
  additional_compensation: 0,
  tip: 0,

  distance_km: 0,            // <-- added default
  duration_minutes: 0,       // <-- added default

  accepted_at: null,
  received_at: null,
};

export const useDeliveryStore = create<DeliveryStore>((set) => ({
  deliveryData: { ...defaultData },

  setDeliveryField: (field, value) =>
    set((state) => ({
      deliveryData: {
        ...state.deliveryData,
        [field]: value,
      },
    })),

  resetDeliveryData: () =>
    set((state) => ({
      deliveryData: {
        ...defaultData,
        sender_id: state.deliveryData.sender_id, // preserve sender_id
      },
    })),

}));
