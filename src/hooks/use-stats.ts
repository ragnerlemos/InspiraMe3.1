import { useEffect, useState } from 'react';
import { getAnalytics, logEvent, type Analytics } from 'firebase/analytics';
import { getApps } from 'firebase/app';

let analyticsInstance: Analytics | null = null;

const getAnalyticsSafe = (): Analytics | null => {
  if (typeof window === 'undefined') return null;
  if (!analyticsInstance && getApps().length > 0) {
    try {
      analyticsInstance = getAnalytics();
    } catch (e) {
      console.warn("Analytics initialization skipped or failed to load:", e);
    }
  }
  return analyticsInstance;
};

const useStats = () => {
    const [shares, setShares] = useState(0);
    const [favorites, setFavorites] = useState(0);
    const [creationCount, setCreationCount] = useState(0);

    useEffect(() => {
        // Assuming fetching initial stats from Firebase
        const fetchStats = async () => {
            // Fetch logic here
        };
        fetchStats();
    }, []);

    const trackShare = () => {
        setShares((prev) => prev + 1);
        const a = getAnalyticsSafe();
        if (a) {
            try {
                logEvent(a, 'share');
            } catch (e) {
                console.warn("Falha ao registrar evento 'share':", e);
            }
        }
    };

    const trackFavorite = () => {
        setFavorites((prev) => prev + 1);
        const a = getAnalyticsSafe();
        if (a) {
            try {
                logEvent(a, 'favorite');
            } catch (e) {
                console.warn("Falha ao registrar evento 'favorite':", e);
            }
        }
    };

    const trackCreation = () => {
        setCreationCount((prev) => prev + 1);
        const a = getAnalyticsSafe();
        if (a) {
            try {
                logEvent(a, 'create');
            } catch (e) {
                console.warn("Falha ao registrar evento 'create':", e);
            }
        }
    };

    return { shares, favorites, creationCount, trackShare, trackFavorite, trackCreation };
};

export default useStats;