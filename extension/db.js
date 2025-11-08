// Enhanced IndexedDB wrapper with semantic search
const DB_NAME = 'contexts_db_v3'; // Updated version for semantic search
const STORE_NAME = 'contexts';
const DB_VERSION = 3;

// Mistral AI configuration for embeddings
const MISTRAL_API_KEY = 'VGcaKfOvWKU919LBJQVWrSnfymCJO8VZ';
const MISTRAL_EMBEDDINGS_URL = 'https://api.mistral.ai/v1/embeddings';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('embedding', 'embedding', { unique: false });
        // Add index for reminders
        store.createIndex('remainderTime', 'remainderTime', { unique: false });
      }
      
      // Migrate existing data if needed
      if (e.oldVersion < 2) {
        const transaction = e.target.transaction;
        const store = transaction.objectStore(STORE_NAME);
        // Add new indexes if they don't exist
        if (!store.indexNames.contains('url')) {
          store.createIndex('url', 'url', { unique: false });
        }
        if (!store.indexNames.contains('title')) {
          store.createIndex('title', 'title', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Add timestamp if not present
    if (!record.savedAt) {
      record.savedAt = Date.now();
    }
    
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(Number(id));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(Number(id));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function searchRecords(query) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    
    req.onsuccess = () => {
      const allRecords = req.result;
      const lowerQuery = query.toLowerCase();
      
      const filtered = allRecords.filter(record => 
        (record.title && record.title.toLowerCase().includes(lowerQuery)) ||
        (record.context && record.context.toLowerCase().includes(lowerQuery)) ||
        (record.pageText && record.pageText.toLowerCase().includes(lowerQuery)) ||
        (record.summary && record.summary.toLowerCase().includes(lowerQuery)) ||
        (record.imageDescription && record.imageDescription.toLowerCase().includes(lowerQuery)) ||
        (record.url && record.url.toLowerCase().includes(lowerQuery))
      );
      
      resolve(filtered);
    };
    
    req.onerror = () => reject(req.error);
  });
}

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: 30,
  requests: [],
  maxRetries: 3,
  retryDelay: 2000 // 2 seconds
};

// Function to check rate limit
function checkRateLimit() {
  const now = Date.now();
  // Remove requests older than 1 minute
  RATE_LIMIT.requests = RATE_LIMIT.requests.filter(time => now - time < 60000);
  
  if (RATE_LIMIT.requests.length >= RATE_LIMIT.requestsPerMinute) {
    const oldestRequest = RATE_LIMIT.requests[0];
    const waitTime = 60000 - (now - oldestRequest);
    return waitTime > 0 ? waitTime : 0;
  }
  return 0;
}

// Function to generate embeddings using Mistral AI
async function generateEmbedding(text, retryCount = 0) {
  try {
    // Check rate limit
    const waitTime = checkRateLimit();
    if (waitTime > 0) {
      console.log(`Rate limit hit, waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Limit text length for embeddings
    const content = text.length > 8000 ? text.substring(0, 8000) + '...' : text;
    
    // Add request to rate limit tracking
    RATE_LIMIT.requests.push(Date.now());
    
    const response = await fetch(MISTRAL_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: [content]
      })
    });

    if (!response.ok) {
      if (response.status === 429 && retryCount < RATE_LIMIT.maxRetries) {
        // Rate limit hit, wait and retry
        console.log(`Rate limit hit (429), attempt ${retryCount + 1} of ${RATE_LIMIT.maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryDelay));
        return generateEmbedding(text, retryCount + 1);
      }
      throw new Error(`Embeddings API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    if (error.message.includes('429') && retryCount < RATE_LIMIT.maxRetries) {
      // Rate limit hit, wait and retry
      console.log(`Rate limit hit, attempt ${retryCount + 1} of ${RATE_LIMIT.maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryDelay));
      return generateEmbedding(text, retryCount + 1);
    }
    // Return a simple hash-based fallback embedding
    return generateFallbackEmbedding(text);
  }
}

// Simple fallback embedding using text characteristics
function generateFallbackEmbedding(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const embedding = new Array(128).fill(0);
  
  words.forEach(word => {
    const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = hash % 128;
    embedding[index] += 1;
  });
  
  const magnitude = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

// Cosine similarity calculation
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Semantic search using embeddings
async function semanticSearch(query, similarityThreshold = 0.3) {
  try {
    console.log('Starting semantic search for:', query);
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Get all records
    const allRecords = await getAllRecords();
    const results = [];
    
    // Collect records needing embeddings
    const recordsNeedingEmbeddings = [];
    for (const record of allRecords) {
      if (!record.embedding && record.searchableText) {
        recordsNeedingEmbeddings.push(record);
      }
    }

    // Generate embeddings in batches
    if (recordsNeedingEmbeddings.length > 0) {
      console.log(`Generating embeddings for ${recordsNeedingEmbeddings.length} records...`);
      for (const record of recordsNeedingEmbeddings) {
        // Generate embedding on-the-fly for existing records
        const recordEmbedding = await generateEmbedding(record.searchableText);
        
        // Cache the embedding in the database
        if (recordEmbedding) {
          record.embedding = recordEmbedding;
          await updateRecordEmbedding(record.id, recordEmbedding);
        }
      }
    }

    // Process all records
    for (const record of allRecords) {
      // Use existing or newly generated embedding
      let recordEmbedding = record.embedding;
      
      if (recordEmbedding) {
        const similarity = cosineSimilarity(queryEmbedding, recordEmbedding);
        
        if (similarity >= similarityThreshold) {
          results.push({
            ...record,
            similarity: similarity
          });
        }
      }
    }
    
    // Sort by similarity score (highest first)
    results.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`Semantic search found ${results.length} results`);
    return results;
    
  } catch (error) {
    console.error('Semantic search failed:', error);
    // Fall back to keyword search
    return searchRecords(query);
  }
}

// Update record with embedding
async function updateRecordEmbedding(id, embedding) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const getReq = store.get(Number(id));
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.embedding = embedding;
        const updateReq = store.put(record);
        updateReq.onsuccess = () => resolve();
        updateReq.onerror = () => reject(updateReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Hybrid search - combines keyword and semantic search
async function hybridSearch(query) {
  console.log('Performing hybrid search for:', query);
  
  const [keywordResults, semanticResults] = await Promise.all([
    searchRecords(query),
    semanticSearch(query)
  ]);
  
  // Combine and deduplicate results
  const combined = [...keywordResults, ...semanticResults];
  const seen = new Set();
  const uniqueResults = [];
  
  for (const result of combined) {
    const key = result.id;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }
  
  // Sort by relevance (keyword matches first, then semantic similarity)
  uniqueResults.sort((a, b) => {
    const aIsKeyword = keywordResults.some(r => r.id === a.id);
    const bIsKeyword = keywordResults.some(r => r.id === b.id);
    
    if (aIsKeyword && !bIsKeyword) return -1;
    if (!aIsKeyword && bIsKeyword) return 1;
    
    // Both are semantic results, sort by similarity
    if (a.similarity && b.similarity) {
      return b.similarity - a.similarity;
    }
    
    return 0;
  });
  
  return uniqueResults;
}

// Update record with a reminder
async function updateReminder(id, reminderTime) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const getReq = store.get(Number(id));
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.remainderTime = reminderTime;
        const updateReq = store.put(record);
        updateReq.onsuccess = () => resolve();
        updateReq.onerror = () => reject(updateReq.error);
      } else {
        reject(new Error('Record not found'));
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Get all records with pending reminders
async function getPendingReminders() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('remainderTime');
    const now = Date.now();
    
    const request = index.getAll(IDBKeyRange.lowerBound(now));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Export functions to global scope
window.db = { 
  addRecord, 
  getAllRecords, 
  getRecord, 
  deleteRecord, 
  searchRecords,
  semanticSearch,
  hybridSearch,
  generateEmbedding,
  updateReminder,
  getPendingReminders
};