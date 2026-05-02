/**
 * Gene Autocomplete Module
 * Handles gene name/PAO1_ID suggestions with caching and recently viewed
 */

class GeneAutocomplete {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            maxSuggestions: options.maxSuggestions || 10,
            debounceDelay: options.debounceDelay || 300,
            apiUrl: options.apiUrl,
            onSelect: options.onSelect || (() => {})
        };
        
        this.geneList = [];
        this.dropdown = null;
        this.debounceTimer = null;
        this.selectedIndex = -1;
        this.isLoading = false;
        
        this.init();
    }
    
    async init() {
        // Create dropdown element
        this.createDropdown();
        
        // Load gene list from API (with caching)
        await this.loadGeneList();
        
        // Attach event listeners
        this.attachEvents();
        
        console.log('GeneAutocomplete initialized with', this.geneList.length, 'genes');
    }
    
    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'autocomplete-dropdown';
        this.dropdown.hidden = true;
        this.input.parentNode.appendChild(this.dropdown);
    }
    
    async loadGeneList() {
        // Check localStorage cache first
        const cached = localStorage.getItem('geneListCache');
        const cacheTime = localStorage.getItem('geneListCacheTime');
        const now = Date.now();
        
        // Use cache if less than 24 hours old
        if (cached && cacheTime && (now - parseInt(cacheTime)) < 24 * 60 * 60 * 1000) {
            this.geneList = JSON.parse(cached);
            console.log('Loaded gene list from cache:', this.geneList.length, 'genes');
            return;
        }
        
        // Fetch from API
        try {
            console.log('Fetching gene list from API:', this.options.apiUrl);
            const response = await fetch(this.options.apiUrl);
            const data = await response.json();
            
            if (data.genes) {
                this.geneList = data.genes;
                
                // Cache the results
                localStorage.setItem('geneListCache', JSON.stringify(data.genes));
                localStorage.setItem('geneListCacheTime', now.toString());
                
                console.log('Loaded gene list from API:', this.geneList.length, 'genes');
            }
        } catch (error) {
            console.error('Failed to load gene list:', error);
        }
    }
    
    attachEvents() {
        // Input event with debouncing
        this.input.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.handleInput();
            }, this.options.debounceDelay);
        });
        
        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // Close dropdown on blur (with delay for click handling)
        this.input.addEventListener('blur', () => {
            setTimeout(() => this.hideDropdown(), 200);
        });
        
        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }
    
    handleInput() {
        const query = this.input.value.trim();
        
        if (query.length < 2) {
            this.hideDropdown();
            return;
        }
        
        const suggestions = this.getSuggestions(query);
        this.renderSuggestions(suggestions);
    }
    
    getSuggestions(query) {
        const lowerQuery = query.toLowerCase();
        const recentGenes = this.getRecentGenes();
        
        // Filter and score suggestions
        let suggestions = this.geneList
            .filter(item => {
                const value = item.value.toLowerCase();
                return value.includes(lowerQuery);
            })
            .map(item => {
                const value = item.value.toLowerCase();
                const isRecent = recentGenes.includes(item.value);
                
                // Scoring: prioritize gene_name, starts-with, and recent genes
                let score = 0;
                if (item.type === 'gene_name') score += 100;
                if (value.startsWith(lowerQuery)) score += 50;
                if (isRecent) score += 25;
                
                // Position of match (earlier is better)
                const matchPos = value.indexOf(lowerQuery);
                score -= matchPos;
                
                return { ...item, score, isRecent };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, this.options.maxSuggestions);
        
        return suggestions;
    }
    
    renderSuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.hideDropdown();
            return;
        }
        
        this.dropdown.innerHTML = suggestions.map((item, index) => `
            <div class="autocomplete-item ${index === this.selectedIndex ? 'selected' : ''} ${item.isRecent ? 'recent' : ''}" 
                 data-value="${item.value}" 
                 data-index="${index}">
                <span class="autocomplete-value">${this.highlightMatch(item.value, this.input.value)}</span>
                <span class="autocomplete-type">${item.type === 'gene_name' ? 'Gene' : 'PAO1 ID'}</span>
                ${item.isRecent ? '<span class="autocomplete-recent-badge">Recent</span>' : ''}
            </div>
        `).join('');
        
        // Attach click handlers
        this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectItem(item.dataset.value);
            });
        });
        
        this.showDropdown();
    }
    
    highlightMatch(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }
    
    handleKeydown(e) {
        if (!this.isDropdownVisible()) return;
        
        const items = this.dropdown.querySelectorAll('.autocomplete-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
                    this.selectItem(items[this.selectedIndex].dataset.value);
                }
                break;
            case 'Escape':
                this.hideDropdown();
                break;
        }
    }
    
    updateSelection() {
        const items = this.dropdown.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // Scroll selected item into view
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    selectItem(value) {
        this.input.value = value;
        this.hideDropdown();
        this.addToRecentGenes(value);
        this.options.onSelect(value);
    }
    
    showDropdown() {
        this.dropdown.hidden = false;
    }
    
    hideDropdown() {
        this.dropdown.hidden = true;
        this.selectedIndex = -1;
    }
    
    isDropdownVisible() {
        return !this.dropdown.hidden;
    }
    
    getRecentGenes() {
        const recent = localStorage.getItem('recentGenes');
        return recent ? JSON.parse(recent) : [];
    }
    
    addToRecentGenes(gene) {
        let recent = this.getRecentGenes();
        
        // Remove if already exists
        recent = recent.filter(g => g !== gene);
        
        // Add to front
        recent.unshift(gene);
        
        // Keep only last 10
        recent = recent.slice(0, 10);
        
        localStorage.setItem('recentGenes', JSON.stringify(recent));
    }
}
