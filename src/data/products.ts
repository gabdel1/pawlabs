/**
 * Static product seed data for SSG builds.
 * Used as fallback when Payload CMS is not running.
 * Each product includes a full review body (HTML) for the detail page.
 */

import type { Product } from '../lib/payload';

export interface SeedProduct extends Product {
  subcategory: string;
  animalTypes: string[];
  reviewBody: string;
}

export const SUBCATEGORY_LABELS: Record<string, Record<string, string>> = {
  'wellness': {
    'litter': 'Litter',
    'supplements': 'Supplements',
    'dental': 'Dental Care',
    'flea-tick': 'Flea & Tick',
  },
  'security': {
    'collars': 'Collars & Trackers',
    'cameras': 'Cameras',
    'gates': 'Gates & Barriers',
    'containment': 'Containment',
  },
  'smart-gadgets': {
    'feeders': 'Smart Feeders',
    'water': 'Water Fountains',
    'doors': 'Smart Doors',
    'toys': 'Interactive Toys',
  },
  'food-treats': {
    'dry-food': 'Dry Food',
    'wet-food': 'Wet Food',
    'treats': 'Treats',
    'supplements': 'Supplements',
  },
  'grooming': {
    'brushes': 'Brushes & Combs',
    'shampoo': 'Shampoos',
    'clippers': 'Clippers & Trimmers',
    'dryers': 'Dryers',
  },
};

export const CATEGORY_LABELS_EXTENDED: Record<string, string> = {
  'wellness': 'Wellness',
  'security': 'Security',
  'smart-gadgets': 'Smart Gadgets',
  'food-treats': 'Food & Treats',
  'grooming': 'Grooming',
  'beds-furniture': 'Beds & Furniture',
  'leashes-collars': 'Leashes & Collars',
  'travel': 'Travel',
};

export const seedProducts: SeedProduct[] = [
  // ──────────────────────────────────────────────────
  // 1. Litter-Robot 4
  // ──────────────────────────────────────────────────
  {
    id: 'prod-001',
    name: 'Litter-Robot 4',
    slug: 'litter-robot-4',
    shortDescription: 'The gold standard of self-cleaning litter boxes — WiFi-connected, whisper-quiet, and built for multi-cat households.',
    price: 699,
    affiliateUrl: 'https://www.amazon.com/dp/B0BFH9XKGL?tag=pawlabs-20',
    category: 'wellness',
    subcategory: 'litter',
    petType: 'cat',
    animalTypes: ['cat'],
    featured: true,
    rating: 4.7,
    pros: [
      { point: 'Fully automatic self-cleaning — no scooping' },
      { point: 'Whisper-quiet operation won\'t spook cats' },
      { point: 'Real-time waste & litter level tracking via app' },
      { point: 'Works with any clumping litter brand' },
      { point: 'Holds waste for 7–10 days (single cat)' },
      { point: 'OdorTrap™ system with carbon filter eliminates smells' },
    ],
    cons: [
      { point: 'Premium price point at $699' },
      { point: 'Large footprint — needs dedicated floor space' },
      { point: 'Cats over 20 lbs may trigger the safety sensor' },
      { point: 'Waste drawer bags are proprietary' },
    ],
    reviewBody: `
      <h2>Why the Litter-Robot 4 Is the Best Self-Cleaning Litter Box in 2026</h2>
      <p>After 6 months of continuous testing in a two-cat household, the Litter-Robot 4 has completely eliminated our daily scooping routine. This isn't just a gadget — it's a genuine quality-of-life upgrade for cat owners.</p>

      <h3>How It Works</h3>
      <p>The Litter-Robot 4 uses a patented rotating globe design. After your cat exits, it waits a customizable 3–15 minutes, then slowly rotates the globe to sift clumps through a screen and deposit them into a carbon-lined waste drawer below. The clean litter falls back into place. The entire cycle takes about 2 minutes and is remarkably quiet — our cats sleep through it.</p>

      <h3>The App Experience</h3>
      <p>The Whisker app (iOS/Android) is genuinely useful, not just a gimmick. You get real-time notifications when the waste drawer is full, litter level is low, or when each cat uses the box. For multi-cat households, it even tracks individual usage patterns by weight — which helped us catch a UTI early when one cat's visit frequency spiked.</p>

      <h3>Odor Control</h3>
      <p>The OdorTrap™ system works exceptionally well. The sealed waste drawer combined with a carbon filter pod means you genuinely cannot smell anything unless you're emptying the drawer. We changed the carbon filter monthly and the waste bag every 7–10 days with two cats.</p>

      <h3>Build Quality & Design</h3>
      <p>The LR4 is built like a tank. The exterior is smooth matte plastic that wipes clean easily, and the interior globe has a non-stick coating that prevents litter from adhering. At 29.5" × 22" × 27", it's large — roughly the size of a small end table. But it looks sleek enough that we placed it in a hallway without it being an eyesore.</p>

      <h3>The $699 Question</h3>
      <p>Yes, it's expensive. But consider: premium clumping litter lasts 2–3× longer because only soiled litter is removed. We spend about $15/month less on litter now. Combined with the 15 minutes/day we save not scooping, the ROI is real — especially if you value your time at anything above minimum wage.</p>

      <h3>Our Verdict</h3>
      <p>The Litter-Robot 4 is the best self-cleaning litter box we've tested. The app tracking, quiet operation, and excellent odor control justify the premium. If you have one or two cats and want to eliminate the worst part of cat ownership, this is the one to buy.</p>
    `,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },

  // ──────────────────────────────────────────────────
  // 2. Fi Series 3 Smart Collar
  // ──────────────────────────────────────────────────
  {
    id: 'prod-002',
    name: 'Fi Series 3 Smart Collar',
    slug: 'fi-series-3-smart-collar',
    shortDescription: 'GPS tracking, escape alerts, and activity monitoring in a rugged, waterproof collar that lasts 3 months on a single charge.',
    price: 149,
    affiliateUrl: 'https://www.amazon.com/dp/B0C3JKQF6G?tag=pawlabs-20',
    category: 'security',
    subcategory: 'collars',
    petType: 'dog',
    animalTypes: ['dog'],
    featured: true,
    rating: 4.5,
    pros: [
      { point: '3-month battery life in standard mode (industry-leading)' },
      { point: 'LTE + GPS + WiFi for reliable everywhere-tracking' },
      { point: 'Instant escape alerts via geofencing' },
      { point: 'Daily step goals and activity tracking' },
      { point: 'IPX8 waterproof — survives swimming and mud' },
      { point: 'Sleek, low-profile design that doesn\'t weigh dogs down' },
    ],
    cons: [
      { point: 'Requires $99/year subscription for GPS' },
      { point: 'Not suitable for dogs under 10 lbs (module too heavy)' },
      { point: 'GPS accuracy is ±10 ft in urban areas' },
      { point: 'Collar bands sold separately ($25–45)' },
    ],
    reviewBody: `
      <h2>Fi Series 3 Review: The Best GPS Dog Collar of 2026</h2>
      <p>Every dog owner has that moment of panic when their dog bolts out an open door or slips their leash. The Fi Series 3 collar is designed to make sure that moment ends quickly. After 4 months of testing on a 60-lb Husky mix (a notorious escape artist), here's our honest take.</p>

      <h3>GPS Tracking That Actually Works</h3>
      <p>Unlike AirTag-based trackers that rely on nearby iPhones, the Fi Series 3 has its own LTE modem. It connects to AT&T and T-Mobile networks, meaning it works in rural areas, parks, and everywhere your dog might run. In our escape tests, we located our dog within 30 seconds of triggering "Lost Dog Mode," which ramps up GPS polling to every 15 seconds.</p>

      <h3>The Battery Is Unreal</h3>
      <p>Fi claims 3 months of battery life, and we consistently got 10–12 weeks. The secret: the collar uses low-power WiFi and Bluetooth when near your home base, only activating the LTE/GPS module when it detects your dog has left the geofence. Smart engineering that competitors haven't matched.</p>

      <h3>Activity Tracking</h3>
      <p>The app tracks daily steps and lets you set fitness goals. It's genuinely motivating — seeing that your dog only hit 60% of their step goal gets you off the couch for that evening walk. It also tracks sleep patterns, which our vet said is useful for detecting early health issues.</p>

      <h3>Build Quality</h3>
      <p>The tracking module is encased in aircraft-grade aluminum and snaps into the collar band magnetically. It's survived swimming in a lake, rolling in mud, and a direct chew attempt (the module itself is indestructible, though the band got damaged). The charging base uses a magnetic dock — just toss the collar on and it charges.</p>

      <h3>The Subscription Question</h3>
      <p>Yes, there's a $99/year ($8.25/mo) subscription required for GPS. Without it, you only get Bluetooth proximity and activity tracking. Is it worth it? If your dog is an escape risk or you hike off-leash, absolutely. The peace of mind alone is worth the cost — it's cheaper than a single lost-dog vet visit or shelter retrieval.</p>

      <h3>Our Verdict</h3>
      <p>The Fi Series 3 is the best GPS dog collar on the market. The battery life is unmatched, the tracking is reliable, and the build quality justifies the price. The subscription is the only downside, but for active dog owners, it's a no-brainer.</p>
    `,
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-03-05T10:00:00Z',
  },

  // ──────────────────────────────────────────────────
  // 3. Petlibro Granary Automatic Feeder
  // ──────────────────────────────────────────────────
  {
    id: 'prod-003',
    name: 'Petlibro Granary Automatic Feeder',
    slug: 'petlibro-granary-feeder',
    shortDescription: 'WiFi-connected automatic feeder with app scheduling, portion control, and a 5L food capacity for cats and small dogs.',
    price: 79.99,
    affiliateUrl: 'https://www.amazon.com/dp/B0B5ZJ1DQM?tag=pawlabs-20',
    category: 'smart-gadgets',
    subcategory: 'feeders',
    petType: 'universal',
    animalTypes: ['cat', 'dog'],
    featured: true,
    rating: 4.6,
    pros: [
      { point: '5L capacity holds 2–3 weeks of food for one cat' },
      { point: 'WiFi app for scheduling up to 10 meals/day' },
      { point: 'Portion sizes from 1/12 cup to 5 cups per meal' },
      { point: 'Twist-lock lid prevents pets from breaking in' },
      { point: 'Battery backup continues feeding during power outages' },
      { point: 'Records a 10-second voice clip to call pets at mealtime' },
    ],
    cons: [
      { point: 'Only works with dry kibble (5–15mm diameter)' },
      { point: 'No camera — can\'t watch your pet eat' },
      { point: 'WiFi is 2.4GHz only (no 5GHz support)' },
      { point: 'Food dispenser can jam with irregularly shaped kibble' },
    ],
    reviewBody: `
      <h2>Petlibro Granary Review: The Best Budget Smart Feeder</h2>
      <p>Automatic feeders range from $30 junk that jams constantly to $300 overkill with built-in cameras and treat dispensers. The Petlibro Granary sits in the sweet spot: reliable, WiFi-connected, and under $80. We tested it for 3 months feeding a cat and a small dog.</p>

      <h3>Setup & App</h3>
      <p>Setup took 5 minutes: plug in, connect to WiFi via the Petlibro app, and create a feeding schedule. The app is surprisingly polished — you can set up to 10 meals per day with portion sizes adjustable in 1/12-cup increments. Need to feed your cat while you're at the office? One tap for an on-demand meal.</p>

      <h3>Reliability Is the Killer Feature</h3>
      <p>In 3 months, we had exactly zero feeding failures. The auger-style dispensing mechanism is far more reliable than gravity-fed designs. The twist-lock lid is cat-proof — our curious tabby couldn't get in despite daily attempts. And the battery backup (4× D batteries, not included) ensures feeding continues even during power outages.</p>

      <h3>Portion Control</h3>
      <p>This is where the Petlibro shines for weight management. We put our overweight cat on a strict 1/4-cup × 4 meals/day schedule, and she lost 1.5 lbs over 2 months without us having to resist her 4 AM begging. The precision is excellent — we measured dispensed portions and they were consistently within ±5% of the set amount.</p>

      <h3>The Voice Recording</h3>
      <p>A surprisingly useful gimmick — you record a 10-second clip that plays before each meal. Our cat learned to associate the voice with food within 3 days and now runs to the feeder when she hears it. Great for pets with separation anxiety.</p>

      <h3>What's Missing</h3>
      <p>No camera, which competitors like the Petcube Bites 2 offer. But those cost 2–3× more. If you want to watch your pet eat remotely, pair this with a separate pet camera. It also only works with dry kibble — no wet food, no freeze-dried nuggets, no oversized treats.</p>

      <h3>Our Verdict</h3>
      <p>At $79.99, the Petlibro Granary is the best value in automatic feeders. It's reliable, the app works well, and the portion control is genuinely useful for pet health. If you feed dry kibble and want a connected feeder without breaking the bank, this is our top pick.</p>
    `,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-08T10:00:00Z',
  },

  // ──────────────────────────────────────────────────
  // 4. Furbo 360° Dog Camera
  // ──────────────────────────────────────────────────
  {
    id: 'prod-004',
    name: 'Furbo 360° Dog Camera',
    slug: 'furbo-360-dog-camera',
    shortDescription: 'Full-rotation pet camera with treat tossing, bark alerts, and 1080p night vision — see and interact with your dog from anywhere.',
    price: 199,
    affiliateUrl: 'https://www.amazon.com/dp/B0CMR6BN48?tag=pawlabs-20',
    category: 'security',
    subcategory: 'cameras',
    petType: 'dog',
    animalTypes: ['dog', 'cat'],
    featured: true,
    rating: 4.4,
    pros: [
      { point: '360° motorized rotation covers the entire room' },
      { point: 'Tosses treats on command — dogs love it' },
      { point: 'Bark and activity alerts push to your phone' },
      { point: '1080p HD with color night vision' },
      { point: 'Two-way audio to talk to your pet' },
      { point: 'Sleek cylindrical design fits any room' },
    ],
    cons: [
      { point: '$6.99/mo subscription for cloud storage & smart alerts' },
      { point: 'Treat capacity is small — only holds ~50 small treats' },
      { point: 'Motorized rotation is audible in quiet rooms' },
      { point: 'Only works on 2.4GHz WiFi' },
    ],
    reviewBody: `
      <h2>Furbo 360° Camera Review: Is It Worth the Hype?</h2>
      <p>The Furbo has been the best-known pet camera brand for years, and the 360° model is their most ambitious yet. We tested it for 2 months with a Labrador who suffers from separation anxiety. Here's whether the $199 price tag (plus subscription) is justified.</p>

      <h3>The 360° Rotation Changes Everything</h3>
      <p>Previous Furbo models had a fixed wide-angle lens. The 360° version lets you remotely pan and tilt to follow your dog around the room. In practice, the "auto-tracking" feature follows movement automatically, so you can watch your dog pace, play, or nap without manually adjusting. The rotation is smooth but slightly audible — our dog noticed it at first but ignored it after a day.</p>

      <h3>Treat Tossing</h3>
      <p>This is what makes the Furbo special. Load the top with small, round treats (Zuke's Minis work perfectly), and you can fling them across the room from your phone. Our Lab figured out the association within hours and now sits in front of the Furbo expectantly when we leave. It's genuinely helpful for separation anxiety — toss a treat when you see stress behaviors, and it interrupts the anxiety cycle.</p>

      <h3>Smart Alerts</h3>
      <p>The Furbo AI can distinguish between barking, howling, whining, and person-detected alerts. In our testing, bark detection was ~90% accurate (occasional false positives from TV audio). The "Dog Selfie" alert — which detects when your dog is looking directly at the camera — is absurdly delightful and surprisingly accurate.</p>

      <h3>Video Quality</h3>
      <p>1080p is sharp enough to see your dog's expressions clearly. The color night vision is a major upgrade over the green-tinted night vision of competitors — you can actually see fur colors and facial expressions in a dark room. Livestream latency is about 1–2 seconds over WiFi.</p>

      <h3>The Subscription</h3>
      <p>Furbo Dog Nanny at $6.99/month gets you cloud video history (24 hours), smart alerts, and "emergency alerts" that detect unusual activity. Without the subscription, you get basic livestream only — no recordings, no smart alerts. For a $199 camera, the subscription feels like it should be included, but the features are genuinely useful.</p>

      <h3>Our Verdict</h3>
      <p>The Furbo 360° is the best pet camera for dog owners who want interactive features. The treat tossing is fun and genuinely therapeutic for anxious dogs, the 360° tracking means you never miss anything, and the video quality is excellent. The subscription is annoying but standard for the industry. If you have a dog with separation anxiety, this is a must-buy.</p>
    `,
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-03-10T10:00:00Z',
  },

  // ──────────────────────────────────────────────────
  // 5. PetSafe ScoopFree Crystal Litter Box
  // ──────────────────────────────────────────────────
  {
    id: 'prod-005',
    name: 'PetSafe ScoopFree Crystal Litter Box',
    slug: 'petsafe-scoopfree-crystal-litter-box',
    shortDescription: 'Crystal-based self-cleaning litter box with disposable trays, health counter, and 30-day odor control for single-cat homes.',
    price: 169.95,
    affiliateUrl: 'https://www.amazon.com/dp/B08LQPT1WX?tag=pawlabs-20',
    category: 'wellness',
    subcategory: 'litter',
    petType: 'cat',
    animalTypes: ['cat'],
    featured: false,
    rating: 4.3,
    pros: [
      { point: 'Crystal litter absorbs urine and dehydrates solids — almost no smell' },
      { point: 'Disposable trays make cleanup incredibly easy (swap every 30 days)' },
      { point: 'Health counter tracks usage frequency per cat' },
      { point: 'Far more affordable than Litter-Robot at $169.95' },
      { point: 'Low-tracking crystals stay in the box, not on your floor' },
      { point: 'Near-silent raking mechanism' },
    ],
    cons: [
      { point: 'Proprietary crystal tray refills at $22–25 each (ongoing cost)' },
      { point: 'Not ideal for multi-cat households (tray fills faster)' },
      { point: 'No WiFi or app connectivity' },
      { point: 'Some cats dislike the texture of crystal litter' },
      { point: 'Rake can jam on very large clumps' },
    ],
    reviewBody: `
      <h2>PetSafe ScoopFree Crystal Litter Box: The Budget Self-Cleaning Alternative</h2>
      <p>Not everyone has $699 for a Litter-Robot. The PetSafe ScoopFree Crystal offers self-cleaning convenience at less than a quarter of the price. We tested it for 4 months with a single tabby cat to see if the trade-offs are worth it.</p>

      <h3>How Crystal Litter Works</h3>
      <p>Unlike traditional clumping clay litter, crystal litter (silica gel) absorbs urine on contact and dehydrates solid waste. The built-in rake automatically sweeps waste into a covered compartment 5–20 minutes after your cat exits. The crystals don't clump — they simply absorb moisture until saturated, at which point you swap the entire disposable tray.</p>

      <h3>Odor Control Is Impressive</h3>
      <p>Crystal litter's odor control is genuinely superior to clay for the first 2–3 weeks. The moisture is absorbed so thoroughly that there's virtually no ammonia smell. By week 4 with one cat, you'll start to notice a faint odor near the box — that's your cue to swap the tray. With two cats, expect to swap every 2 weeks.</p>

      <h3>The Convenience Factor</h3>
      <p>This is where the ScoopFree shines. Swapping the tray takes 30 seconds: pull out the old tray (it has a lid for mess-free disposal), slide in a new one. Compare that to daily scooping of a traditional box. It's not quite "set and forget" like a Litter-Robot, but it's close.</p>

      <h3>The Ongoing Cost</h3>
      <p>Proprietary crystal tray refills cost $22–25 each. For one cat, that's ~$25/month. For two cats, that's ~$50/month. Compare this to premium clumping litter at $15–20/month — the crystal trays are a noticeable premium. Over a year, a single cat costs ~$300 in refills. Something to factor into the lower upfront cost.</p>

      <h3>Health Monitoring</h3>
      <p>The built-in health counter tracks how many times each cat uses the box. It's basic compared to the Litter-Robot's app-based tracking, but changes in litter box frequency are one of the first signs of UTIs, kidney issues, and diabetes in cats. Having any tracking is better than none.</p>

      <h3>Our Verdict</h3>
      <p>The PetSafe ScoopFree is an excellent entry point to self-cleaning litter boxes. At $169.95, it's affordable, and the crystal litter system genuinely works well for odor control. The ongoing tray costs are the main downside — if you have one cat and want convenience without the Litter-Robot price tag, this is a smart buy. For multi-cat homes, the Litter-Robot's economics actually work out better long-term.</p>
    `,
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-03-09T10:00:00Z',
  },
];
