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

export interface FixtureMember {
  name: string;
  color: string;
  emoji: string;
  isManager: boolean;
}

export interface SeedUser {
  username: string;
  password: string;
  members: FixtureMember[];
  lists: SeedList[];
}

export const categories: SeedCategory[] = [
  { slug: "produce", label: "Groenten en fruit", order: 0 },
  { slug: "dairy-eggs", label: "Zuivel en eieren", order: 1 },
  { slug: "bakery", label: "Bakkerij", order: 2 },
  { slug: "meat-fish", label: "Vlees en vis", order: 3 },
  { slug: "pantry", label: "Voorraadkast", order: 4 },
  { slug: "frozen", label: "Diepvries", order: 5 },
  { slug: "beverages", label: "Dranken", order: 6 },
  { slug: "household", label: "Huishouden", order: 7 },
];

export const catalogue: SeedItem[] = [
  // Produce
  { slug: "apples", name: "Appels", categorySlug: "produce" },
  { slug: "bananas", name: "Bananen", categorySlug: "produce" },
  { slug: "carrots", name: "Wortelen", categorySlug: "produce" },
  { slug: "spinach", name: "Spinazie", categorySlug: "produce" },
  { slug: "tomatoes", name: "Tomaten", categorySlug: "produce" },
  { slug: "potatoes", name: "Aardappelen", categorySlug: "produce" },
  { slug: "onions", name: "Uien", categorySlug: "produce" },
  { slug: "garlic", name: "Knoflook", categorySlug: "produce" },
  { slug: "avocado", name: "Avocado", categorySlug: "produce" },
  { slug: "lemons", name: "Citroenen", categorySlug: "produce" },
  { slug: "cucumber", name: "Komkommer", categorySlug: "produce" },
  { slug: "bell-peppers", name: "Paprika's", categorySlug: "produce" },
  // Dairy & Eggs
  { slug: "milk", name: "Melk", categorySlug: "dairy-eggs" },
  { slug: "eggs", name: "Eieren", categorySlug: "dairy-eggs" },
  { slug: "butter", name: "Boter", categorySlug: "dairy-eggs" },
  { slug: "cheddar", name: "Cheddarkaas", categorySlug: "dairy-eggs" },
  { slug: "yogurt", name: "Yoghurt", categorySlug: "dairy-eggs" },
  { slug: "cream", name: "Room", categorySlug: "dairy-eggs" },
  { slug: "parmesan", name: "Parmezaan", categorySlug: "dairy-eggs" },
  // Bakery
  { slug: "bread", name: "Brood", categorySlug: "bakery" },
  { slug: "bagels", name: "Bagels", categorySlug: "bakery" },
  { slug: "croissants", name: "Croissants", categorySlug: "bakery" },
  { slug: "tortillas", name: "Tortillas", categorySlug: "bakery" },
  { slug: "muffins", name: "Muffins", categorySlug: "bakery" },
  // Meat & Fish
  { slug: "chicken-breast", name: "Kipfilet", categorySlug: "meat-fish" },
  { slug: "ground-beef", name: "Rundergehakt", categorySlug: "meat-fish" },
  { slug: "salmon", name: "Zalmfilet", categorySlug: "meat-fish" },
  { slug: "bacon", name: "Spek", categorySlug: "meat-fish" },
  { slug: "sausages", name: "Worsten", categorySlug: "meat-fish" },
  { slug: "shrimp", name: "Garnalen", categorySlug: "meat-fish" },
  // Pantry
  { slug: "rice", name: "Rijst", categorySlug: "pantry" },
  { slug: "pasta", name: "Pasta", categorySlug: "pantry" },
  { slug: "olive-oil", name: "Olijfolie", categorySlug: "pantry" },
  { slug: "salt", name: "Zout", categorySlug: "pantry" },
  { slug: "black-pepper", name: "Zwarte peper", categorySlug: "pantry" },
  { slug: "sugar", name: "Suiker", categorySlug: "pantry" },
  { slug: "flour", name: "Bloem", categorySlug: "pantry" },
  { slug: "canned-tomatoes", name: "Tomaten in blik", categorySlug: "pantry" },
  { slug: "peanut-butter", name: "Pindakaas", categorySlug: "pantry" },
  { slug: "cereal", name: "Ontbijtgranen", categorySlug: "pantry" },
  { slug: "honey", name: "Honing", categorySlug: "pantry" },
  { slug: "coffee-beans", name: "Koffiebonen", categorySlug: "pantry" },
  // Frozen
  { slug: "frozen-peas", name: "Diepvrieserwten", categorySlug: "frozen" },
  { slug: "frozen-pizza", name: "Diepvriespizza", categorySlug: "frozen" },
  { slug: "ice-cream", name: "IJs", categorySlug: "frozen" },
  { slug: "frozen-berries", name: "Diepvriesbessen", categorySlug: "frozen" },
  // Beverages
  { slug: "orange-juice", name: "Sinaasappelsap", categorySlug: "beverages" },
  {
    slug: "sparkling-water",
    name: "Bruiswater",
    categorySlug: "beverages",
  },
  { slug: "cola", name: "Cola", categorySlug: "beverages" },
  { slug: "green-tea", name: "Groene thee", categorySlug: "beverages" },
  { slug: "red-wine", name: "Rode wijn", categorySlug: "beverages" },
  // Household
  { slug: "dish-soap", name: "Afwasmiddel", categorySlug: "household" },
  { slug: "paper-towels", name: "Keukenpapier", categorySlug: "household" },
  { slug: "trash-bags", name: "Vuilniszakken", categorySlug: "household" },
  {
    slug: "laundry-detergent",
    name: "Wasmiddel",
    categorySlug: "household",
  },
  { slug: "toilet-paper", name: "Toiletpapier", categorySlug: "household" },
  // Uncategorized (edge: items with no category)
  { slug: "batteries", name: "AA-batterijen" },
  { slug: "birthday-candles", name: "Verjaardagskaarsjes" },
];

export const users: SeedUser[] = [
  {
    // Primary account. The entrypoint overrides username/password from
    // SEED_USERNAME/SEED_PASSWORD when those env vars are set.
    username: "demo",
    password: "password",
    members: [
      { name: "Demo", color: "coral", emoji: "🦊", isManager: true },
      { name: "Robin", color: "sunshine", emoji: "🌻", isManager: true },
      { name: "Bo", color: "meadow", emoji: "🐸", isManager: false },
      { name: "Pip", color: "lavender", emoji: "🦄", isManager: false },
    ],
    lists: [
      {
        name: "Wekelijkse boodschappen",
        items: [
          { itemSlug: "milk", quantity: 2, checked: false },
          { itemSlug: "eggs", quantity: 1, checked: true },
          {
            itemSlug: "bread",
            quantity: 1,
            note: "Zuurdesem als ze het hebben",
            checked: false,
          },
          { itemSlug: "bananas", quantity: 6, checked: false },
          { itemSlug: "chicken-breast", quantity: 1, checked: true },
          { itemSlug: "spinach", quantity: 1, checked: false },
          {
            itemSlug: "olive-oil",
            quantity: 1,
            note: "Extra vierge",
            checked: false,
          },
          { itemSlug: "yogurt", quantity: 4, checked: true },
          { itemSlug: "apples", quantity: 5, checked: false },
          { itemSlug: "coffee-beans", quantity: 1, checked: true },
        ],
      },
      {
        name: "Barbecue in het weekend",
        items: [
          { itemSlug: "sausages", quantity: 3, checked: false },
          { itemSlug: "ground-beef", quantity: 2, checked: false },
          { itemSlug: "tortillas", quantity: 2, checked: false },
          { itemSlug: "bell-peppers", quantity: 3, checked: false },
          {
            itemSlug: "cola",
            quantity: 6,
            note: "Voor de kinderen 🥤",
            checked: false,
          },
          { itemSlug: "red-wine", quantity: 2, checked: false },
        ],
      },
      {
        // Edge: a fully-checked list ("everything bought").
        name: "Voorraad aanvullen",
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
    members: [
      { name: "Alex", color: "sky", emoji: "⭐", isManager: true },
    ],
    lists: [
      {
        name: "Boodschappen",
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
        name: "Feestbenodigdheden",
        items: [],
      },
    ],
  },
  {
    username: "sam",
    password: "happie123",
    members: [
      { name: "Sam", color: "slate", emoji: "🐼", isManager: true },
    ],
    lists: [
      {
        // Edge: a long list spanning every category + an uncategorized item.
        name: "Grote wekelijkse boodschappen",
        items: [
          { itemSlug: "apples", quantity: 3, checked: false },
          { itemSlug: "milk", quantity: 2, checked: false },
          { itemSlug: "bread", quantity: 2, checked: false },
          { itemSlug: "salmon", quantity: 2, checked: true },
          {
            // Edge: high quantity.
            itemSlug: "rice",
            quantity: 24,
            note: "Voorraad voor de hele maand",
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
              "Het lekkere vanille-ijs — dat van vorige keer uit het winkeltje op de hoek, niet het huismerk dat niemand hier thuis wil eten",
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
          "Maandelijkse voorraad voor het huishouden — naar de groothandel (vergeet het kasticket niet!)",
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
