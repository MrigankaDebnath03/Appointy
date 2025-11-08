// capture.js - populates capture.html from chrome.storage and saves records via db
document.addEventListener('DOMContentLoaded', async () => {
  const screenshotWrapper = document.getElementById('screenshot-wrapper');
  const pageTextEl = document.getElementById('page-text');
  const pageTitleEl = document.getElementById('page-title');
  const summaryEl = document.getElementById('summary-text');
  const imageDescEl = document.getElementById('image-description');
  const contextInput = document.getElementById('context-input');
  const remainderInput = document.getElementById('remainder');
  const generateBtn = document.getElementById('generate-summary');
  const analyzeBtn = document.getElementById('analyze-image');
  const summaryStatus = document.getElementById('summary-status');
  const imageStatus = document.getElementById('image-status');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const statusEl = document.getElementById('status');

  const res = await new Promise((resolve) => chrome.storage.local.get(['current_capture'], resolve));
  const current = res.current_capture || {};

  console.log('Current capture data:', current); // Debug log

  // Extract text and title properly
  let extractedText = '';
  let pageTitle = current.title || '';

  if (current.text) {
    if (typeof current.text === 'string') {
      extractedText = current.text;
    } else if (typeof current.text === 'object' && current.text.text) {
      extractedText = current.text.text;
      pageTitle = current.text.title || pageTitle;
    }
  }

  // If we still don't have a title, try to get it from the tab
  if (!pageTitle && current.title) {
    pageTitle = current.title;
  }

  // Display screenshot
  if (current.screenshot) {
    const img = document.createElement('img');
    img.src = current.screenshot;
    img.alt = 'screenshot';
    img.className = 'screenshot';
    screenshotWrapper.appendChild(img);
  } else {
    const p = document.createElement('p');
    p.textContent = 'No screenshot available.';
    p.style.color = '#666';
    p.style.fontStyle = 'italic';
    screenshotWrapper.appendChild(p);
  }

  // Display extracted data
  pageTextEl.value = extractedText || 'No text could be extracted from this page.';
  pageTitleEl.textContent = pageTitle || 'No title available';
  
  if (summaryEl) {
    summaryEl.value = current.summary || '';
  }
  
  if (summaryStatus) {
    summaryStatus.textContent = current.summary ? 'Ready' : 'Not generated';
  }
  
  if (imageDescEl) {
    imageDescEl.value = current.imageDescription || '';
  }
  
  if (imageStatus) {
    imageStatus.textContent = current.imageDescription ? 'Ready' : current.screenshot ? 'Analyzing...' : 'No image';
  }

  // Save functionality
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    statusEl.textContent = 'Saving...';
    statusEl.className = 'status';

    const record = {
      screenshot: current.screenshot || null,
      pageText: extractedText || '',
      url: current.url || '',
      title: pageTitle || '',
      context: contextInput.value.trim() || '',
      summary: summaryEl ? summaryEl.value.trim() : '',
      imageDescription: imageDescEl ? imageDescEl.value.trim() : '',
      remainderTime: remainderInput.value || null,
      savedAt: Date.now()
    };

    console.log('Saving record:', { // Debug log
      pageTextLength: record.pageText.length,
      title: record.title,
      url: record.url
    });

    try {
      const recordId = await window.db.addRecord(record);
      console.log('Saved with ID:', recordId); // Debug log
      
      statusEl.textContent = 'Saved successfully!';
      statusEl.className = 'status success';
      
      // Clear temporary storage and close
      chrome.storage.local.remove('current_capture', () => {
        setTimeout(() => {
          window.close();
        }, 1000);
      });
    } catch (e) {
      console.error('Failed to save', e);
      statusEl.textContent = 'Failed to save: ' + (e && e.message ? e.message : e);
      statusEl.className = 'status error';
      saveBtn.disabled = false;
    }
  });

  // Analyze image functionality
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      if (!current.screenshot) {
        alert('No screenshot available to analyze.');
        return;
      }

      analyzeBtn.disabled = true;
      if (imageStatus) imageStatus.textContent = 'Analyzing image with AI...';
      
      chrome.runtime.sendMessage({ type: 'analyzeImage' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('analyzeImage message failed:', chrome.runtime.lastError.message);
          if (imageStatus) imageStatus.textContent = 'Failed to request analysis';
          analyzeBtn.disabled = false;
          return;
        }
        
        if (response && !response.ok) {
          console.error('Image analysis failed:', response.error);
          if (imageStatus) imageStatus.textContent = 'Failed: ' + response.error;
          analyzeBtn.disabled = false;
        }
      });
    });
  }

  // Generate summary functionality
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      if (!extractedText || extractedText.length < 50) {
        alert('Not enough text available to generate a summary. Please ensure the page has sufficient content.');
        return;
      }

      generateBtn.disabled = true;
      if (summaryStatus) summaryStatus.textContent = 'Generating summary with Mistral AI...';
      
      chrome.runtime.sendMessage({ type: 'generateSummary' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('generateSummary message failed:', chrome.runtime.lastError.message);
          if (summaryStatus) summaryStatus.textContent = 'Failed to request summary';
          generateBtn.disabled = false;
          return;
        }
        
        // Handle the response from background
        if (response && !response.ok) {
          console.error('Summarization failed:', response.error);
          if (summaryStatus) summaryStatus.textContent = 'Failed: ' + response.error;
          generateBtn.disabled = false;
        }
      });
    });
  }

  // Listen for storage changes to update the summary
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.current_capture && changes.current_capture.newValue) {
      const nc = changes.current_capture.newValue;
      if (summaryEl && typeof nc.summary === 'string') {
        summaryEl.value = nc.summary;
        if (summaryStatus) summaryStatus.textContent = 'Summary generated!';
      }
      if (generateBtn) generateBtn.disabled = false;
    }
  });

  // Listen for runtime messages for immediate updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    
    if (msg.type === 'summaryReady') {
      if (summaryEl) {
        summaryEl.value = msg.summary || '';
        if (summaryStatus) summaryStatus.textContent = 'Summary generated!';
      }
      if (generateBtn) generateBtn.disabled = false;
    }
    
    if (msg.type === 'imageAnalysisReady') {
      if (imageDescEl) {
        imageDescEl.value = msg.description || '';
        if (imageStatus) imageStatus.textContent = 'Analysis complete!';
      }
      if (analyzeBtn) analyzeBtn.disabled = false;
    }
  });

  // Cancel functionality
  cancelBtn.addEventListener('click', () => {
    chrome.storage.local.remove('current_capture', () => window.close());
  });

  // Set default reminder time to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowString = tomorrow.toISOString().slice(0, 16);
  remainderInput.value = tomorrowString;

  // Focus context input for quick note-taking
  contextInput.focus();
});