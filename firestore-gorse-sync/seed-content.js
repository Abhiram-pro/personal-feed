/**
 * Seed sample content into Firestore
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const SAMPLE_CONTENT = [
  {
    title: "The Future of AI in Creative Writing",
    excerpt: "Exploring how artificial intelligence is transforming the way we write and create content.",
    tags: ["technology", "ai", "writing"],
    url: "https://example.com/ai-writing",
    important: true,
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
  {
    title: "Whispers of the Wind: A Poetry Collection",
    excerpt: "Nature's subtle movements captured in verse.",
    tags: ["poetry", "nature"],
    url: "https://example.com/wind-poetry",
    important: false,
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  },
  {
    title: "Quantum Computing Breakthrough",
    excerpt: "Scientists achieve new milestone in quantum particle manipulation.",
    tags: ["science", "technology", "quantum"],
    url: "https://example.com/quantum-breakthrough",
    important: true,
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    title: "The Philosophy of Existence",
    excerpt: "Deep reflections on the meaning of life and consciousness.",
    tags: ["philosophy", "existentialism"],
    url: "https://example.com/philosophy-existence",
    important: false,
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  },
  {
    title: "Remote Work Revolution",
    excerpt: "How distributed teams are reshaping the future of work.",
    tags: ["technology", "work", "productivity"],
    url: "https://example.com/remote-work",
    important: false,
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
  {
    title: "Climate Action Summit 2025",
    excerpt: "Global leaders unite for environmental change.",
    tags: ["environment", "climate", "news"],
    url: "https://example.com/climate-summit",
    important: true,
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    title: "Midnight Reflections",
    excerpt: "A collection of poems about solitude and introspection.",
    tags: ["poetry", "introspection"],
    url: "https://example.com/midnight-reflections",
    important: false,
    publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  },
  {
    title: "Machine Learning for Beginners",
    excerpt: "A comprehensive guide to getting started with ML.",
    tags: ["technology", "ai", "education"],
    url: "https://example.com/ml-beginners",
    important: false,
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
  },
  {
    title: "The Art of Mindfulness",
    excerpt: "Finding peace in the present moment.",
    tags: ["philosophy", "wellness", "mindfulness"],
    url: "https://example.com/mindfulness",
    important: false,
    publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
  },
  {
    title: "Space Exploration Update",
    excerpt: "Latest discoveries from Mars rover mission.",
    tags: ["science", "space", "news"],
    url: "https://example.com/mars-update",
    important: true,
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
];

async function seedContent() {
  console.log('Starting content seeding...');
  
  const batch = db.batch();
  let count = 0;
  
  for (const content of SAMPLE_CONTENT) {
    const docRef = db.collection('content').doc();
    batch.set(docRef, {
      ...content,
      publishedAt: admin.firestore.Timestamp.fromDate(content.publishedAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  }
  
  await batch.commit();
  console.log(`✓ Seeded ${count} content items`);
  
  process.exit(0);
}

seedContent().catch(error => {
  console.error('Error seeding content:', error);
  process.exit(1);
});
