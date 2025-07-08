import { useEffect, useRef, useState } from 'react';

interface RouteInfo {
  km: number;
  mins: number;
  trafficmins: number;
}

interface UseRouteCalculationProps {
  pickupLat?: number;
  pickupLon?: number;
  dropoffLat?: number;
  dropoffLon?: number;
}

export const useRouteCalculation = ({
  pickupLat,
  pickupLon,
  dropoffLat,
  dropoffLon,
}: UseRouteCalculationProps) => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const fetchedOnceRef = useRef(false);

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  const fetchRouteDistance = async (
    pickupLat: number,
    pickupLon: number,
    dropoffLat: number,
    dropoffLon: number
  ) => {
    try {
      const res = await fetch(
        `${API_URL}/api/route-distance?pickup_lat=${pickupLat}&pickup_lon=${pickupLon}&dropoff_lat=${dropoffLat}&dropoff_lon=${dropoffLon}`
      );

      const text = await res.text();

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}, message: ${text}`);

      const data = JSON.parse(text);
     
      return {
        km: data.distanceInKm,
        mins: data.durationInMinutes,
        trafficmins: data.trafficDelayInMinutes,
      };
    } catch (err) {
      console.error('Route calculation error:', err);
      return null;
    }
  };

  useEffect(() => {
    if (fetchedOnceRef.current) return;

    if (
      pickupLat === undefined ||
      pickupLon === undefined ||
      dropoffLat === undefined ||
      dropoffLon === undefined
    ) return;

    const handler = setTimeout(() => {
      setLoadingPrice(true);
      fetchRouteDistance(pickupLat, pickupLon, dropoffLat, dropoffLon)
        .then((result) => {
          setRouteInfo(result);
          fetchedOnceRef.current = true;
        })
        .finally(() => setLoadingPrice(false));
    }, 500);

    return () => clearTimeout(handler);
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon]);

  const resetRoute = () => {
    fetchedOnceRef.current = false;
    setRouteInfo(null);
  };

  return {
    routeInfo,
    loadingPrice,
    resetRoute,
  };
};
