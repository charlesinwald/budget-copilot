import { useState, useEffect } from 'react';

export type Personality = 'friendly' | 'grumpy' | 'professional' | 'casual' | 'enthusiastic';

interface PersonalitySelectorProps {
  value: Personality;
  onChange: (personality: Personality) => void;
}

const personalityOptions: { value: Personality; label: string; emoji: string }[] = [
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'grumpy', label: 'Grumpy', emoji: '😠' },
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'casual', label: 'Casual', emoji: '😎' },
  { value: 'enthusiastic', label: 'Enthusiastic', emoji: '🎉' },
];

export default function PersonalitySelector({ value, onChange }: PersonalitySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-600">Personality:</label>
      <select
        className="text-sm px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={value}
        onChange={(e) => onChange(e.target.value as Personality)}
      >
        {personalityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.emoji} {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

