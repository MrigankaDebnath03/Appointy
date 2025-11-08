// background service worker
console.log('Background service worker started');

// Check reminders every minute
setInterval(checkReminders, 60000);

async function checkReminders() {
  console.log('Checking for due reminders...');
  try {
    // Get all records with pending reminders
    const records = await window.db.getPendingReminders();
    const now = Date.now();
    
    for (const record of records) {
      if (record.remainderTime && record.remainderTime <= now) {
        // Show notification for due reminder
        chrome.notifications.create(`reminder-${record.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Context Reminder',
          message: record.context || record.title || 'Check your saved context',
          priority: 2
        });

        // Update record to mark reminder as shown
        await window.db.updateReminder(record.id, null);
      }
    }
  } catch (error) {
    console.error('Failed to check reminders:', error);
  }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('reminder-')) {
    const recordId = parseInt(notificationId.split('-')[1]);
    // Open the popup and highlight the record
    chrome.windows.create({
      url: chrome.runtime.getURL(`popup.html?record=${recordId}`),
      type: 'popup',
      width: 800,
      height: 600
    });
  }
});

// Mistral AI configuration
const MISTRAL_API_KEY = 'VGcaKfOvWKU919LBJQVWrSnfymCJO8VZ';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// NOTE: removed stray token line (was present as an unquoted token on its own
// which causes a SyntaxError and prevents the service worker from loading).

// Function to call Mistral AI for summarization
async function generateSummaryWithMistral(text, title, url) {
  try {
    // Prepare the prompt - limit text length for API constraints
    const contentToSummarize = text.length > 12000 ? text.substring(0, 12000) + '...' : text;
    
    const prompt = `Please provide a concise summary (2-3 paragraphs) of the following content. Focus on the main points and key information:

Title: ${title || 'No title'}
URL: ${url || 'No URL'}

Content:
${contentToSummarize}

Summary:`;

    console.log('Sending request to Mistral API...');
    
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-tiny',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral API error:', response.status, response.statusText, errorText);
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Mistral API response:', data);
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      throw new Error('Unexpected response format from Mistral API');
    }
  } catch (error) {
    console.error('Mistral AI summarization failed:', error);
    throw error; // Re-throw to handle in caller
  }
}

chrome.commands.onCommand.addListener((command) => {
  console.log('chrome.commands.onCommand received:', command);
  if (command !== 'take-screenshot') return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error('tabs.query error:', chrome.runtime.lastError);
      return;
    }
    if (!tabs || tabs.length === 0) {
      console.warn('No active tab');
      return;
    }
    const tab = tabs[0];

    // Helper to capture and open the capture window once we have text/title
    async function doCapture(pageText, pageTitle) {
      chrome.windows.getCurrent({}, (win) => {
        chrome.tabs.captureVisibleTab(win.id, { format: 'png' }, async (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error('captureVisibleTab failed:', chrome.runtime.lastError.message);
          }

          const captureObj = { 
            screenshot: dataUrl || null, 
            text: pageText || '', 
            url: tab.url || '', 
            title: pageTitle || tab.title || '', 
            summary: '' 
          };

          // Save the initial capture object
          chrome.storage.local.set({ current_capture: captureObj }, () => {
            if (chrome.runtime.lastError) console.error('storage.set error:', chrome.runtime.lastError.message);
            
            // Open capture UI immediately
            chrome.windows.create({ 
              url: chrome.runtime.getURL('capture.html'), 
              type: 'popup', 
              width: 700, 
              height: 800 
            }, () => {
              // Start async summarization in background if text present
              if (captureObj.text && captureObj.text.length > 100) {
                generateSummaryWithMistral(captureObj.text, captureObj.title, captureObj.url)
                  .then(summary => {
                    console.log('Auto-generated summary:', summary);
                    // Update the stored object with the summary
                    chrome.storage.local.get(['current_capture'], (res) => {
                      const cur = res.current_capture || {};
                      cur.summary = summary;
                      chrome.storage.local.set({ current_capture: cur }, () => {
                        if (chrome.runtime.lastError) console.error('storage.set error updating summary:', chrome.runtime.lastError.message);
                        // notify capture UI if it's listening
                        chrome.runtime.sendMessage({ type: 'summaryReady', summary });
                      });
                    });
                  })
                  .catch(err => {
                    console.warn('Auto-summarization failed:', err);
                    // Don't show error for auto-summarization, just leave it empty
                  });
              }
            });
          });
        });
      });
    }

    // Ask content script for the page text
    chrome.tabs.sendMessage(tab.id, { type: 'getText' }, (response) => {
      if (!chrome.runtime.lastError && response) {
        let pageText = '';
        let pageTitle = '';
        if (typeof response === 'string') {
          pageText = response;
        } else if (typeof response === 'object') {
          pageText = response.text || '';
          pageTitle = response.title || '';
        }
        doCapture(pageText, pageTitle);
        return;
      }

      // Fallback to executing script
      console.warn('Content script unavailable, falling back to executeScript');
      try {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Simple fallback text extraction
            const bodyText = document.body ? document.body.innerText : '';
            return { 
              text: bodyText.replace(/\s+/g, ' ').trim(), 
              title: document.title || '' 
            };
          }
        }, (injectionResults) => {
          if (chrome.runtime.lastError) {
            console.error('scripting.executeScript failed:', chrome.runtime.lastError.message);
            doCapture('', '');
            return;
          }
          if (injectionResults && injectionResults[0] && injectionResults[0].result) {
            const r = injectionResults[0].result;
            doCapture(r.text || '', r.title || '');
          } else {
            doCapture('', '');
          }
        });
      } catch (e) {
        console.error('executeScript exception', e);
        doCapture('', '');
      }
    });
  });
});

// Function to analyze images with Mistral AI
async function analyzeImageWithMistral(base64) {
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'pixtral-12b',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in detail.' },
            { type: 'image_url', image_url: base64 }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Mistral API error:', response.status, response.statusText, errorText);
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Accept runtime messages for summarization and image analysis
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'generateSummary') {
    chrome.storage.local.get(['current_capture'], async (r) => {
      const c = r.current_capture || {};
      if (!c.text) {
        sendResponse({ ok: false, error: 'no_text' });
        return;
      }
      try {
        const s = await generateSummaryWithMistral(c.text, c.title, c.url);
        c.summary = s;
        chrome.storage.local.set({ current_capture: c }, () => {
          chrome.runtime.sendMessage({ type: 'summaryReady', summary: s });
          sendResponse({ ok: true, summary: s });
        });
      } catch (e) {
        console.error('Summarization failed:', e);
        sendResponse({ ok: false, error: String(e) });
      }
    });
    return true;
  }

  if (msg.type === 'analyzeImage') {
    chrome.storage.local.get(['current_capture'], async (r) => {
      const c = r.current_capture || {};
      if (!c.screenshot) {
        sendResponse({ ok: false, error: 'no_screenshot' });
        return;
      }
      try {
        const desc = await analyzeImageWithMistral(c.screenshot);
        c.imageDescription = desc;
        chrome.storage.local.set({ current_capture: c }, () => {
          chrome.runtime.sendMessage({ type: 'imageAnalysisReady', description: desc });
          sendResponse({ ok: true, description: desc });
        });
      } catch (e) {
        console.error('Image analysis failed:', e);
        sendResponse({ ok: false, error: String(e) });
      }
    });
    return true;
  }
});

// When the user clicks the extension action (toolbar icon), open the full view
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('popup.html');
  try {
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find(t => t.url === url);
    if (existing) {
      await chrome.tabs.update(existing.id, { active: true });
      try { await chrome.windows.update(existing.windowId, { focused: true }); } catch(e) {}
    } else {
      await chrome.tabs.create({ url });
    }
  } catch (e) {
    chrome.tabs.create({ url });
  }
});