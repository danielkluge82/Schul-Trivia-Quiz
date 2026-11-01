
import React, { useMemo } from 'react';
import { Category, Player } from '../types';

interface BoardProps {
  players: Player[];
  currentPlayerIndex: number;
  possibleMoves: number[];
  onMoveSelect: (fieldIndex: number) => void;
}

const CATEGORIES = Object.values(Category);

export const categoryColors: Record<string, string> = {
  [Category.DEUTSCH]: '#3B82F6', // Blau
  [Category.MATHEMATIK]: '#EF4444', // Rot (Mathe & Physik)
  [Category.SACHUNTERRICHT]: '#10B981', // Grün
  [Category.ENGLISCH]: '#FFD700', // Gold/Gelb
  [Category.KUNST_MUSIK]: '#8B5CF6', // Lila
  [Category.SPORT]: '#F97316', // Orange
  [Category.WERKEN]: '#EC4899', // Pink
  [Category.ETHIK]: '#6B7280', // Grau
};

export const generateBoard = () => {
  const fields: any[] = [];
  const adj: number[][] = Array.from({ length: 73 }, () => []);
  const center = { x: 350, y: 350 };
  const rimRadius = 310;
  
  // 1. Außenring (40 Felder, 0-39)
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * 2 * Math.PI - Math.PI / 2;
    fields.push({
      id: i,
      x: center.x + rimRadius * Math.cos(angle),
      y: center.y + rimRadius * Math.sin(angle),
      category: CATEGORIES[i % 8],
      isWedge: i % 5 === 0,
      type: 'rim'
    });
    adj[i].push((i + 1) % 40);
    adj[i].push((i - 1 + 40) % 40);
  }

  // 2. Speichen (8 Speichen à 4 Felder, 40-71)
  let fieldId = 40;
  for (let s = 0; s < 8; s++) {
    const rimIndex = s * 5;
    const angle = (rimIndex / 40) * 2 * Math.PI - Math.PI / 2;
    
    for (let f = 1; f <= 4; f++) {
      const dist = rimRadius - (f * (rimRadius / 5));
      fields.push({
        id: fieldId,
        x: center.x + dist * Math.cos(angle),
        y: center.y + dist * Math.sin(angle),
        category: CATEGORIES[s],
        isWedge: false,
        type: 'spoke'
      });

      if (f === 1) {
        adj[fieldId].push(rimIndex);
        adj[rimIndex].push(fieldId);
      } else {
        adj[fieldId].push(fieldId - 1);
        adj[fieldId - 1].push(fieldId);
      }
      fieldId++;
    }
    adj[fieldId - 1].push(72);
    adj[72].push(fieldId - 1);
  }

  // 3. Zentrum (72)
  fields.push({
    id: 72,
    x: center.x,
    y: center.y,
    category: null,
    isWedge: false,
    type: 'center'
  });

  return { fields, adj };
};

const Board: React.FC<BoardProps> = ({ players, currentPlayerIndex, possibleMoves, onMoveSelect }) => {
  const { fields } = useMemo(() => generateBoard(), []);

  return (
    <div className="relative w-[700px] h-[700px] mx-auto transition-all duration-700 select-none">
      {/* Hintergrund-Struktur */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 700 700">
        <circle cx="350" cy="350" r="310" fill="none" stroke="#e2e8f0" strokeWidth="40" className="opacity-10" />
        {[0,1,2,3,4,5,6,7].map(s => {
          const angle = (s * 5 / 40) * 2 * Math.PI - Math.PI / 2;
          return (
            <line 
              key={s}
              x1="350" y1="350" 
              x2={350 + 310 * Math.cos(angle)} 
              y2={350 + 310 * Math.sin(angle)} 
              stroke="#e2e8f0" strokeWidth="20" className="opacity-10" 
            />
          );
        })}
      </svg>

      {fields.map((field) => {
        const isPossible = possibleMoves.includes(field.id);
        const color = field.category ? categoryColors[field.category] : '#1e1b4b';
        
        return (
          <button
            key={field.id}
            disabled={!isPossible}
            onClick={() => onMoveSelect(field.id)}
            className={`absolute rounded-full border-4 border-white shadow-lg transition-all duration-300 flex items-center justify-center
              ${field.isWedge ? 'w-14 h-14 -ml-7 -mt-7 z-20' : 'w-9 h-9 -ml-[18px] -mt-[18px] z-10'}
              ${field.type === 'center' ? 'w-24 h-24 -ml-12 -mt-12 bg-indigo-950 border-8 z-30' : ''}
              ${isPossible ? 'ring-8 ring-yellow-400 animate-pulse scale-125 z-50 cursor-pointer shadow-2xl' : 'cursor-default'}
            `}
            style={{ 
              left: field.x, 
              top: field.y, 
              backgroundColor: color 
            }}
          >
            {field.isWedge && <span className="text-white text-xl font-black drop-shadow-lg">★</span>}
            {field.type === 'center' && (
              <div className="text-white flex flex-col items-center">
                <span className="text-[10px] font-black tracking-[0.2em] leading-none mb-1">ZIEL</span>
                <span className="text-2xl filter drop-shadow-md">🏆</span>
              </div>
            )}
          </button>
        );
      })}

      {players.map((player, idx) => {
        const field = fields[player.position];
        const isCurrent = idx === currentPlayerIndex;
        const playersOnSameField = players.filter(p => p.position === player.position);
        const playerIndexOnField = playersOnSameField.findIndex(p => p.id === player.id);
        
        const offset = playersOnSameField.length > 1 ? (playerIndexOnField - (playersOnSameField.length-1)/2) * 10 : 0;

        return (
          <div
            key={player.id}
            className={`absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-4 border-white shadow-2xl transition-all duration-500 z-40 flex items-center justify-center
              ${isCurrent ? 'ring-4 ring-yellow-400 scale-125 z-50' : 'opacity-90 grayscale-[10%]'}`}
            style={{ 
              left: field.x + offset, 
              top: field.y + offset, 
              backgroundColor: player.color 
            }}
          >
            <span className="text-white font-black text-sm drop-shadow-md">{player.name[0].toUpperCase()}</span>
            {isCurrent && (
               <div className="absolute -top-12 left-0 right-0 flex justify-center">
                  <div className="animate-bounce text-3xl filter drop-shadow-lg">📍</div>
               </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Board;
