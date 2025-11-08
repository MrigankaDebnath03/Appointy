// popup.js - render saved contexts as cards with improved search
document.addEventListener('DOMContentLoaded', async () => {
  const cards = document.getElementById('cards');
  const empty = document.getElementById('empty');
  const searchInput = document.getElementById('search-input');
  let searchType = document.getElementById('search-type');

  // Create search type selector if it doesn't exist
  if (!searchType) {
    const searchContainer = document.getElementById('search-container');
    const typeSelector = document.createElement('select');
    typeSelector.id = 'search-type';
    typeSelector.innerHTML = `
      <option value="hybrid">🔍 Smart Search</option>
      <option value="keyword">📝 Keyword Search</option>
      <option value="semantic">🧠 Semantic Search</option>
      <option value="tags">🏷️ Tags Search</option>
    `;
    typeSelector.style.marginTop = '8px';
    typeSelector.style.padding = '6px';
    typeSelector.style.borderRadius = '4px';
    typeSelector.style.border = '1px solid #ddd';
    searchContainer.appendChild(typeSelector);
    searchType = typeSelector;
  }

  // Add result count display
  let resultCount = document.getElementById('result-count');
  if (!resultCount) {
    resultCount = document.createElement('div');
    resultCount.id = 'result-count';
    resultCount.style.fontSize = '13px';
    resultCount.style.color = '#6c757d';
    resultCount.style.marginTop = '8px';
    resultCount.style.marginBottom = '8px';
    document.getElementById('search-container').appendChild(resultCount);
  }

  async function refresh(searchQuery = '', searchMethod = 'hybrid') {
    // Clear previous content
    cards.innerHTML = '';
    empty.style.display = 'none';
    resultCount.textContent = '';
    
    // Show loading state with spinner
    const loadingEl = document.createElement('div');
    loadingEl.className = 'search-loading';
    loadingEl.innerHTML = `
      <div style="display: inline-block; padding: 20px;">
        <div style="border: 3px solid #f3f3f3; border-top: 3px solid var(--vibrant-violet); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <p style="margin-top: 12px; color: var(--muted-text);">Searching...</p>
      </div>
    `;
    cards.appendChild(loadingEl);
    
    let list = [];
    let searchError = false;
    
    try {
      if (searchQuery.trim()) {
        switch (searchMethod) {
          case 'semantic':
            list = await window.db.semanticSearch(searchQuery);
            break;
          case 'keyword':
            list = await window.db.searchRecords(searchQuery);
            break;
          case 'tags':
            // Handle tag search
            const tagQuery = searchQuery.startsWith('#') ? searchQuery.slice(1) : searchQuery;
            list = (await window.db.getAllRecords()).filter(item => 
              item.tags && item.tags.some(tag => 
                tag.toLowerCase().includes(tagQuery.toLowerCase())
              )
            );
            break;
          case 'hybrid':
          default:
            // Include tags in hybrid search
            const hybridResults = await window.db.hybridSearch(searchQuery);
            const tagResults = (await window.db.getAllRecords()).filter(item =>
              item.tags && item.tags.some(tag =>
                tag.toLowerCase().includes(searchQuery.toLowerCase())
              )
            );
            // Combine and deduplicate results
            list = [...new Set([...hybridResults, ...tagResults])];
            break;
        }
      } else {
        list = await window.db.getAllRecords();
      }
    } catch (error) {
      console.error('Search failed:', error);
      searchError = true;
      cards.innerHTML = '';
      empty.style.display = 'block';
      empty.innerHTML = `
        <p>Search failed. Please try again.</p>
        <p style="font-size: 12px; color: #999; margin-top: 8px;">Error: ${error.message}</p>
      `;
      return;
    }

    // Clear loading state
    cards.innerHTML = '';

    if (list.length === 0) {
      empty.style.display = 'block';
      if (searchQuery.trim()) {
        empty.textContent = `No contexts match "${searchQuery}". Try different keywords or search type.`;
      } else {
        empty.textContent = 'No saved contexts yet. Press Alt+S on any page to capture.';
      }
      return;
    }

    // Show result count
    empty.style.display = 'none';
    if (searchQuery.trim()) {
      resultCount.textContent = `Found ${list.length} result${list.length === 1 ? '' : 's'} for "${searchQuery}"`;
    } else {
      resultCount.textContent = `Showing all ${list.length} context${list.length === 1 ? '' : 's'}`;
    }

    list.sort((a,b) => b.savedAt - a.savedAt);

    for (const item of list) {
      const card = document.createElement('div');
      card.className = 'card';

      // Add similarity indicator for semantic search results
      if (item.similarity !== undefined) {
        const similarityContainer = document.createElement('div');
        similarityContainer.className = 'similarity-text';
        
        const scoreText = document.createElement('div');
        scoreText.className = 'similarity-score';
        scoreText.textContent = `${Math.round(item.similarity * 100)}% match`;
        
        const barContainer = document.createElement('div');
        barContainer.className = 'similarity-bar';
        
        const barFill = document.createElement('div');
        barFill.className = 'similarity-bar-fill';
        barFill.style.width = `${item.similarity * 100}%`;
        
        barContainer.appendChild(barFill);
        similarityContainer.appendChild(scoreText);
        similarityContainer.appendChild(barContainer);
        card.appendChild(similarityContainer);
      }

      // Thumbnail image for the card (if screenshot available)
      if (item.screenshot) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'card-image';
        const thumb = document.createElement('img');
        thumb.src = item.screenshot;
        thumb.alt = item.title || 'screenshot';
        // let CSS handle fit/cover
        imgWrap.appendChild(thumb);
        card.appendChild(imgWrap);
      }

      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = item.context || item.title || 'Untitled Context';

      const meta = document.createElement('div');
      meta.className = 'card-meta';
      const when = new Date(item.savedAt).toLocaleString();
      const urlDisplay = item.url ? (new URL(item.url).hostname) : 'No URL';
      meta.textContent = `${when} — ${urlDisplay}`;

      // Add tags if available
      if (item.tags && item.tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        tagsContainer.style.marginTop = '8px';
        tagsContainer.style.display = 'flex';
        tagsContainer.style.flexWrap = 'wrap';
        tagsContainer.style.gap = '4px';

        item.tags.forEach(tag => {
          const tagEl = document.createElement('span');
          tagEl.className = 'tag';
          tagEl.textContent = tag;
          tagEl.style.background = '#e9ecef';
          tagEl.style.padding = '2px 8px';
          tagEl.style.borderRadius = '12px';
          tagEl.style.fontSize = '12px';
          tagEl.style.cursor = 'pointer';
          tagEl.addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.value = `#${tag}`;
            searchType.value = 'tags';
            refresh(searchInput.value, 'tags');
          });
          tagsContainer.appendChild(tagEl);
        });

        meta.appendChild(tagsContainer);
      }

      const excerpt = document.createElement('div');
      excerpt.className = 'card-excerpt';
      
      // Show summary if available, otherwise show page text excerpt
      let displayText = '';
      if (item.summary && item.summary.trim()) {
        displayText = item.summary;
      } else if (item.imageDescription && item.imageDescription.trim()) {
        displayText = 'Image Analysis: ' + item.imageDescription;
      } else if (item.pageText && item.pageText.trim()) {
        displayText = item.pageText;
      } else {
        displayText = 'No content available';
      }
      
      // Clean up the excerpt for display
      displayText = displayText.replace(/\s+/g, ' ').trim();
      excerpt.textContent = displayText.slice(0, 300) + (displayText.length > 300 ? '…' : '');

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View Details';
      viewBtn.addEventListener('click', () => showDetails(item));

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this context?')) return;
        try {
          await window.db.deleteRecord(item.id);
          await refresh(searchInput.value);
        } catch (error) {
          console.error('Failed to delete:', error);
          alert('Failed to delete context');
        }
      });

      actions.appendChild(viewBtn);
      actions.appendChild(delBtn);

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(excerpt);
      card.appendChild(actions);

      cards.appendChild(card);
    }
  }

  function showDetails(item) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const inner = document.createElement('div');
    inner.className = 'modal-inner';

    const h = document.createElement('h3');
    h.textContent = item.context || item.title || 'Context Details';
    inner.appendChild(h);

    // URL
    if (item.url) {
      const urlContainer = document.createElement('div');
      urlContainer.style.marginBottom = '12px';
      
      const urlLabel = document.createElement('strong');
      urlLabel.textContent = 'URL: ';
      urlLabel.style.display = 'inline-block';
      urlLabel.style.minWidth = '60px';
      
      const urlLink = document.createElement('a');
      urlLink.href = item.url;
      urlLink.textContent = item.url;
      urlLink.target = '_blank';
      urlLink.style.color = '#3498db';
      urlLink.style.textDecoration = 'none';
      
      urlContainer.appendChild(urlLabel);
      urlContainer.appendChild(urlLink);
      inner.appendChild(urlContainer);
    }

    // Screenshot
    if (item.screenshot) {
      const screenshotLabel = document.createElement('div');
      screenshotLabel.textContent = 'Screenshot:';
      screenshotLabel.style.fontWeight = 'bold';
      screenshotLabel.style.marginBottom = '8px';
      inner.appendChild(screenshotLabel);

      const img = document.createElement('img');
      img.src = item.screenshot;
      img.className = 'screenshot-small modal-screenshot';
      // constrain size so the full screenshot fits inside the modal without appearing "zoomed"
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.maxHeight = '60vh';
      img.style.objectFit = 'contain';
      img.style.borderRadius = '6px';
      img.style.border = '1px solid rgba(0,0,0,0.06)';
      img.style.marginBottom = '16px';
      inner.appendChild(img);
    }

    // AI Analysis Section (Summary + Image Analysis)
    if (item.summary || item.imageDescription) {
      const aiSection = document.createElement('div');
      aiSection.style.marginBottom = '20px';

      // AI Summary
      if (item.summary && item.summary.trim()) {
        const summaryLabel = document.createElement('div');
        summaryLabel.textContent = 'AI Summary:';
        summaryLabel.style.fontWeight = 'bold';
        summaryLabel.style.marginBottom = '8px';
        aiSection.appendChild(summaryLabel);

        const summaryArea = document.createElement('div');
        summaryArea.style.padding = '12px';
        summaryArea.style.background = '#f8f9fa';
        summaryArea.style.borderRadius = '4px';
        summaryArea.style.border = '1px solid #e9ecef';
        summaryArea.style.marginBottom = '16px';
        summaryArea.style.whiteSpace = 'pre-wrap';
        summaryArea.style.lineHeight = '1.5';
        summaryArea.textContent = item.summary;
        aiSection.appendChild(summaryArea);
      }

      // Image Analysis
      if (item.imageDescription && item.imageDescription.trim()) {
        const imageLabel = document.createElement('div');
        imageLabel.textContent = 'AI Image Analysis:';
        imageLabel.style.fontWeight = 'bold';
        imageLabel.style.marginBottom = '8px';
        imageLabel.style.marginTop = '16px';
        aiSection.appendChild(imageLabel);

        const imageAnalysisArea = document.createElement('div');
        imageAnalysisArea.style.padding = '12px';
        imageAnalysisArea.style.background = '#f0f7ff';
        imageAnalysisArea.style.borderRadius = '4px';
        imageAnalysisArea.style.border = '1px solid #cce5ff';
        imageAnalysisArea.style.marginBottom = '16px';
        imageAnalysisArea.style.whiteSpace = 'pre-wrap';
        imageAnalysisArea.style.lineHeight = '1.5';
        imageAnalysisArea.textContent = item.imageDescription;
        aiSection.appendChild(imageAnalysisArea);
      }

      inner.appendChild(aiSection);
    }

    // Page Text
    const textLabel = document.createElement('div');
    textLabel.textContent = 'Extracted Page Text:';
    textLabel.style.fontWeight = 'bold';
    textLabel.style.marginBottom = '8px';
    inner.appendChild(textLabel);

    const textArea = document.createElement('textarea');
    textArea.rows = 12;
    textArea.readOnly = true;
    textArea.style.width = '100%';
    textArea.style.padding = '10px';
    textArea.style.border = '1px solid #ddd';
    textArea.style.borderRadius = '4px';
    textArea.style.fontFamily = 'monospace';
    textArea.style.fontSize = '12px';
    textArea.style.resize = 'vertical';
    textArea.value = item.pageText || 'No page text available';
    inner.appendChild(textArea);

    // Context Notes
    if (item.context && item.context.trim()) {
      const contextLabel = document.createElement('div');
      contextLabel.textContent = 'Your Notes:';
      contextLabel.style.fontWeight = 'bold';
      contextLabel.style.marginTop = '16px';
      contextLabel.style.marginBottom = '8px';
      inner.appendChild(contextLabel);

      const contextArea = document.createElement('div');
      contextArea.style.padding = '10px';
      contextArea.style.background = '#fff3cd';
      contextArea.style.border = '1px solid #ffeaa7';
      contextArea.style.borderRadius = '4px';
      contextArea.style.marginBottom = '16px';
      contextArea.textContent = item.context;
      inner.appendChild(contextArea);
    }

    // Reminder section
    const reminderSection = document.createElement('div');
    reminderSection.className = 'reminder-section';
    reminderSection.style.marginTop = '16px';
    reminderSection.style.marginBottom = '16px';
    reminderSection.style.padding = '12px';
    reminderSection.style.background = '#f8f9fa';
    reminderSection.style.borderRadius = '4px';
    reminderSection.style.border = '1px solid #dee2e6';

    const reminderTitle = document.createElement('div');
    reminderTitle.style.fontWeight = 'bold';
    reminderTitle.style.marginBottom = '8px';
    reminderTitle.textContent = 'Set Reminder';
    reminderSection.appendChild(reminderTitle);

    const reminderInput = document.createElement('input');
    reminderInput.type = 'datetime-local';
    reminderInput.style.marginRight = '8px';
    reminderInput.style.padding = '4px 8px';
    reminderInput.style.borderRadius = '4px';
    reminderInput.style.border = '1px solid #ced4da';
    
    // Set current value if a reminder exists
    if (item.remainderTime) {
      const date = new Date(item.remainderTime);
      reminderInput.value = date.toISOString().slice(0, 16);
    }
    
    reminderSection.appendChild(reminderInput);

    const setReminderBtn = document.createElement('button');
    setReminderBtn.textContent = item.remainderTime ? 'Update Reminder' : 'Set Reminder';
    setReminderBtn.style.marginLeft = '8px';
    setReminderBtn.style.padding = '4px 12px';
    setReminderBtn.style.background = '#007bff';
    setReminderBtn.style.color = 'white';
    setReminderBtn.style.border = 'none';
    setReminderBtn.style.borderRadius = '4px';
    setReminderBtn.style.cursor = 'pointer';

    setReminderBtn.addEventListener('click', async () => {
      const timestamp = new Date(reminderInput.value).getTime();
      if (isNaN(timestamp)) {
        alert('Please select a valid date and time');
        return;
      }

      try {
        await window.db.updateReminder(item.id, timestamp);
        item.remainderTime = timestamp; // Update local item
        
        const statusMsg = document.createElement('div');
        statusMsg.style.marginTop = '8px';
        statusMsg.style.color = '#28a745';
        statusMsg.textContent = 'Reminder set successfully!';
        reminderSection.appendChild(statusMsg);
        
        // Remove status message after 3 seconds
        setTimeout(() => statusMsg.remove(), 3000);
      } catch (error) {
        console.error('Failed to set reminder:', error);
        alert('Failed to set reminder');
      }
    });

    reminderSection.appendChild(setReminderBtn);

    // Clear reminder button if one exists
    if (item.remainderTime) {
      const clearBtn = document.createElement('button');
      clearBtn.textContent = 'Clear Reminder';
      clearBtn.style.marginLeft = '8px';
      clearBtn.style.padding = '4px 12px';
      clearBtn.style.background = '#dc3545';
      clearBtn.style.color = 'white';
      clearBtn.style.border = 'none';
      clearBtn.style.borderRadius = '4px';
      clearBtn.style.cursor = 'pointer';

      clearBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear this reminder?')) {
          try {
            await window.db.updateReminder(item.id, null);
            item.remainderTime = null; // Update local item
            reminderInput.value = ''; // Clear input
            clearBtn.remove(); // Remove clear button
            setReminderBtn.textContent = 'Set Reminder';
            
            const statusMsg = document.createElement('div');
            statusMsg.style.marginTop = '8px';
            statusMsg.style.color = '#28a745';
            statusMsg.textContent = 'Reminder cleared!';
            reminderSection.appendChild(statusMsg);
            
            // Remove status message after 3 seconds
            setTimeout(() => statusMsg.remove(), 3000);
          } catch (error) {
            console.error('Failed to clear reminder:', error);
            alert('Failed to clear reminder');
          }
        }
      });

      reminderSection.appendChild(clearBtn);
    }

    inner.appendChild(reminderSection);

    // Current reminder display if exists
    if (item.remainderTime) {
      const currentReminder = document.createElement('div');
      currentReminder.style.marginTop = '8px';
      currentReminder.style.padding = '8px';
      currentReminder.style.background = '#d1ecf1';
      currentReminder.style.border = '1px solid #bee5eb';
      currentReminder.style.borderRadius = '4px';
      currentReminder.style.color = '#0c5460';
      
      try {
        const reminderDate = new Date(item.remainderTime);
        currentReminder.textContent = `Current reminder set for: ${reminderDate.toLocaleString()}`;
      } catch (e) {
        currentReminder.textContent = `Reminder: ${item.remainderTime}`;
      }
      reminderSection.appendChild(currentReminder);
    }

    // Tags Section
    if (item.tags && item.tags.length > 0) {
      const tagsSection = document.createElement('div');
      tagsSection.style.marginTop = '16px';
      tagsSection.style.marginBottom = '16px';

      const tagsLabel = document.createElement('div');
      tagsLabel.textContent = 'Tags:';
      tagsLabel.style.fontWeight = 'bold';
      tagsLabel.style.marginBottom = '8px';
      tagsSection.appendChild(tagsLabel);

      const tagsContainer = document.createElement('div');
      tagsContainer.style.display = 'flex';
      tagsContainer.style.flexWrap = 'wrap';
      tagsContainer.style.gap = '8px';

      item.tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.textContent = tag;
        tagEl.style.background = '#e9ecef';
        tagEl.style.padding = '4px 12px';
        tagEl.style.borderRadius = '16px';
        tagEl.style.fontSize = '14px';
        tagEl.style.cursor = 'pointer';
        tagEl.style.transition = 'background-color 0.2s';
        tagEl.addEventListener('mouseover', () => {
          tagEl.style.backgroundColor = '#dee2e6';
        });
        tagEl.addEventListener('mouseout', () => {
          tagEl.style.backgroundColor = '#e9ecef';
        });
        tagEl.addEventListener('click', () => {
          window.close();
          chrome.tabs.create({ url: chrome.runtime.getURL(`popup.html?tag=${encodeURIComponent(tag)}`) });
        });
        tagsContainer.appendChild(tagEl);
      });

      tagsSection.appendChild(tagsContainer);
      inner.appendChild(tagsSection);
    }

    // Saved timestamp
    const savedInfo = document.createElement('div');
    savedInfo.style.marginTop = '12px';
    savedInfo.style.fontSize = '12px';
    savedInfo.style.color = '#6c757d';
    savedInfo.textContent = `Saved: ${new Date(item.savedAt).toLocaleString()}`;
    inner.appendChild(savedInfo);

    const close = document.createElement('button');
    close.textContent = 'Close';
    close.style.marginTop = '16px';
    close.style.padding = '10px 20px';
    close.style.background = '#6c757d';
    close.style.color = 'white';
    close.style.border = 'none';
    close.style.borderRadius = '4px';
    close.style.cursor = 'pointer';
    close.addEventListener('click', () => modal.remove());
    inner.appendChild(close);

    modal.appendChild(inner);
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Search functionality
  let searchTimeout;
  function performSearch() {
    const query = searchInput.value;
    const method = searchType ? searchType.value : 'hybrid';
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      refresh(query, method);
    }, 400);
  }

  searchInput.addEventListener('input', performSearch);
  
  if (searchType) {
    searchType.addEventListener('change', performSearch);
  }

  // Add search examples
  const searchContainer = document.getElementById('search-container');
  const examples = document.createElement('div');
  examples.id = 'search-examples';
  examples.style.marginTop = '8px';
  examples.style.fontSize = '12px';
  examples.style.color = '#6c757d';
  examples.innerHTML = `
    <div>Try: "programming tutorials" • "research papers about AI" • "#technology" • "my notes from last week"</div>
    <div style="margin-top:4px">Use # to search by tags (e.g., #coding)</div>
  `;
  searchContainer.appendChild(examples);

  // Initial load
  await refresh();
});