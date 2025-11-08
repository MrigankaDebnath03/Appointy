// Enhanced IndexedDB wrapper with semantic search
const DB_NAME = 'contexts_db_v4';
const STORE_NAME = 'contexts';
const DB_VERSION = 4;

// Mistral AI configuration for embeddings
const MISTRAL_API_KEY = 'VGcaKfOvWKU919LBJQVWrSnfymCJO8VZ';
const MISTRAL_EMBEDDINGS_URL = 'https://api.mistral.ai/v1/embeddings';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      let store;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('embedding', 'embedding', { unique: false });
        store.createIndex('remainderTime', 'remainderTime', { unique: false });
        store.createIndex('searchableText', 'searchableText', { unique: false });
      } else {
        const transaction = e.target.transaction;
        store = transaction.objectStore(STORE_NAME);
      }
      
      // Migrate existing data
      if (e.oldVersion < 4) {
        if (!store.indexNames.contains('searchableText')) {
          store.createIndex('searchableText', 'searchableText', { unique: false });
        }
      }
      
      if (e.oldVersion < 2) {
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
  retryDelay: 2000
};

function checkRateLimit() {
  const now = Date.now();
  RATE_LIMIT.requests = RATE_LIMIT.requests.filter(time => now - time < 60000);
  
  if (RATE_LIMIT.requests.length >= RATE_LIMIT.requestsPerMinute) {
    const oldestRequest = RATE_LIMIT.requests[0];
    const waitTime = 60000 - (now - oldestRequest);
    return waitTime > 0 ? waitTime : 0;
  }
  return 0;
}

async function generateEmbedding(text, retryCount = 0) {
  try {
    const waitTime = checkRateLimit();
    if (waitTime > 0) {
      console.log(`Rate limit hit, waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const content = text.length > 8000 ? text.substring(0, 8000) + '...' : text;
    
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
      console.log(`Rate limit hit, attempt ${retryCount + 1} of ${RATE_LIMIT.maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryDelay));
      return generateEmbedding(text, retryCount + 1);
    }
    return generateFallbackEmbedding(text);
  }
}

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

async function semanticSearch(query, similarityThreshold = 0.3) {
  try {
    console.log('Starting semantic search for:', query);
    
    const queryEmbedding = await generateEmbedding(query);
    console.log('Query embedding generated, dimension:', queryEmbedding.length);
    
    const allRecords = await getAllRecords();
    console.log('Total records to search:', allRecords.length);
    
    const results = [];
    
    for (const record of allRecords) {
      let recordEmbedding = record.embedding;
      
      if (!recordEmbedding) {
        let searchableText = record.searchableText;
        
        if (!searchableText) {
          searchableText = [
            record.title,
            record.context,
            record.summary,
            record.imageDescription,
            record.tags?.join(' ')
          ].filter(Boolean).join(' ').trim();
        }
        
        if (searchableText && searchableText.length > 10) {
          console.log(`Generating embedding for record ${record.id}...`);
          
          try {
            recordEmbedding = await generateEmbedding(searchableText);
            record.embedding = recordEmbedding;
            record.searchableText = searchableText;
            await updateRecordEmbedding(record.id, recordEmbedding, searchableText);
          } catch (embError) {
            console.warn(`Failed to generate embedding for record ${record.id}:`, embError);
            continue;
          }
        } else {
          console.log(`Record ${record.id} has insufficient searchable text`);
          continue;
        }
      }
      
      if (recordEmbedding && recordEmbedding.length === queryEmbedding.length) {
        const similarity = cosineSimilarity(queryEmbedding, recordEmbedding);
        
        if (similarity >= similarityThreshold) {
          results.push({
            ...record,
            similarity: similarity
          });
        }
      } else {
        console.warn(`Embedding dimension mismatch for record ${record.id}`);
      }
    }
    
    results.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`Semantic search found ${results.length} results above threshold ${similarityThreshold}`);
    return results;
    
  } catch (error) {
    console.error('Semantic search failed:', error);
    console.log('Falling back to keyword search...');
    return searchRecords(query);
  }
}

async function updateRecordEmbedding(id, embedding, searchableText) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const getReq = store.get(Number(id));
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.embedding = embedding;
        if (searchableText) {
          record.searchableText = searchableText;
        }
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

async function hybridSearch(query) {
  console.log('Performing hybrid search for:', query);
  
  const [keywordResults, semanticResults] = await Promise.all([
    searchRecords(query),
    semanticSearch(query)
  ]);
  
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
  
  uniqueResults.sort((a, b) => {
    const aIsKeyword = keywordResults.some(r => r.id === a.id);
    const bIsKeyword = keywordResults.some(r => r.id === b.id);
    
    if (aIsKeyword && !bIsKeyword) return -1;
    if (!aIsKeyword && bIsKeyword) return 1;
    
    if (a.similarity && b.similarity) {
      return b.similarity - a.similarity;
    }
    
    return 0;
  });
  
  return uniqueResults;
}

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