"use client";

import { useState, useEffect, useCallback } from "react";

const LIKED_IDS_KEY = "quotevid_liked_ids";
const LIKE_COUNTS_KEY = "quotevid_like_counts";

export const useLikes = () => {
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({});

  // Load from localStorage on client-side mount
  useEffect(() => {
    try {
      const storedLiked = localStorage.getItem(LIKED_IDS_KEY);
      if (storedLiked) {
        setLikedIds(JSON.parse(storedLiked));
      }
      const storedCounts = localStorage.getItem(LIKE_COUNTS_KEY);
      if (storedCounts) {
        setCustomCounts(JSON.parse(storedCounts));
      }
    } catch (error) {
      console.error("Failed to parse likes from localStorage", error);
    }
  }, []);

  // Toggle the liked state and adjust counts
  const toggleLike = useCallback((id: string) => {
    setLikedIds((prevLiked) => {
      const isCurrentlyLiked = prevLiked.includes(id);
      let newLiked;
      if (isCurrentlyLiked) {
        newLiked = prevLiked.filter((likedId) => likedId !== id);
      } else {
        newLiked = [...prevLiked, id];
      }
      
      try {
        localStorage.setItem(LIKED_IDS_KEY, JSON.stringify(newLiked));
      } catch (error) {
        console.error("Failed to save liked IDs to localStorage", error);
      }

      setCustomCounts((prevCounts) => {
        const currentCount = prevCounts[id] || 0;
        // Increment if we just liked, decrement if we just unliked
        const newCount = isCurrentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
        const newCounts = { ...prevCounts, [id]: newCount };
        
        try {
          localStorage.setItem(LIKE_COUNTS_KEY, JSON.stringify(newCounts));
        } catch (error) {
          console.error("Failed to save like counts to localStorage", error);
        }
        return newCounts;
      });

      return newLiked;
    });
  }, []);

  return { likedIds, customCounts, toggleLike };
};
