interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const PROMPTS = [
  "How much did I spend this month?",
  "What's my biggest expense category?",
  "Am I spending more than usual?",
  "Can I afford a $500 purchase?",
  "Where can I save money?",
];

export default function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {PROMPTS.map((p) => (
        <button
          key={p}
          onClick={() => onSelect(p)}
          className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-sm"
        >
          {p}
        </button>
      ))}
    </div>
  );
}


