
import React, { useState, useEffect } from 'react';

interface DiceProps {
  onRollComplete: (value: number) => void;
  rolling: boolean;
}

const Dice: React.FC<DiceProps> = ({ onRollComplete, rolling }) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [value, setValue] = useState(1);

  useEffect(() => {
    if (rolling) {
      const interval = setInterval(() => {
        setRotation({
          x: Math.random() * 360,
          y: Math.random() * 360
        });
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        const newValue = Math.floor(Math.random() * 6) + 1;
        setValue(newValue);
        applyRotation(newValue);
        onRollComplete(newValue);
      }, 1500);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [rolling]);

  const applyRotation = (val: number) => {
    const rots: Record<number, { x: number, y: number }> = {
      1: { x: 0, y: 0 },
      2: { x: 0, y: 180 },
      3: { x: 0, y: -90 },
      4: { x: 0, y: 90 },
      5: { x: -90, y: 0 },
      6: { x: 90, y: 0 }
    };
    setRotation(rots[val]);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="perspective-1000 w-24 h-24 mb-4">
        <div 
          className="relative w-full h-full transition-transform duration-500 ease-out preserve-3d"
          style={{ 
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Dice Faces */}
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <div
              key={face}
              className={`absolute w-24 h-24 bg-white border-2 border-gray-300 rounded-xl flex items-center justify-center text-3xl font-bold shadow-inner backface-hidden`}
              style={{
                transform: face === 1 ? 'translateZ(48px)' :
                           face === 2 ? 'rotateY(180deg) translateZ(48px)' :
                           face === 3 ? 'rotateY(90deg) translateZ(48px)' :
                           face === 4 ? 'rotateY(-90deg) translateZ(48px)' :
                           face === 5 ? 'rotateX(90deg) translateZ(48px)' :
                                       'rotateX(-90deg) translateZ(48px)'
              }}
            >
              {renderDots(face)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function renderDots(val: number) {
  const dotPositions: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  return (
    <div className="grid grid-cols-3 gap-1 w-16 h-16 p-2">
      {[...Array(9)].map((_, i) => (
        <div key={i} className={`rounded-full ${dotPositions[val].includes(i) ? 'bg-indigo-600' : 'bg-transparent'} w-3 h-3`}></div>
      ))}
    </div>
  );
}

export default Dice;
