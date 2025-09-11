import { useState, useCallback, useRef, useEffect } from 'react';

interface MovementInfo {
  userId: string;
  displayName: string;
  userType: string;
  timestamp: number;
}

interface TagMovementState {
  [tagId: string]: MovementInfo;
}

export const useRealTimeMovement = () => {
  const [movements, setMovements] = useState<TagMovementState>({});
  const timeoutsRef = useRef<{ [tagId: string]: NodeJS.Timeout }>({});

  // Add movement info for a tag
  const addMovement = useCallback((tagId: string, movementInfo: MovementInfo) => {
    setMovements(prev => ({
      ...prev,
      [tagId]: movementInfo
    }));

    // Clear any existing timeout for this tag
    if (timeoutsRef.current[tagId]) {
      clearTimeout(timeoutsRef.current[tagId]);
    }

    // Set a timeout to remove the movement info after 2 seconds of inactivity
    timeoutsRef.current[tagId] = setTimeout(() => {
      setMovements(prev => {
        const newMovements = { ...prev };
        delete newMovements[tagId];
        return newMovements;
      });
      delete timeoutsRef.current[tagId];
    }, 2000);
  }, []);

  // Remove movement info for a tag
  const removeMovement = useCallback((tagId: string) => {
    setMovements(prev => {
      const newMovements = { ...prev };
      delete newMovements[tagId];
      return newMovements;
    });

    if (timeoutsRef.current[tagId]) {
      clearTimeout(timeoutsRef.current[tagId]);
      delete timeoutsRef.current[tagId];
    }
  }, []);

  // Get movement info for a specific tag
  const getMovementInfo = useCallback((tagId: string): MovementInfo | null => {
    return movements[tagId] || null;
  }, [movements]);

  // Clear all movements
  const clearAllMovements = useCallback(() => {
    Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = {};
    setMovements({});
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    movements,
    addMovement,
    removeMovement,
    getMovementInfo,
    clearAllMovements
  };
};
