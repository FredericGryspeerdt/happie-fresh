// @ts-types="preact"
import { RefObject } from "preact";

export interface SearchBoxProps {
  value: string;
  onInput: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement>;
}
export default function SearchBox({
  value,
  onInput,
  inputRef,
}: SearchBoxProps) {
  return <div class="relative">
    <input
      id="search-input"
      ref={inputRef}
      type="text"
      placeholder="Search items..."
      value={value}
      onInput={(e) => onInput(e.currentTarget.value)}
      class="w-full p-4 pl-12 bg-white border border-gray-200 rounded-2xl shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
    />
    <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="w-6 h-6"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
    </div>
  </div>;
}
