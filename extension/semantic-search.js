// semantic-search.js - Handles semantic search functionality using Mistral API
class SemanticSearch {
  constructor() {
    this.embeddings = {};  // Cache for document embeddings
    this.MISTRAL_API_KEY = 'VGcaKfOvWKU919LBJQVWrSnfymCJO8VZ'; // Using the same key as in background.js
  }

  async getEmbedding(text) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          input: text,
          model: "mistral-embed"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Failed to get embedding:', error);
      throw error;
    }
  }

  cosineSimilarity(vecA, vecB) {
    try {
      const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
      const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
      const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
      return dotProduct / (magA * magB);
    } catch (error) {
      console.error('Failed to calculate similarity:', error);
      return 0;
    }
  }

  async search(query, documents) {
    try {
      console.log('Starting semantic search for:', query);
      const queryEmbedding = await this.getEmbedding(query);
      
      const results = await Promise.all(documents.map(async doc => {
        try {
          const docText = `${doc.title || ''} ${doc.context || ''} ${doc.summary || ''} ${doc.tags?.join(' ') || ''}`.trim();
          
          if (!docText) {
            return { ...doc, similarity: 0 };
          }

          if (!this.embeddings[doc.id]) {
            this.embeddings[doc.id] = await this.getEmbedding(docText);
          }
          
          const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[doc.id]);
          return { ...doc, similarity };
        } catch (error) {
          console.error('Failed to process document:', doc.id, error);
          return { ...doc, similarity: 0 };
        }
      }));

      return results.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  clearCache() {
    this.embeddings = {};
  }
}

window.semanticSearch = new SemanticSearch();