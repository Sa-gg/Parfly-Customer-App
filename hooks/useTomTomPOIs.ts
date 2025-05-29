import axios from "axios";
import { useEffect, useState } from "react";

const POI_URL = "https://api.tomtom.com/search/2/poiSearch.json";

const useTomTomPOIs = (lat: number, lon: number) => {
  const [pois, setPois] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPOIs = async () => {
      try {
        const res = await axios.get(POI_URL, {
          params: {
            lat,
            lon,
            radius: 3000,
            key: "dez2PMpbKSfAc0yID1XuM5EIQGmWN4kk", // Make sure to store this key securely in production
          },
        });
        setPois(res.data.results);
      } catch (error) {
        console.error("Error fetching POIs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPOIs();
  }, [lat, lon]);

  return { pois, loading };
};

export default useTomTomPOIs;
