// contentScript.js - Improved text extraction
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'getText') {
    try {
      // Improved text extraction that gets cleaner text
      const getCleanText = () => {
        // Clone body to avoid modifying the original
        const clone = document.cloneNode(true);
        
        // Remove unwanted elements more aggressively
        const selectorsToRemove = [
          'script', 'style', 'nav', 'header', 'footer', 'aside',
          '.nav', '.header', '.footer', '.sidebar', '.ad', '.advertisement',
          '.menu', '.navigation', '.banner', '.popup', '.modal',
          '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
          '.social-share', '.comments', '.related-posts',
          'noscript', 'iframe', 'object', 'embed'
        ];
        
        selectorsToRemove.forEach(selector => {
          clone.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        // Also remove empty elements and hidden elements
        clone.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            el.remove();
          }
        });
        
        // Get text content with better formatting
        let text = clone.body ? clone.body.textContent || clone.body.innerText || '' : '';
        
        // Clean up the text - remove extra whitespace but preserve paragraphs
        text = text
          .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
          .replace(/[ \t]+/g, ' ')     // Collapse multiple spaces
          .trim();
        
        // Limit length to avoid performance issues but keep more text
        if (text.length > 100000) {
          text = text.substring(0, 100000) + '\n\n...[text truncated due to length]';
        }
        
        return text;
      };

      const text = getCleanText();
      const title = document.title || '';
      
      console.log('Content script extracted:', { // Debug log
        textLength: text.length,
        title: title
      });
      
      sendResponse({ text, title });
    } catch (e) {
      console.error('Text extraction error:', e);
      // Fallback to simple text extraction
      const text = document.body ? document.body.innerText || '' : '';
      const title = document.title || '';
      console.log('Fallback extraction:', { textLength: text.length, title });
      sendResponse({ text, title });
    }
    return true; // Indicates we'll respond asynchronously
  }
});