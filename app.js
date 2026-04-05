/**
 * GitHub Repository Showcase Application
 * Modern, interactive web application for displaying GitHub repositories
 */

// Browser compatibility: Define process if it doesn't exist
if (typeof process === 'undefined') {
  window.process = {
    env: {},
    browser: true
  };
}

class GitHubShowcase {
  constructor() {
    this.state = {
      repositories: [],
      filteredRepositories: [],
      searchTerm: '',
      selectedLanguage: '',
      sortBy: 'recent-likes',
      sortOrder: 'desc',
      isLoading: true,
      languages: [],
      error: null,
      languageCategory: 'recently'
    };

    this.elements = {};
    this.debounceTimer = null;
    this.animationFrame = null;
    this.intersectionObserver = null;
    this.mutationObserver = null;
    this.languageOrder = {};
    this.lastVisibilityChange = Date.now();

    // Incremental loading
    this.initialDisplayCount = 24;
    this.loadMoreCount = 24;
    this.visibleCount = 24;

    this.performanceMetrics = {
      loadStartTime: performance.now(),
      searchTimes: [],
      renderTimes: []
    };
  }

  async init() {
    try {
      this.cacheElements();
      this.bindEvents();
      this.initializeAnimations();
      this.initializeAccessibility();
      this.initializeOptimizations();
      await this.loadData();
      this.render();
      this.initializeScrollAnimations();
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.handleError(error);
    }
  }

  cacheElements() {
    this.elements = {
      searchInput: document.getElementById('searchInput'),
      searchClear: document.getElementById('searchClear'),
      languageFilter: document.getElementById('languageFilter'),
      sortSelect: document.getElementById('sortSelect'),
      repositoryGrid: document.getElementById('repositoryGrid'),
      loadingState: document.getElementById('loadingState'),
      emptyState: document.getElementById('emptyState'),
      errorState: document.getElementById('errorState'),
      statsBar: document.getElementById('statsBar'),
      totalCount: document.getElementById('totalCount'),
      filteredCount: document.getElementById('filteredCount'),
      languageCount: document.getElementById('languageCount'),
      resetFilters: document.getElementById('resetFilters'),
      retryButton: document.getElementById('retryButton'),
      quickFilters: document.getElementById('quickFilters'),
      quickFilterButtons: document.getElementById('quickFilterButtons'),
      categorizationButtons: document.querySelectorAll('.categorization-btn'),
      loadControls: document.getElementById('loadControls'),
      loadStatus: document.getElementById('loadStatus'),
      loadMoreButton: document.getElementById('loadMoreButton')
    };
  }

  bindEvents() {
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }

    if (this.elements.searchClear) {
      this.elements.searchClear.addEventListener('click', () => {
        this.clearSearch();
      });
    }

    if (this.elements.languageFilter) {
      this.elements.languageFilter.addEventListener('change', (e) => {
        this.handleLanguageFilter(e.target.value);
      });
    }

    if (this.elements.sortSelect) {
      this.elements.sortSelect.addEventListener('change', (e) => {
        this.handleSort(e.target.value);
      });
    }

    if (this.elements.resetFilters) {
      this.elements.resetFilters.addEventListener('click', () => {
        this.resetFilters();
      });
    }

    if (this.elements.retryButton) {
      this.elements.retryButton.addEventListener('click', () => {
        this.retry();
      });
    }

    if (this.elements.categorizationButtons) {
      this.elements.categorizationButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const target = e.currentTarget;
          this.handleCategorization(target.getAttribute('data-category'));
        });
      });
    }

    if (this.elements.loadMoreButton) {
      this.elements.loadMoreButton.addEventListener('click', () => {
        this.handleLoadMore();
      });
    }

    document.addEventListener('keydown', (e) => {
      this.handleKeyboardNavigation(e);
    });
  }

  async loadData() {
    try {
      this.setState({ isLoading: true, error: null });
      this.updateLoadingProgress(10, true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('data.json', {
        signal: controller.signal,
        cache: 'default'
      });

      clearTimeout(timeoutId);
      this.updateLoadingProgress(30, true);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.updateLoadingProgress(60, true);

      const repositories = this.processRepositoryData(data);
      this.updateLoadingProgress(80, true);

      const languages = this.extractLanguages(repositories);
      this.updateLoadingProgress(90, true);

      this.resetVisibleCount();
      this.setState({
        repositories,
        filteredRepositories: repositories,
        languages,
        isLoading: false
      });

      this.populateLanguageFilter(languages);
      this.populateQuickFilters();

      this.updateLoadingProgress(100, true);

      setTimeout(() => {
        this.updateLoadingProgress(0, false);
      }, 500);
    } catch (error) {
      console.error('Error loading data:', error);
      this.updateLoadingProgress(0, false);

      let errorMessage = 'Failed to load repository data';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message && error.message.includes('HTTP error')) {
        errorMessage = 'Server error. Please try again later.';
      }

      this.setState({
        isLoading: false,
        error: errorMessage
      });

      this.showToast('Failed to load repository data', 'error');
      throw error;
    }
  }

  processRepositoryData(data) {
    const repositories = [];
    let originalIndex = 0;
    const languageOrder = {};
    let languageOrderIndex = 0;

    if (Array.isArray(data)) {
      repositories.push(...data);
    } else if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(language => {
        if (languageOrder[language] === undefined) {
          languageOrder[language] = languageOrderIndex++;
        }

        const languageRepos = data[language];
        if (Array.isArray(languageRepos)) {
          repositories.push(...languageRepos);
        }
      });
    }

    this.languageOrder = languageOrder;

    return repositories
      .filter(repo => repo && repo.id && repo.name)
      .map(repo => ({
        ...repo,
        description: repo.description || '',
        stargazers_count: repo.stargazers_count || 0,
        language: repo.language || 'Unknown',
        topics: Array.isArray(repo.topics) ? repo.topics : [],
        created_at: repo.created_at || new Date().toISOString(),
        updated_at: repo.updated_at || new Date().toISOString(),
        owner: repo.owner || {
          login: 'unknown',
          html_url: '#',
          avatar_url: this.getDefaultAvatar()
        },
        homepage: repo.homepage || '',
        html_url: repo.html_url || '#',
        full_name: repo.full_name || repo.name,
        originalIndex: originalIndex++,
        searchText: this.createSearchText(repo),
        formattedStars: this.formatNumber(repo.stargazers_count || 0),
        relativeTime: this.getRelativeTime(repo.updated_at || new Date().toISOString()),
        languageColor: this.getLanguageColor(repo.language || 'Unknown')
      }));
  }

  createSearchText(repo) {
    return [
      repo.name,
      repo.full_name,
      repo.description,
      repo.language,
      ...(repo.topics || []),
      repo.owner?.login
    ].filter(Boolean).join(' ').toLowerCase();
  }

  extractLanguages(repositories) {
    const languageSet = new Set();
    repositories.forEach(repo => {
      if (repo.language && repo.language !== 'Unknown') {
        languageSet.add(repo.language);
      }
    });
    return Array.from(languageSet).sort();
  }

  populateLanguageFilter(languages) {
    if (!this.elements.languageFilter) return;

    const fragment = document.createDocumentFragment();
    const languageCounts = this.calculateLanguageCounts();

    const sortedLanguages = [...languages].sort((a, b) => {
      const countA = languageCounts[a] || 0;
      const countB = languageCounts[b] || 0;
      if (countA !== countB) return countB - countA;
      return a.localeCompare(b);
    });

    sortedLanguages.forEach(language => {
      const option = document.createElement('option');
      option.value = language;
      const count = languageCounts[language] || 0;
      option.textContent = `${language} (${count})`;
      option.setAttribute('data-count', count);
      fragment.appendChild(option);
    });

    while (this.elements.languageFilter.children.length > 1) {
      this.elements.languageFilter.removeChild(this.elements.languageFilter.lastChild);
    }

    this.elements.languageFilter.appendChild(fragment);
  }

  calculateLanguageCounts() {
    const counts = {};
    this.state.repositories.forEach(repo => {
      const language = repo.language || 'Unknown';
      counts[language] = (counts[language] || 0) + 1;
    });
    return counts;
  }

  getLanguagesForQuickFilters(limit = 6) {
    const languageCounts = this.calculateLanguageCounts();
    const { languageCategory } = this.state;

    if (languageCategory === 'recently') {
      return Object.keys(languageCounts)
        .sort((langA, langB) => {
          const orderA = this.languageOrder[langA] ?? 999;
          const orderB = this.languageOrder[langB] ?? 999;
          return orderA - orderB;
        })
        .slice(0, limit);
    }

    return Object.entries(languageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([language]) => language);
  }

  populateQuickFilters() {
    if (!this.elements.quickFilters || !this.elements.quickFilterButtons) return;

    const languages = this.getLanguagesForQuickFilters(6);
    const languageCounts = this.calculateLanguageCounts();
    const { languageCategory } = this.state;

    if (languages.length === 0) {
      this.elements.quickFilters.style.display = 'none';
      return;
    }

    const label = this.elements.quickFilters.querySelector('.quick-filters-label');
    if (label) {
      label.textContent = languageCategory === 'recently' ? 'Recently:' : 'Popular:';
    }

    const fragment = document.createDocumentFragment();

    languages.forEach(language => {
      const button = document.createElement('button');
      button.className = 'quick-filter-btn';
      button.setAttribute('data-language', language);
      button.innerHTML = `
        <span class="language-dot ${language.toLowerCase()}" style="background-color: ${this.getLanguageColor(language)}"></span>
        <span>${language}</span>
        <span class="quick-filter-count">${languageCounts[language] || 0}</span>
      `;

      button.addEventListener('click', () => {
        this.handleQuickFilter(language);
      });

      fragment.appendChild(button);
    });

    this.elements.quickFilterButtons.innerHTML = '';
    this.elements.quickFilterButtons.appendChild(fragment);
    this.elements.quickFilters.style.display = 'flex';
  }

  handleQuickFilter(language) {
    if (this.elements.languageFilter) {
      this.elements.languageFilter.value = language;
    }

    if (this.elements.quickFilterButtons) {
      this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-language') === language;
        btn.classList.toggle('active', isActive);

        if (isActive) {
          btn.style.animation = 'none';
          btn.offsetHeight;
          btn.style.animation = 'activeFilter 0.3s ease-out';
        }
      });
    }

    this.handleLanguageFilter(language);

    const resultCount = this.state.filteredRepositories.length;
    this.showToast(`🎉 Found ${resultCount} repositories matching "${language}"`, 'success', 1000);
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };

    if (
      newState.hasOwnProperty('repositories') ||
      newState.hasOwnProperty('searchTerm') ||
      newState.hasOwnProperty('selectedLanguage')
    ) {
      this.updateFilteredRepositories();
    }

    if (newState.hasOwnProperty('sortBy') || newState.hasOwnProperty('sortOrder')) {
      this.sortRepositories();
    }
  }

  updateFilteredRepositories() {
    let filtered = [...this.state.repositories];

    if (this.state.searchTerm) {
      filtered = this.performAdvancedSearch(filtered, this.state.searchTerm);
    }

    if (this.state.selectedLanguage) {
      filtered = filtered.filter(repo => repo.language === this.state.selectedLanguage);
    }

    this.state.filteredRepositories = filtered;
    this.sortRepositories();
  }

  sortRepositories() {
    const { sortBy } = this.state;

    this.state.filteredRepositories.sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return b.stargazers_count - a.stargazers_count;
        case 'recent-likes':
          return (a.originalIndex || 0) - (b.originalIndex || 0);
        case 'stars-asc':
          return a.stargazers_count - b.stargazers_count;
        case 'name':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'name-desc':
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        case 'updated':
          return new Date(b.updated_at) - new Date(a.updated_at);
        case 'created':
          return new Date(b.created_at) - new Date(a.created_at);
        default:
          return b.stargazers_count - a.stargazers_count;
      }
    });
  }

  handleSearch(searchTerm) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.elements.searchClear) {
      this.elements.searchClear.classList.toggle('visible', searchTerm.length > 0);
    }

    if (searchTerm.trim() === '') {
      this.resetVisibleCount();
      this.setState({ searchTerm: '' });
      if (this.elements.searchInput) {
        this.elements.searchInput.classList.remove('searching');
      }
      this.render();
      return;
    }

    if (this.elements.searchInput) {
      this.elements.searchInput.classList.add('searching');
    }

    const searchStart = performance.now();

    this.debounceTimer = setTimeout(() => {
      this.resetVisibleCount();
      this.setState({ searchTerm: searchTerm.trim() });

      if (this.elements.searchInput) {
        this.elements.searchInput.classList.remove('searching');
      }

      this.render();

      const resultCount = this.state.filteredRepositories.length;
      this.showToast(`🎉 Found ${resultCount} repositories matching "${searchTerm.trim()}"`, 'success', 1000);
      this.trackSearch(searchTerm.trim());

      const searchTime = performance.now() - searchStart;
      this.performanceMetrics.searchTimes.push(searchTime);
      if (this.performanceMetrics.searchTimes.length > 10) {
        this.performanceMetrics.searchTimes.shift();
      }
    }, 300);
  }

  performAdvancedSearch(repositories, searchTerm) {
    if (!searchTerm) return repositories;

    const terms = searchTerm.toLowerCase().split(/\s+/).filter(term => term.length > 0);

    return repositories
      .filter(repo => {
        let score = 0;
        const searchableText = repo.searchText || '';

        const hasAllTerms = terms.every(term => searchableText.includes(term));
        if (!hasAllTerms) return false;

        terms.forEach(term => {
          if ((repo.name || '').toLowerCase().includes(term)) score += 10;
          if ((repo.description || '').toLowerCase().includes(term)) score += 5;
          if ((repo.topics || []).some(topic => topic.toLowerCase().includes(term))) score += 8;
          if ((repo.language || '').toLowerCase().includes(term)) score += 6;
          if ((repo.owner?.login || '').toLowerCase().includes(term)) score += 4;
        });

        repo.searchScore = score;
        return score > 0;
      })
      .sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
  }

  trackSearch(searchTerm) {
    console.log('Search performed:', searchTerm);
  }

  clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
      this.elements.searchInput.classList.remove('searching');
    }
    if (this.elements.searchClear) {
      this.elements.searchClear.classList.remove('visible');
    }
    this.resetVisibleCount();
    this.setState({ searchTerm: '' });
    this.render();
  }

  handleLanguageFilter(language) {
    this.resetVisibleCount();
    this.setState({ selectedLanguage: language });

    if (this.elements.quickFilterButtons) {
      this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-language') === language);
      });
    }

    this.render();
  }

  handleSort(sortBy) {
    this.resetVisibleCount();
    this.setState({ sortBy });
    this.render();
  }

  resetFilters() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    if (this.elements.searchClear) {
      this.elements.searchClear.classList.remove('visible');
    }
    if (this.elements.languageFilter) {
      this.elements.languageFilter.value = '';
    }
    if (this.elements.sortSelect) {
      this.elements.sortSelect.value = 'recent-likes';
    }

    if (this.elements.quickFilterButtons) {
      this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
    }

    if (this.elements.categorizationButtons) {
      this.elements.categorizationButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-category') === 'recently');
      });
    }

    this.resetVisibleCount();

    this.setState({
      searchTerm: '',
      selectedLanguage: '',
      sortBy: 'recent-likes',
      languageCategory: 'recently'
    });

    this.populateQuickFilters();
    this.render();
  }

  async retry() {
    try {
      await this.loadData();
      this.render();
    } catch (error) {
      // handled in loadData
    }
  }

  handleCategorization(category) {
    if (this.elements.categorizationButtons) {
      this.elements.categorizationButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-category') === category);
      });
    }

    this.resetVisibleCount();
    this.setState({ languageCategory: category });
    this.populateQuickFilters();
    this.render();

    console.log('Language categorization changed:', category);
  }

  handleError(error) {
    this.setState({
      error: error.message || 'An unexpected error occurred',
      isLoading: false
    });
    this.render();
  }

  resetVisibleCount() {
    this.visibleCount = this.initialDisplayCount;
  }

  handleLoadMore() {
    this.visibleCount += this.loadMoreCount;
    this.render();
  }

  render() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (!this.state.isLoading) {
      this.animateFiltering();
    }

    this.animationFrame = requestAnimationFrame(() => {
      const renderStart = performance.now();

      this.updateUI();
      this.animateStatsUpdate();

      const renderTime = performance.now() - renderStart;
      this.performanceMetrics.renderTimes.push(renderTime);
      if (this.performanceMetrics.renderTimes.length > 10) {
        this.performanceMetrics.renderTimes.shift();
      }

      setTimeout(() => {
        this.updateAriaLabels();
        this.announceSearchResults();
      }, 100);
    });
  }

  updateUI() {
    const { isLoading, error, filteredRepositories } = this.state;

    this.updateStatistics();

    if (this.elements.loadingState) {
      this.elements.loadingState.style.display = isLoading ? 'flex' : 'none';
    }
    if (this.elements.errorState) {
      this.elements.errorState.style.display = error ? 'flex' : 'none';
    }
    if (this.elements.emptyState) {
      this.elements.emptyState.style.display =
        !isLoading && !error && filteredRepositories.length === 0 ? 'flex' : 'none';
    }
    if (this.elements.repositoryGrid) {
      this.elements.repositoryGrid.style.display =
        !isLoading && !error && filteredRepositories.length > 0 ? 'grid' : 'none';
    }
    if (this.elements.statsBar) {
      this.elements.statsBar.style.display = !isLoading && !error ? 'block' : 'none';
    }
    if (this.elements.loadControls) {
      this.elements.loadControls.style.display =
        !isLoading && !error && filteredRepositories.length > 0 ? 'block' : 'none';
    }

    if (isLoading) {
      this.renderSkeletonCards();
    } else if (!error && filteredRepositories.length > 0) {
      this.renderRepositories();
    } else if (this.elements.repositoryGrid) {
      this.elements.repositoryGrid.innerHTML = '';
    }
  }

  renderSkeletonCards() {
    if (!this.elements.repositoryGrid) return;

    this.elements.repositoryGrid.innerHTML = '';
    this.elements.repositoryGrid.className = 'repository-grid skeleton-grid';
    this.elements.repositoryGrid.style.display = 'grid';

    const skeletonCards = this.createSkeletonCards(9);
    this.elements.repositoryGrid.appendChild(skeletonCards);
  }

  updateStatistics() {
    const { repositories, filteredRepositories, languages } = this.state;

    if (this.elements.totalCount) {
      this.elements.totalCount.textContent = this.formatNumber(repositories.length);
    }
    if (this.elements.filteredCount) {
      this.elements.filteredCount.textContent = this.formatNumber(filteredRepositories.length);
    }
    if (this.elements.languageCount) {
      this.elements.languageCount.textContent = languages.length;
    }
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 }
    ];

    for (const interval of intervals) {
      const count = Math.floor(diffInSeconds / interval.seconds);
      if (count >= 1) {
        return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
      }
    }

    return 'Just now';
  }

  getLanguageColor(language) {
    const colors = {
      'TypeScript': '#3178c6',
      'JavaScript': '#f1e05a',
      'Python': '#3572a5',
      'Java': '#b07219',
      'HTML': '#e34c26',
      'CSS': '#563d7c',
      'SCSS': '#c6538c',
      'Vue': '#4fc08d',
      'Go': '#00add8',
      'Rust': '#dea584',
      'PHP': '#4f5d95',
      'Ruby': '#701516',
      'Swift': '#fa7343',
      'Kotlin': '#a97bff',
      'Dart': '#00b4ab',
      'Shell': '#89e051',
      'Dockerfile': '#384d54'
    };

    return colors[language] || '#64748b';
  }

  renderRepositories() {
    const { filteredRepositories } = this.state;

    requestAnimationFrame(() => {
      if (!this.elements.repositoryGrid) return;

      this.elements.repositoryGrid.className = 'repository-grid';

      const fragment = document.createDocumentFragment();
      const visibleRepositories = filteredRepositories.slice(0, this.visibleCount);
      const groupedRepos = this.groupRepositoriesByLanguage(visibleRepositories);

      Object.entries(groupedRepos).forEach(([language, repos]) => {
        const languageSection = this.createLanguageSection(language, repos.length);
        fragment.appendChild(languageSection);

        repos.forEach((repo, index) => {
          const card = this.createRepositoryCard(repo, index);
          fragment.appendChild(card);
        });
      });

      this.elements.repositoryGrid.innerHTML = '';
      this.elements.repositoryGrid.appendChild(fragment);

      this.updateLoadControls(visibleRepositories.length, filteredRepositories.length);
      this.triggerCardAnimations();
      this.optimizeImageLoading();
    });
  }

  updateLoadControls(visibleCount, totalCount) {
    if (!this.elements.loadControls || !this.elements.loadStatus || !this.elements.loadMoreButton) {
      return;
    }

    if (this.state.isLoading || this.state.error || totalCount === 0) {
      this.elements.loadControls.style.display = 'none';
      return;
    }

    this.elements.loadControls.style.display = 'block';
    this.elements.loadStatus.textContent = `Showing ${visibleCount} of ${totalCount} repositories`;

    if (visibleCount >= totalCount) {
      this.elements.loadMoreButton.style.display = 'none';
    } else {
      this.elements.loadMoreButton.style.display = 'inline-block';
    }
  }

  groupRepositoriesByLanguage(repositories) {
    const grouped = {};

    repositories.forEach(repo => {
      const language = repo.language || 'Other';
      if (!grouped[language]) {
        grouped[language] = [];
      }
      grouped[language].push(repo);
    });

    const { languageCategory } = this.state;
    let sortedEntries;

    if (languageCategory === 'recently') {
      sortedEntries = Object.entries(grouped).sort(([langA], [langB]) => {
        const orderA = this.languageOrder[langA] ?? 999;
        const orderB = this.languageOrder[langB] ?? 999;
        return orderA - orderB;
      });
    } else {
      sortedEntries = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);
    }

    return Object.fromEntries(sortedEntries);
  }

  createLanguageSection(language, count) {
    const section = document.createElement('div');
    section.className = 'language-section';

    section.innerHTML = `
      <div class="language-header">
        <h2 class="language-title">
          <span class="language-dot ${language.toLowerCase()}" style="background-color: ${this.getLanguageColor(language)}"></span>
          ${language}
        </h2>
        <span class="language-count">${count} ${count === 1 ? 'repository' : 'repositories'}</span>
      </div>
    `;

    return section;
  }

  createRepositoryCard(repo, index = 0) {
    const card = document.createElement('article');
    card.className = 'repo-card';
    card.style.animationDelay = `${Math.min(index * 60, 600)}ms`;

    card.innerHTML = `
      <div class="repo-header">
        <div class="repo-title">
          <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="repo-name">
            ${this.escapeHtml(repo.name)}
          </a>
          <div class="repo-full-name">${this.escapeHtml(repo.full_name)}</div>
        </div>
        <div class="repo-stars">
          <span class="star-icon">⭐</span>
          <span class="star-count">${repo.formattedStars}</span>
        </div>
      </div>
      
      ${repo.description ? `<p class="repo-description">${this.escapeHtml(repo.description)}</p>` : ''}
      
      <div class="repo-topics">
        ${repo.topics.slice(0, 6).map(topic => `
          <a href="https://github.com/topics/${encodeURIComponent(topic)}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="topic-tag">${this.escapeHtml(topic)}</a>
        `).join('')}
        ${repo.topics.length > 6 ? `<span class="topic-tag">+${repo.topics.length - 6} more</span>` : ''}
      </div>
      
      ${repo.homepage ? `
        <a href="${repo.homepage}" target="_blank" rel="noopener noreferrer" class="repo-homepage">
          <svg class="homepage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15,3 21,3 21,9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Visit Website
        </a>
      ` : ''}
      
      <div class="repo-footer">
        <a href="${repo.owner.html_url}" target="_blank" rel="noopener noreferrer" class="repo-owner">
          <img src="${repo.owner.avatar_url}" alt="${this.escapeHtml(repo.owner.login)}" class="owner-avatar" loading="lazy" decoding="async">
          <span class="owner-name">${this.escapeHtml(repo.owner.login)}</span>
        </a>
        
        <div class="repo-meta">
          <div class="repo-language">
            <span class="language-dot ${repo.language.toLowerCase()}" style="background-color: ${repo.languageColor}"></span>
            <span>${this.escapeHtml(repo.language)}</span>
          </div>
          <div class="repo-updated" title="Last updated: ${new Date(repo.updated_at).toLocaleDateString()}">
            ${repo.relativeTime}
          </div>
        </div>
      </div>
    `;

    this.addCardEventListeners(card, repo);
    return card;
  }

  addCardEventListeners(card, repo) {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.open(repo.html_url, '_blank', 'noopener,noreferrer');
      }
    });

    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'article');
    card.setAttribute(
      'aria-label',
      `Repository: ${repo.name} by ${repo.owner.login}. ${repo.stargazers_count} stars. Language: ${repo.language}`
    );

    const interactiveElements = card.querySelectorAll('a, button');
    interactiveElements.forEach(element => {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  triggerCardAnimations() {
    const cards = this.elements.repositoryGrid
      ? this.elements.repositoryGrid.querySelectorAll('.repo-card')
      : [];

    cards.forEach(card => {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = null;
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '50px'
      });

      cards.forEach(card => observer.observe(card));
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  createSkeletonCards(count = 6) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'repo-card skeleton';
      card.innerHTML = `
        <div class="repo-header">
          <div class="repo-title">
            <div class="repo-name">Loading repository name...</div>
            <div class="repo-full-name">owner/repository-name</div>
          </div>
          <div class="repo-stars">
            <span class="star-icon">⭐</span>
            <span class="star-count">1.2K</span>
          </div>
        </div>
        
        <p class="repo-description">Loading repository description that might be quite long and span multiple lines...</p>
        
        <div class="repo-topics">
          <span class="topic-tag">loading</span>
          <span class="topic-tag">skeleton</span>
          <span class="topic-tag">placeholder</span>
        </div>
        
        <div class="repo-footer">
          <div class="repo-owner">
            <div class="owner-avatar"></div>
            <span class="owner-name">username</span>
          </div>
          
          <div class="repo-meta">
            <div class="repo-language">
              <span class="language-dot"></span>
              <span>Language</span>
            </div>
            <div class="repo-updated">2 days ago</div>
          </div>
        </div>
      `;

      fragment.appendChild(card);
    }

    return fragment;
  }

  initializeAnimations() {
    document.body.classList.add('page-transition');
    this.addInteractiveFeedback();
    this.createLoadingProgressBar();
    this.initializeParallax();
    this.initializeResponsiveBehavior();
    this.initializeTouchInteractions();

    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 100);
  }

  addInteractiveFeedback() {
    const interactiveElements = document.querySelectorAll(
      'button, .filter-select, .search-input, .quick-filter-btn'
    );

    interactiveElements.forEach(element => {
      element.classList.add('interactive-feedback');

      if (element.tagName === 'BUTTON') {
        element.classList.add('micro-bounce', 'btn-press');
      }
    });
  }

  createLoadingProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.className = 'loading-progress';
    progressBar.id = 'loadingProgress';
    progressBar.innerHTML = '<div class="loading-progress-bar" id="loadingProgressBar"></div>';

    document.body.appendChild(progressBar);
    this.elements.loadingProgress = progressBar;
    this.elements.loadingProgressBar = progressBar.querySelector('.loading-progress-bar');
  }

  updateLoadingProgress(progress = 0, visible = false) {
    if (!this.elements.loadingProgress || !this.elements.loadingProgressBar) return;

    this.elements.loadingProgress.classList.toggle('visible', visible);
    this.elements.loadingProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  }

  initializeParallax() {
    const header = document.querySelector('.header');
    if (!header) return;

    const parallaxElement = document.createElement('div');
    parallaxElement.className = 'header-parallax';
    header.appendChild(parallaxElement);

    let ticking = false;

    const updateParallax = () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.5;
      parallaxElement.style.transform = `translateY(${rate}px)`;
      ticking = false;
    };

    const requestParallaxUpdate = () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
  }

  initializeScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const animateElements = document.querySelectorAll('.stats-bar, .footer');
    animateElements.forEach(el => {
      el.classList.add('scroll-reveal');
      observer.observe(el);
    });
  }

  showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = this.getToastIcon(type);

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${this.escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Close notification">×</button>
      </div>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeToast(toast);
    });

    toast.addEventListener('click', () => {
      this.removeToast(toast);
    });

    toast.addEventListener('mouseenter', () => {
      toast.style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
      toast.style.animationPlayState = 'running';
    });

    toast.style.setProperty('--toast-duration', `${duration}ms`);
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    const autoRemoveTimer = setTimeout(() => {
      this.removeToast(toast);
    }, duration);

    toast.autoRemoveTimer = autoRemoveTimer;

    const toasts = toastContainer.querySelectorAll('.toast');
    if (toasts.length > 5) {
      this.removeToast(toasts[0]);
    }
  }

  getToastIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    if (toast.autoRemoveTimer) {
      clearTimeout(toast.autoRemoveTimer);
    }

    toast.classList.add('toast-removing');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  animateFiltering() {
    if (!this.elements.repositoryGrid) return;

    this.elements.repositoryGrid.classList.add('updating');

    setTimeout(() => {
      if (!this.elements.repositoryGrid) return;

      this.elements.repositoryGrid.classList.remove('updating');
      this.elements.repositoryGrid.classList.add('updated');

      setTimeout(() => {
        if (this.elements.repositoryGrid) {
          this.elements.repositoryGrid.classList.remove('updated');
        }
      }, 500);
    }, 200);
  }

  animateStatsUpdate() {
    const statsValues = document.querySelectorAll('.stats-value');
    statsValues.forEach(stat => {
      stat.classList.add('updating');
      setTimeout(() => {
        stat.classList.remove('updating');
      }, 400);
    });
  }

  initializePerformanceOptimizations() {
    this.enableGPUAcceleration();
    this.optimizeImageLoading();
    this.setupPerformanceMonitoring();
    this.optimizeScrollPerformance();
    this.setupMemoryManagement();
  }

  enableGPUAcceleration() {
    const elements = [
      '.repo-card',
      '.search-input',
      '.filter-select',
      '.quick-filter-btn',
      '.loading-spinner'
    ];

    elements.forEach(selector => {
      const els = document.querySelectorAll(selector);
      els.forEach(el => {
        el.style.transform = 'translateZ(0)';
        el.style.backfaceVisibility = 'hidden';
        el.style.perspective = '1000px';
      });
    });
  }

  optimizeImageLoading() {
    if (!('IntersectionObserver' in window)) return;

    const avatars = document.querySelectorAll('.owner-avatar');
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          this.loadImage(img);
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px'
    });

    avatars.forEach(img => {
      imageObserver.observe(img);
    });
  }

  loadImage(img) {
    const src = img.getAttribute('src');
    if (!src) return;

    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
    };

    tempImg.onerror = () => {
      img.src = this.getDefaultAvatar();
      img.classList.add('error');
    };

    tempImg.src = src;
  }

  getDefaultAvatar() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
  }

  setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) console.log('LCP:', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            console.log('FID:', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (!entry.hadRecentInput) {
              console.log('CLS:', entry.value);
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('PerformanceObserver setup failed:', e);
      }
    }

    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
          console.warn('High memory usage detected');
          this.performMemoryCleanup();
        }
      }, 30000);
    }
  }

  performMemoryCleanup() {
    this.performanceMetrics.searchTimes = this.performanceMetrics.searchTimes.slice(-5);
    this.performanceMetrics.renderTimes = this.performanceMetrics.renderTimes.slice(-5);
    this.refreshElementCache();

    if (window.gc) {
      window.gc();
    }
  }

  refreshElementCache() {
    this.cacheElements();
  }

  setupMemoryManagement() {
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performMemoryCleanup();
      }
    });
  }

  cleanup() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    this.elements = {};
  }

  optimizeSearch() {
    this.searchCache = new Map();
    const originalPerformAdvancedSearch = this.performAdvancedSearch.bind(this);

    this.performAdvancedSearch = (repositories, searchTerm) => {
      const cacheKey = `${searchTerm}-${repositories.length}-${this.state.selectedLanguage}`;

      if (this.searchCache.has(cacheKey)) {
        return this.searchCache.get(cacheKey);
      }

      const result = originalPerformAdvancedSearch(repositories, searchTerm);

      if (this.searchCache.size > 50) {
        const firstKey = this.searchCache.keys().next().value;
        this.searchCache.delete(firstKey);
      }

      this.searchCache.set(cacheKey, result);
      return result;
    };
  }

  addErrorBoundaries() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.handleGlobalError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleGlobalError(event.reason);
    });
  }

  handleGlobalError(error) {
    this.showToast('Something went wrong. Please refresh the page.', 'error', 5000);
    console.error('Application error:', error);

    setTimeout(() => {
      if (this.state.repositories.length === 0) {
        this.retry();
      }
    }, 2000);
  }

  getPerformanceMetrics() {
    const avgSearchTime = this.performanceMetrics.searchTimes.length > 0
      ? this.performanceMetrics.searchTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.searchTimes.length
      : 0;

    const avgRenderTime = this.performanceMetrics.renderTimes.length > 0
      ? this.performanceMetrics.renderTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.renderTimes.length
      : 0;

    return {
      totalLoadTime: performance.now() - this.performanceMetrics.loadStartTime,
      averageSearchTime: avgSearchTime,
      averageRenderTime: avgRenderTime,
      repositoryCount: this.state.repositories.length,
      memoryUsage: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }

  initializeOptimizations() {
    this.initializePerformanceOptimizations();
    this.optimizeSearch();
    this.addErrorBoundaries();

    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setTimeout(() => {
        console.log('Performance Metrics:', this.getPerformanceMetrics());
      }, 5000);
    }
  }

  initializeResponsiveBehavior() {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.handleViewportChange();
      }, 250);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleViewportChange();
      }, 500);
    });

    this.handleViewportChange();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.handleVisibilityChange();
      }
    });
  }

  handleViewportChange() {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      isMobile: window.innerWidth <= 768,
      isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
      isDesktop: window.innerWidth > 1024
    };

    document.documentElement.style.setProperty('--viewport-width', `${viewport.width}px`);
    document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);

    this.adjustGridLayout(viewport);
    this.updateSearchBehavior(viewport);
    this.viewport = viewport;
  }

  adjustGridLayout(viewport) {
    const grid = this.elements.repositoryGrid;
    if (!grid) return;

    let columns;
    if (viewport.isMobile) {
      columns = '1fr';
    } else if (viewport.isTablet) {
      columns = 'repeat(2, 1fr)';
    } else {
      columns = 'repeat(auto-fill, minmax(350px, 1fr))';
    }

    grid.style.gridTemplateColumns = columns;
  }

  updateSearchBehavior(viewport) {
    const searchInput = this.elements.searchInput;
    if (!searchInput) return;

    if (viewport.isMobile) {
      searchInput.style.fontSize = '16px';
      searchInput.setAttribute('autocapitalize', 'none');
      searchInput.setAttribute('autocorrect', 'off');
      searchInput.setAttribute('spellcheck', 'false');
    } else {
      searchInput.style.fontSize = '';
    }
  }

  handleVisibilityChange() {
    const now = Date.now();
    const lastUpdate = this.lastVisibilityChange || now;
    const timeDiff = now - lastUpdate;

    if (timeDiff > 5 * 60 * 1000) {
      this.showToast('Refreshing data...', 'info', 1000);
    }

    this.lastVisibilityChange = now;
  }

  initializeTouchInteractions() {
    this.addTouchFeedback();
    this.initializeSwipeGestures();
    this.optimizeScrollPerformance();
  }

  addTouchFeedback() {
    const attachTouchEvents = () => {
      const cards = document.querySelectorAll('.repo-card');

      cards.forEach(card => {
        let touchStartTime = 0;

        card.addEventListener('touchstart', (e) => {
          touchStartTime = Date.now();
          card.classList.add('touching');
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
          const touchEndTime = Date.now();
          const touchDuration = touchEndTime - touchStartTime;

          card.classList.remove('touching');

          if (touchDuration < 200) {
            this.handleCardTap(card, e);
          }
        }, { passive: true });

        card.addEventListener('touchcancel', () => {
          card.classList.remove('touching');
        }, { passive: true });
      });
    };

    setTimeout(attachTouchEvents, 300);
  }

  handleCardTap(card) {
    const repoLink = card.querySelector('.repo-name');
    if (repoLink) {
      card.style.transform = 'scale(0.98)';
      setTimeout(() => {
        card.style.transform = '';
      }, 150);

      setTimeout(() => {
        window.open(repoLink.href, '_blank', 'noopener,noreferrer');
      }, 100);
    }
  }

  initializeSwipeGestures() {
    let startX, startY, startTime;

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!startX || !startY) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const deltaTime = endTime - startTime;

      if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100 && deltaTime < 300) {
        if (deltaX > 0) {
          this.handleSwipeRight();
        } else {
          this.handleSwipeLeft();
        }
      }

      startX = startY = null;
    }, { passive: true });
  }

  handleSwipeRight() {
    console.log('Swipe right detected');
  }

  handleSwipeLeft() {
    console.log('Swipe left detected');
  }

  optimizeScrollPerformance() {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.updateScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  updateScrollPosition() {
    const scrollY = window.pageYOffset;
    const header = document.querySelector('.header-parallax');
    if (header) {
      header.style.transform = `translateY(${scrollY * 0.5}px)`;
    }
    this.updateScrollToTop(scrollY);
  }

  updateScrollToTop(scrollY) {
    if (scrollY > 500) {
      // placeholder
    } else {
      // placeholder
    }
  }

  supportsHover() {
    return window.matchMedia('(hover: hover)').matches;
  }

  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  getDeviceType() {
    const width = window.innerWidth;
    if (width <= 480) return 'mobile-small';
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  handleKeyboardNavigation(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          this.focusSearch();
          break;
        case 'l':
          e.preventDefault();
          this.focusLanguageFilter();
          break;
        case 'r':
          e.preventDefault();
          this.resetFilters();
          break;
      }
    }

    if (e.key === 'Escape') {
      this.handleEscapeKey();
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      this.handleArrowNavigation(e);
    }

    if (e.key === 'Tab') {
      this.handleTabNavigation(e);
    }

    if (e.key === 'Enter' || e.key === ' ') {
      this.handleActivation(e);
    }
  }

  focusSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.focus();
      this.announceToScreenReader('Search input focused. Type to search repositories.');
    }
  }

  focusLanguageFilter() {
    if (this.elements.languageFilter) {
      this.elements.languageFilter.focus();
      this.announceToScreenReader('Language filter focused. Use arrow keys to select a language.');
    }
  }

  handleEscapeKey() {
    if (document.activeElement === this.elements.searchInput) {
      this.clearSearch();
      return;
    }

    if (this.state.searchTerm || this.state.selectedLanguage) {
      this.resetFilters();
      this.announceToScreenReader('All filters cleared.');
      return;
    }

    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  }

  handleArrowNavigation(e) {
    const cards = Array.from(document.querySelectorAll('.repo-card'));
    const currentIndex = cards.indexOf(document.activeElement);

    if (currentIndex === -1) return;

    let nextIndex;
    const columns = this.getGridColumns();

    switch (e.key) {
      case 'ArrowUp':
        nextIndex = Math.max(0, currentIndex - columns);
        break;
      case 'ArrowDown':
        nextIndex = Math.min(cards.length - 1, currentIndex + columns);
        break;
      case 'ArrowLeft':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        nextIndex = Math.min(cards.length - 1, currentIndex + 1);
        break;
    }

    if (nextIndex !== undefined && cards[nextIndex]) {
      e.preventDefault();
      cards[nextIndex].focus();
      this.scrollIntoViewIfNeeded(cards[nextIndex]);
    }
  }

  getGridColumns() {
    const width = window.innerWidth;
    if (width <= 768) return 1;
    if (width <= 1024) return 2;
    return 3;
  }

  handleTabNavigation() {
    this.updateTabOrder();
  }

  getFocusableElements() {
    const selector = [
      'input:not([disabled])',
      'select:not([disabled])',
      'button:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '.repo-card'
    ].join(', ');

    return Array.from(document.querySelectorAll(selector))
      .filter(el => this.isElementVisible(el));
  }

  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.offsetParent !== null;
  }

  updateTabOrder() {
    const searchInput = this.elements.searchInput;
    const languageFilter = this.elements.languageFilter;
    const sortSelect = this.elements.sortSelect;
    const quickFilters = this.elements.quickFilterButtons
      ? this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn')
      : [];
    const cards = document.querySelectorAll('.repo-card');
    const loadMoreButton = this.elements.loadMoreButton;

    let tabIndex = 1;

    if (searchInput) searchInput.tabIndex = tabIndex++;
    if (languageFilter) languageFilter.tabIndex = tabIndex++;
    if (sortSelect) sortSelect.tabIndex = tabIndex++;

    quickFilters.forEach(btn => {
      btn.tabIndex = tabIndex++;
    });

    cards.forEach(card => {
      card.tabIndex = tabIndex++;
    });

    if (loadMoreButton && this.isElementVisible(loadMoreButton)) {
      loadMoreButton.tabIndex = tabIndex++;
    }
  }

  handleActivation(e) {
    const target = e.target;

    if (target.classList.contains('repo-card')) {
      e.preventDefault();
      const repoLink = target.querySelector('.repo-name');
      if (repoLink) {
        window.open(repoLink.href, '_blank', 'noopener,noreferrer');
        this.announceToScreenReader(`Opening ${repoLink.textContent} repository in new tab.`);
      }
    }

    if (target.classList.contains('quick-filter-btn')) {
      e.preventDefault();
      const language = target.getAttribute('data-language');
      this.handleQuickFilter(language);
    }
  }

  scrollIntoViewIfNeeded(element) {
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.left >= 0 &&
      rect.right <= window.innerWidth;

    if (!isVisible) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }

  announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
      }
    }, 1000);
  }

  updateAriaLabels() {
    const searchInput = this.elements.searchInput;
    if (searchInput) {
      searchInput.setAttribute('aria-label', 'Search repositories by name, description, or topics');
      searchInput.setAttribute('aria-describedby', 'search-help');
    }

    const languageFilter = this.elements.languageFilter;
    if (languageFilter) {
      languageFilter.setAttribute('aria-label', 'Filter repositories by programming language');
    }

    const sortSelect = this.elements.sortSelect;
    if (sortSelect) {
      sortSelect.setAttribute('aria-label', 'Sort repositories by different criteria');
    }

    this.updateRepositoryCardAria();
    this.updateStatisticsAria();
  }

  updateRepositoryCardAria() {
    const cards = document.querySelectorAll('.repo-card');

    cards.forEach(card => {
      const repoName = card.querySelector('.repo-name');
      const ownerName = card.querySelector('.owner-name');
      const stars = card.querySelector('.star-count');
      const language = card.querySelector('.repo-language span:last-child');

      if (repoName && ownerName) {
        const ariaLabel = `Repository: ${repoName.textContent} by ${ownerName.textContent}`;
        const ariaDescription = [];

        if (stars) ariaDescription.push(`${stars.textContent} stars`);
        if (language) ariaDescription.push(`Written in ${language.textContent}`);

        card.setAttribute('aria-label', ariaLabel);
        if (ariaDescription.length > 0) {
          card.setAttribute('aria-description', ariaDescription.join(', '));
        }
      }
    });
  }

  updateStatisticsAria() {
    const totalCount = this.elements.totalCount;
    const filteredCount = this.elements.filteredCount;
    const languageCount = this.elements.languageCount;

    if (totalCount) {
      totalCount.setAttribute('aria-label', `Total repositories: ${totalCount.textContent}`);
    }

    if (filteredCount) {
      filteredCount.setAttribute('aria-label', `Currently showing: ${filteredCount.textContent} repositories`);
    }

    if (languageCount) {
      languageCount.setAttribute('aria-label', `Available languages: ${languageCount.textContent}`);
    }
  }

  initializeAccessibility() {
    this.addSkipLinks();
    this.updateAriaLabels();
    this.addKeyboardHelp();
    this.setupFocusManagement();
    this.setupLiveRegions();
  }

  addSkipLinks() {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#searchInput" class="skip-link">Skip to search</a>
      <a href="#repositoryGrid" class="skip-link">Skip to repositories</a>
      <a href="#footer" class="skip-link">Skip to footer</a>
    `;

    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  addKeyboardHelp() {
    const helpText = document.createElement('div');
    helpText.id = 'search-help';
    helpText.className = 'sr-only';
    helpText.textContent = 'Use Ctrl+K to focus search, Ctrl+L for language filter, Ctrl+R to reset filters, Escape to clear search or filters.';

    document.body.appendChild(helpText);
  }

  setupFocusManagement() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.target === this.elements.repositoryGrid) {
          const firstCard = this.elements.repositoryGrid.querySelector('.repo-card');
          if (firstCard && document.activeElement === document.body) {
            setTimeout(() => {
              if (document.activeElement === document.body) {
                // firstCard.focus();
              }
            }, 100);
          }
        }
      });
    });

    if (this.elements.repositoryGrid) {
      observer.observe(this.elements.repositoryGrid, { childList: true });
      this.mutationObserver = observer;
    }
  }

  setupLiveRegions() {
    const searchLiveRegion = document.createElement('div');
    searchLiveRegion.id = 'search-live-region';
    searchLiveRegion.setAttribute('aria-live', 'polite');
    searchLiveRegion.setAttribute('aria-atomic', 'true');
    searchLiveRegion.className = 'sr-only';
    document.body.appendChild(searchLiveRegion);
    this.elements.searchLiveRegion = searchLiveRegion;

    const filterLiveRegion = document.createElement('div');
    filterLiveRegion.id = 'filter-live-region';
    filterLiveRegion.setAttribute('aria-live', 'polite');
    filterLiveRegion.className = 'sr-only';
    document.body.appendChild(filterLiveRegion);
    this.elements.filterLiveRegion = filterLiveRegion;
  }

  announceSearchResults() {
    const count = this.state.filteredRepositories.length;
    const searchTerm = this.state.searchTerm;
    const language = this.state.selectedLanguage;

    let message = `Found ${count} repositories`;

    if (searchTerm) {
      message += ` matching "${searchTerm}"`;
    }

    if (language) {
      message += ` in ${language}`;
    }

    if (this.elements.searchLiveRegion) {
      this.elements.searchLiveRegion.textContent = message;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const showcase = new GitHubShowcase();
  showcase.init();
  window.showcase = showcase;
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubShowcase;
}
