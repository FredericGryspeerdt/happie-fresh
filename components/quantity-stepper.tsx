interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
}

export default function QuantityStepper(
  { value, onChange }: QuantityStepperProps,
) {
  return (
    <div class="flex items-center bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center text-gray-600 active:bg-gray-200 active:scale-95 transition-all touch-manipulation"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Decrease quantity"
      >
        <span class="text-xl font-medium">-</span>
      </button>
      <div class="w-10 text-center font-semibold text-gray-800">{value}</div>
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center text-gray-600 active:bg-gray-200 active:scale-95 transition-all touch-manipulation"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <span class="text-xl font-medium">+</span>
      </button>
    </div>
  );
}
