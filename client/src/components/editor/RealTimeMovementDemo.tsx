import React from 'react';
import { useRealTimeMovement } from '../../hooks/editor/useRealTimeMovement';

interface RealTimeMovementDemoProps {
  sessionId: string;
  userId: string;
}

const RealTimeMovementDemo: React.FC<RealTimeMovementDemoProps> = ({ sessionId, userId }) => {
  const { movements, addMovement, removeMovement, clearAllMovements } = useRealTimeMovement();

  const handleAddMovement = (tagId: string) => {
    addMovement(tagId, {
      userId: 'other-user-123',
      displayName: 'John Doe',
      userType: 'signer',
      timestamp: Date.now()
    });
  };

  const handleRemoveMovement = (tagId: string) => {
    removeMovement(tagId);
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Real-Time Movement Demo</h3>
      
      <div className="space-y-2 mb-4">
        <button
          onClick={() => handleAddMovement('tag-1')}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Simulate Tag 1 Movement
        </button>
        <button
          onClick={() => handleAddMovement('tag-2')}
          className="px-3 py-1 bg-green-500 text-white rounded text-sm"
        >
          Simulate Tag 2 Movement
        </button>
        <button
          onClick={clearAllMovements}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm"
        >
          Clear All Movements
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Active Movements:</h4>
        {Object.entries(movements).length === 0 ? (
          <p className="text-gray-500 text-sm">No active movements</p>
        ) : (
          Object.entries(movements).map(([tagId, movement]) => (
            <div key={tagId} className="flex items-center justify-between p-2 bg-white rounded border">
              <div>
                <span className="font-medium">{tagId}</span>
                <span className="text-gray-500 ml-2">
                  by {movement.displayName} ({movement.userType})
                </span>
              </div>
              <button
                onClick={() => handleRemoveMovement(tagId)}
                className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RealTimeMovementDemo;
