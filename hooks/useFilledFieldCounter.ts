import { useEffect, useState } from 'react';

interface DeliveryData {
  add_info?: string;
  receiver_name?: string;
  receiver_contact?: string;
  additional_compensation?: number;
  tip?: number;
  parcel_amount?: number;
}

export const useFilledFieldCounter = (deliveryData?: DeliveryData) => {
  const [filledFieldCount, setFilledFieldCount] = useState(0);

  useEffect(() => {
    if (!deliveryData) {
      setFilledFieldCount(0);
      return;
    }

    const {
      add_info,
      receiver_name,
      receiver_contact,
      additional_compensation,
      tip,
      parcel_amount
    } = deliveryData;

    const fieldsToCheck = [
      add_info,
      receiver_name,
      receiver_contact,
      additional_compensation,
      tip,
      parcel_amount
    ];

    const count = fieldsToCheck.reduce((acc: number, field) => {
      if (typeof field === 'string') {
        return acc + (field.trim() !== '' ? 1 : 0);
      } else if (typeof field === 'number') {
        return acc + (field > 0 ? 1 : 0);
      }
      return acc;
    }, 0);

    setFilledFieldCount(count);
  }, [deliveryData]);

  return filledFieldCount;
};
