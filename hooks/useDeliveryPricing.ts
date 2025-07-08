import { useMemo } from 'react';

interface UseDeliveryPricingProps {
  distanceKm: number;
  basePrice: number;
  tip?: number;
  additionalCompensation?: number;
}

export const useDeliveryPricing = ({
  distanceKm,
  basePrice,
  tip = 0,
  additionalCompensation = 0,
}: UseDeliveryPricingProps) => {
  
  const estimateDuration = (distanceInKm: number): number => {
    if (distanceInKm <= 7) {
      return (distanceInKm / 30) * 60; // urban center
    } else if (distanceInKm <= 15) {
      return (distanceInKm / 35) * 60; // city edge or nearby
    } else {
      return (distanceInKm / 40) * 60; // inter-city
    }
  };

  const estimateFare = (distanceInKm: number, basePrice: number): number => {
    let perKmRate = 0;

    if (distanceInKm <= 2) {
      perKmRate = 10.5; // ₱31 for 1.9km → ₱10 base + ₱21
    } else if (distanceInKm <= 6) {
      perKmRate = 11; // ₱60 for 4.3km
    } else if (distanceInKm <= 10) {
      perKmRate = 12.5; // ₱113 for 8.1km, ₱147 for 10.5km
    } else {
      perKmRate = 13.5; // ₱295 for 21.6km
    }

    const fare = basePrice + distanceInKm * perKmRate;
    return Math.round(fare); // Round to nearest peso
  };

  const pricingData = useMemo(() => {
    const COMMISSION_RATE = 0.15; // 15% commission

    const partialPrice = estimateFare(distanceKm, basePrice);
    const totalPrice = partialPrice + tip + additionalCompensation;
    const durationMins = estimateDuration(distanceKm);
    const commissionAmount = partialPrice * COMMISSION_RATE;
    const driverEarnings = totalPrice - commissionAmount;
    const formattedPrice = `₱${totalPrice.toFixed(2)}`;

    return {
      partialPrice,
      totalPrice,
      durationMins,
      commissionAmount,
      driverEarnings,
      formattedPrice,
    };
  }, [distanceKm, basePrice, tip, additionalCompensation]);

  return pricingData;
};
