// Hand-authored, deterministic seed data for local development.
// Entities reference each other by stable `slug`s; the seed runner resolves
// slugs to generated UUIDs at insert time. See
// docs/superpowers/specs/2026-07-25-production-seed-data-design.md.

export interface SeedCategory {
  slug: string;
  label: string;
  order: number;
}

export interface SeedItem {
  slug: string;
  name: string;
  categorySlug?: string;
}

export interface SeedListItem {
  itemSlug: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

export interface SeedList {
  name: string;
  items: SeedListItem[];
}

export interface SeedUser {
  username: string;
  password: string;
  lists: SeedList[];
}

export const categories: SeedCategory[] = [
  { slug: "produce", label: "Produce", order: 0 },
  { slug: "dairy-eggs", label: "Dairy & Eggs", order: 1 },
  { slug: "bakery", label: "Bakery", order: 2 },
  { slug: "meat-fish", label: "Meat & Fish", order: 3 },
  { slug: "pantry", label: "Pantry", order: 4 },
  { slug: "frozen", label: "Frozen", order: 5 },
  { slug: "beverages", label: "Beverages", order: 6 },
  { slug: "household", label: "Household", order: 7 },
];

export const catalogue: SeedItem[] = [
  // Produce
  { slug: "apples", name: "Apples", categorySlug: "produce" },
  { slug: "bananas", name: "Bananas", categorySlug: "produce" },
  { slug: "carrots", name: "Carrots", categorySlug: "produce" },
  { slug: "spinach", name: "Spinach", categorySlug: "produce" },
  { slug: "tomatoes", name: "Tomatoes", categorySlug: "produce" },
  { slug: "potatoes", name: "Potatoes", categorySlug: "produce" },
  { slug: "onions", name: "Onions", categorySlug: "produce" },
  { slug: "garlic", name: "Garlic", categorySlug: "produce" },
  { slug: "avocado", name: "Avocado", categorySlug: "produce" },
  { slug: "lemons", name: "Lemons", categorySlug: "produce" },
  { slug: "cucumber", name: "Cucumber", categorySlug: "produce" },
  { slug: "bell-peppers", name: "Bell Peppers", categorySlug: "produce" },
  // Dairy & Eggs
  { slug: "milk", name: "Milk", categorySlug: "dairy-eggs" },
  { slug: "eggs", name: "Eggs", categorySlug: "dairy-eggs" },
  { slug: "butter", name: "Butter", categorySlug: "dairy-eggs" },
  { slug: "cheddar", name: "Cheddar Cheese", categorySlug: "dairy-eggs" },
  { slug: "yogurt", name: "Yogurt", categorySlug: "dairy-eggs" },
  { slug: "cream", name: "Cream", categorySlug: "dairy-eggs" },
  { slug: "parmesan", name: "Parmesan", categorySlug: "dairy-eggs" },
  // Bakery
  { slug: "bread", name: "Bread", categorySlug: "bakery" },
  { slug: "bagels", name: "Bagels", categorySlug: "bakery" },
  { slug: "croissants", name: "Croissants", categorySlug: "bakery" },
  { slug: "tortillas", name: "Tortillas", categorySlug: "bakery" },
  { slug: "muffins", name: "Muffins", categorySlug: "bakery" },
  // Meat & Fish
  { slug: "chicken-breast", name: "Chicken Breast", categorySlug: "meat-fish" },
  { slug: "ground-beef", name: "Ground Beef", categorySlug: "meat-fish" },
  { slug: "salmon", name: "Salmon Fillet", categorySlug: "meat-fish" },
  { slug: "bacon", name: "Bacon", categorySlug: "meat-fish" },
  { slug: "sausages", name: "Sausages", categorySlug: "meat-fish" },
  { slug: "shrimp", name: "Shrimp", categorySlug: "meat-fish" },
  // Pantry
  { slug: "rice", name: "Rice", categorySlug: "pantry" },
  { slug: "pasta", name: "Pasta", categorySlug: "pantry" },
  { slug: "olive-oil", name: "Olive Oil", categorySlug: "pantry" },
  { slug: "salt", name: "Salt", categorySlug: "pantry" },
  { slug: "black-pepper", name: "Black Pepper", categorySlug: "pantry" },
  { slug: "sugar", name: "Sugar", categorySlug: "pantry" },
  { slug: "flour", name: "Flour", categorySlug: "pantry" },
  { slug: "canned-tomatoes", name: "Canned Tomatoes", categorySlug: "pantry" },
  { slug: "peanut-butter", name: "Peanut Butter", categorySlug: "pantry" },
  { slug: "cereal", name: "Cereal", categorySlug: "pantry" },
  { slug: "honey", name: "Honey", categorySlug: "pantry" },
  { slug: "coffee-beans", name: "Coffee Beans", categorySlug: "pantry" },
  // Frozen
  { slug: "frozen-peas", name: "Frozen Peas", categorySlug: "frozen" },
  { slug: "frozen-pizza", name: "Frozen Pizza", categorySlug: "frozen" },
  { slug: "ice-cream", name: "Ice Cream", categorySlug: "frozen" },
  { slug: "frozen-berries", name: "Frozen Berries", categorySlug: "frozen" },
  // Beverages
  { slug: "orange-juice", name: "Orange Juice", categorySlug: "beverages" },
  {
    slug: "sparkling-water",
    name: "Sparkling Water",
    categorySlug: "beverages",
  },
  { slug: "cola", name: "Cola", categorySlug: "beverages" },
  { slug: "green-tea", name: "Green Tea", categorySlug: "beverages" },
  { slug: "red-wine", name: "Red Wine", categorySlug: "beverages" },
  // Household
  { slug: "dish-soap", name: "Dish Soap", categorySlug: "household" },
  { slug: "paper-towels", name: "Paper Towels", categorySlug: "household" },
  { slug: "trash-bags", name: "Trash Bags", categorySlug: "household" },
  {
    slug: "laundry-detergent",
    name: "Laundry Detergent",
    categorySlug: "household",
  },
  { slug: "toilet-paper", name: "Toilet Paper", categorySlug: "household" },
  // Uncategorized (edge: items with no category)
  { slug: "batteries", name: "AA Batteries" },
  { slug: "birthday-candles", name: "Birthday Candles" },
];

export const users: SeedUser[] = [
  {
    // Primary account. The entrypoint overrides username/password from
    // SEED_USERNAME/SEED_PASSWORD when those env vars are set.
    username: "demo",
    password: "password",
    lists: [
      {
        name: "Weekly Groceries",
        items: [
          { itemSlug: "milk", quantity: 2, checked: false },
          { itemSlug: "eggs", quantity: 1, checked: true },
          {
            itemSlug: "bread",
            quantity: 1,
            note: "Sourdough if they have it",
            checked: false,
          },
          { itemSlug: "bananas", quantity: 6, checked: false },
          { itemSlug: "chicken-breast", quantity: 1, checked: true },
          { itemSlug: "spinach", quantity: 1, checked: false },
          {
            itemSlug: "olive-oil",
            quantity: 1,
            note: "Extra virgin",
            checked: false,
          },
          { itemSlug: "yogurt", quantity: 4, checked: true },
          { itemSlug: "apples", quantity: 5, checked: false },
          { itemSlug: "coffee-beans", quantity: 1, checked: true },
        ],
      },
      {
        name: "Weekend BBQ",
        items: [
          { itemSlug: "sausages", quantity: 3, checked: false },
          { itemSlug: "ground-beef", quantity: 2, checked: false },
          { itemSlug: "tortillas", quantity: 2, checked: false },
          { itemSlug: "bell-peppers", quantity: 3, checked: false },
          {
            itemSlug: "cola",
            quantity: 6,
            note: "For the kids 🥤",
            checked: false,
          },
          { itemSlug: "red-wine", quantity: 2, checked: false },
        ],
      },
      {
        // Edge: a fully-checked list ("everything bought").
        name: "Pantry Restock",
        items: [
          { itemSlug: "rice", quantity: 2, checked: true },
          { itemSlug: "pasta", quantity: 3, checked: true },
          { itemSlug: "canned-tomatoes", quantity: 4, checked: true },
          { itemSlug: "salt", quantity: 1, checked: true },
          { itemSlug: "flour", quantity: 1, checked: true },
        ],
      },
    ],
  },
  {
    username: "alex",
    password: "happie123",
    lists: [
      {
        name: "Groceries",
        items: [
          { itemSlug: "milk", quantity: 1, checked: false },
          { itemSlug: "cheddar", quantity: 1, checked: true },
          { itemSlug: "tomatoes", quantity: 4, checked: false },
          { itemSlug: "pasta", quantity: 2, checked: false },
          {
            itemSlug: "ground-beef",
            quantity: 1,
            note: "80/20",
            checked: true,
          },
          { itemSlug: "orange-juice", quantity: 1, checked: false },
          { itemSlug: "paper-towels", quantity: 1, checked: false },
        ],
      },
      {
        // Edge: an empty list.
        name: "Party Supplies",
        items: [],
      },
    ],
  },
  {
    username: "sam",
    password: "happie123",
    lists: [
      {
        // Edge: a long list spanning every category + an uncategorized item.
        name: "Big Weekly Shop",
        items: [
          { itemSlug: "apples", quantity: 3, checked: false },
          { itemSlug: "milk", quantity: 2, checked: false },
          { itemSlug: "bread", quantity: 2, checked: false },
          { itemSlug: "salmon", quantity: 2, checked: true },
          {
            // Edge: high quantity.
            itemSlug: "rice",
            quantity: 24,
            note: "Bulk buy for the whole month",
            checked: false,
          },
          { itemSlug: "frozen-peas", quantity: 2, checked: false },
          { itemSlug: "orange-juice", quantity: 3, checked: false },
          { itemSlug: "dish-soap", quantity: 1, checked: false },
          {
            // Edge: a very long note.
            itemSlug: "ice-cream",
            quantity: 2,
            note:
              "The good vanilla — the kind we got last time from the little shop on the corner, not the store brand that nobody in this house will actually eat",
            checked: true,
          },
          // Edge: an uncategorized item on a list.
          { itemSlug: "batteries", quantity: 1, checked: false },
          { itemSlug: "parmesan", quantity: 1, checked: true },
          { itemSlug: "spinach", quantity: 2, checked: false },
          { itemSlug: "coffee-beans", quantity: 1, checked: false },
          { itemSlug: "toilet-paper", quantity: 1, checked: false },
          {
            itemSlug: "birthday-candles",
            quantity: 1,
            note: "🎂",
            checked: true,
          },
        ],
      },
      {
        // Edge: a very long list name (rename scenario).
        name:
          "Monthly Bulk & Household Restock — Costco Run (don't forget the receipt!)",
        items: [
          { itemSlug: "paper-towels", quantity: 2, checked: false },
          { itemSlug: "laundry-detergent", quantity: 1, checked: false },
          { itemSlug: "trash-bags", quantity: 3, checked: false },
          { itemSlug: "toilet-paper", quantity: 2, checked: false },
        ],
      },
    ],
  },
];
