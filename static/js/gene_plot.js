/**
 * Gene Plot - CRISPRi-seq Browser
 * JavaScript for dynamic Plotly.js visualizations
 */

// Global state
let currentData = null;
let geneAutocomplete = null;
let windowSlider = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Gene browser initializing...');
    console.log('Available globals:', {
        GENE_LIST_URL: window.GENE_LIST_URL,
        GENE_DATA_URL: window.GENE_DATA_URL,
        MIN_GENE_LENGTH: window.MIN_GENE_LENGTH,
        MAX_GENE_LENGTH: window.MAX_GENE_LENGTH
    });
    
    const form = document.getElementById('gene-form');
    form.addEventListener('submit', handleFormSubmit);
    
    // Initialize autocomplete
    const geneInput = document.getElementById('gene-input');
    if (geneInput && window.GENE_LIST_URL) {
        console.log('Initializing autocomplete...');
        geneAutocomplete = new GeneAutocomplete(geneInput, {
            apiUrl: window.GENE_LIST_URL,
            maxSuggestions: 10,
            debounceDelay: 300,
            onSelect: (value) => {
                // Optional: Could auto-load on select if desired
            }
        });
    } else {
        console.error('Cannot initialize autocomplete:', {
            geneInput: !!geneInput,
            GENE_LIST_URL: window.GENE_LIST_URL
        });
    }
    
    // Initialize window size slider
    const slider = document.getElementById('window-slider');
    const input = document.getElementById('window-input');
    if (slider && input && window.MIN_GENE_LENGTH && window.MAX_GENE_LENGTH) {
        console.log('Initializing slider...');
        windowSlider = new CustomSlider(slider, input, {
            min: window.MIN_GENE_LENGTH,
            max: window.MAX_GENE_LENGTH,
            step: 1000,
            defaultValue: 5000,
            storageKey: 'geneWindowSize',
            onChange: (value) => {
                // Optional: Could add visual feedback
            }
        });
    } else {
        console.error('Cannot initialize slider:', {
            slider: !!slider,
            input: !!input,
            MIN_GENE_LENGTH: window.MIN_GENE_LENGTH,
            MAX_GENE_LENGTH: window.MAX_GENE_LENGTH
        });
    }
    
    console.log('Gene browser initialization complete');
});

/**
 * Handle form submission
 */
function handleFormSubmit(event) {
    event.preventDefault();
    loadGeneData();
}

/**
 * Fetch gene data from the server
 */
async function loadGeneData() {
    const geneInput = document.getElementById('gene-input').value.trim();
    const window_value = parseInt(document.getElementById('window-input').value);
    const conditionsSelect = document.getElementById('conditions-select');
    const selectedConditions = Array.from(conditionsSelect.selectedOptions).map(opt => opt.value);
    
    if (!geneInput) {
        showError('Please enter a gene name or PAO1_ID');
        return;
    }
    
    if (selectedConditions.length === 0) {
        showError('Please select at least one condition');
        return;
    }
    
    // Show loading, hide previous results
    showLoading(true);
    hideError();
    hidePlots();
    
    try {
        const response = await fetch(window.GENE_DATA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.CSRF_TOKEN
            },
            body: JSON.stringify({
                gene: geneInput,
                window: window_value,
                conditions: selectedConditions
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Enhanced error message for gene not found
            if (data.error && data.error.includes('No gene found')) {
                showError(`Gene "${geneInput}" not found. Please check the spelling or try a different gene name or PAO1 ID. Use the autocomplete suggestions for guidance.`);
            } else {
                showError(data.error || 'Failed to fetch data');
            }
            throw new Error(data.error || 'Failed to fetch data');
        }
        
        currentData = data;
        
        // Display gene info
        displayGeneInfo(data.target_gene);
        
        // Create plots
        createGeneContextPlot(data.genes, data.region);
        createLFCPlot(data.guides, data.region);
        createGuidesTable(data.guides);
        
        showPlots();
        
    } catch (error) {
        showError(error.message);
        console.error('Error loading gene data:', error);
    } finally {
        showLoading(false);
    }
}

/**
 * Display gene information
 */
function displayGeneInfo(geneData) {
    const infoCard = document.getElementById('gene-info-card');
    const infoContent = document.getElementById('gene-info-content');
    
    const strand = geneData.strand === '+' ? 'Forward (+)' : 'Reverse (-)';
    
    infoContent.innerHTML = `
        <table style="width: 100%; font-size: 0.9rem;">
            <tr>
                <td style="color: var(--text-secondary); padding: 0.5rem 0;"><strong>PAO1 ID:</strong></td>
                <td style="color: var(--text-primary); padding: 0.5rem 0;">${geneData.PAO1_ID}</td>
            </tr>
            <tr>
                <td style="color: var(--text-secondary); padding: 0.5rem 0;"><strong>Gene Name:</strong></td>
                <td style="color: var(--text-primary); padding: 0.5rem 0;">${geneData.gene_name}</td>
            </tr>
            <tr>
                <td style="color: var(--text-secondary); padding: 0.5rem 0;"><strong>Location:</strong></td>
                <td style="color: var(--text-primary); padding: 0.5rem 0;">${geneData.start.toLocaleString()} - ${geneData.end.toLocaleString()}</td>
            </tr>
            <tr>
                <td style="color: var(--text-secondary); padding: 0.5rem 0;"><strong>Strand:</strong></td>
                <td style="color: var(--text-primary); padding: 0.5rem 0;">${strand}</td>
            </tr>
            ${geneData.operon ? `
            <tr>
                <td style="color: var(--text-secondary); padding: 0.5rem 0;"><strong>Operon:</strong></td>
                <td style="color: var(--text-primary); padding: 0.5rem 0;">${geneData.operon}</td>
            </tr>
            ` : ''}
        </table>
    `;
    
    infoCard.style.display = 'block';
}

/**
 * Create gene context plot (genomic arrows)
 */
function createGeneContextPlot(genes, region) {
    const plotDiv = document.getElementById('gene-context-plot');
    
    if (!genes || genes.length === 0) {
        plotDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No genes in this region</p>';
        return;
    }
    
    // Create shapes for gene arrows
    const shapes = [];
    const annotations = [];
    
    genes.forEach((gene, idx) => {
        const y = 0.5;
        const height = 0.3;
        const isForward = gene.strand === 'forward';
        
        // Gene body (rectangle)
        shapes.push({
            type: 'rect',
            x0: gene.start,
            x1: gene.end,
            y0: y - height/2,
            y1: y + height/2,
            fillcolor: getOperonColor(gene.operon),
            line: { color: '#ffffff', width: 1 },
            layer: 'below'
        });
        
        // Arrow head
        const arrowSize = Math.min((gene.end - gene.start) * 0.1, 200);
        const arrowX = isForward ? gene.end : gene.start;
        const arrowDirection = isForward ? 1 : -1;
        
        shapes.push({
            type: 'path',
            path: isForward 
                ? `M ${gene.end - arrowSize} ${y - height/2} L ${gene.end} ${y} L ${gene.end - arrowSize} ${y + height/2}`
                : `M ${gene.start + arrowSize} ${y - height/2} L ${gene.start} ${y} L ${gene.start + arrowSize} ${y + height/2}`,
            fillcolor: getOperonColor(gene.operon),
            line: { color: '#ffffff', width: 1 },
            layer: 'below'
        });
        
        // Gene label
        annotations.push({
            x: (gene.start + gene.end) / 2,
            y: y + 0.3,
            text: gene.gene_name || gene.PAO1_ID,
            showarrow: false,
            font: { size: 10, color: '#e0e0e0' },
            textangle: 90
        });
    });
    
    const layout = {
        xaxis: {
            range: [region.start, region.end],
            title: 'Genomic Position (bp)',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a'
        },
        yaxis: {
            range: [0, 1],
            showticklabels: false,
            showgrid: false,
            zeroline: false
        },
        shapes: shapes,
        annotations: annotations,
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#e0e0e0' },
        margin: { t: 20, b: 50, l: 50, r: 20 },
        height: 200,
        hovermode: 'closest'
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(plotDiv, [], layout, config);
}

/**
 * Create log2 fold change plot
 */
function createLFCPlot(guides, region) {
    const plotDiv = document.getElementById('lfc-plot');
    
    if (!guides || guides.length === 0) {
        plotDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No guide data available for selected conditions</p>';
        return;
    }
    
    // Group guides by condition
    const conditionGroups = {};
    guides.forEach(guide => {
        if (!conditionGroups[guide.condition]) {
            conditionGroups[guide.condition] = [];
        }
        conditionGroups[guide.condition].push(guide);
    });
    
    // Create traces for each condition
    const traces = Object.keys(conditionGroups).map((condition, idx) => {
        const conditionGuides = conditionGroups[condition];
        
        return {
            x: conditionGuides.map(g => g.guide_center),
            y: conditionGuides.map(g => g['LFC.adj']),
            mode: 'markers',
            type: 'scatter',
            name: condition,
            marker: {
                size: 8,
                color: getConditionColor(idx),
                opacity: 0.8
            },
            text: conditionGuides.map(g => 
                `Gene: ${g.gene_name}<br>` +
                `Guide: ${g.spacer}<br>` +
                `LFC: ${g['LFC.adj'].toFixed(3)}<br>` +
                `Position: ${Math.round(g.guide_center)}`
            ),
            hovertemplate: '%{text}<extra></extra>'
        };
    });
    
    const layout = {
        xaxis: {
            range: [region.start, region.end],
            title: 'Genomic Position (bp)',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a'
        },
        yaxis: {
            title: 'Log2 Fold Change',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a',
            zeroline: true,
            zerolinecolor: '#666666',
            zerolinewidth: 2
        },
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#e0e0e0' },
        margin: { t: 20, b: 50, l: 60, r: 20 },
        height: 400,
        hovermode: 'closest',
        legend: {
            bgcolor: '#2a2a2a',
            bordercolor: '#404040',
            borderwidth: 1
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(plotDiv, traces, layout, config);
}

/**
 * Create guides data table
 */
function createGuidesTable(guides) {
    const container = document.getElementById('guides-table-container');
    
    if (!guides || guides.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No guide data available</p>';
        return;
    }
    
    // Build table HTML
    let tableHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Gene</th>
                    <th>PAO1_ID</th>
                    <th>Condition</th>
                    <th>Guide Spacer</th>
                    <th>LFC</th>
                    <th>Position</th>
                    <th>Strand</th>
                    <th>Off-targets</th>
                    <th>GC%</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Sort by condition and absolute LFC
    const sortedGuides = [...guides].sort((a, b) => {
        if (a.condition !== b.condition) {
            return a.condition.localeCompare(b.condition);
        }
        return Math.abs(b['LFC.adj']) - Math.abs(a['LFC.adj']);
    });
    
    sortedGuides.forEach(guide => {
        const lfcColor = getLFCColor(guide['LFC.adj']);
        tableHTML += `
            <tr>
                <td>${guide.gene_name}</td>
                <td>${guide.PAO1_ID}</td>
                <td><span style="font-size: 0.85em;">${guide.condition}</span></td>
                <td><code style="font-size: 0.85em; background: #2a2a2a; padding: 2px 4px; border-radius: 3px;">${guide.spacer}</code></td>
                <td style="color: ${lfcColor}; font-weight: 600;">${guide['LFC.adj'].toFixed(3)}</td>
                <td>${Math.round(guide.guide_center).toLocaleString()}</td>
                <td>${guide.forward ? 'Forward' : 'Reverse'}</td>
                <td>${guide.off_target_n || 0}</td>
                <td>${guide.gc ? (guide.gc * 100).toFixed(1) : 'N/A'}</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

/**
 * Download guides data as CSV
 */
document.addEventListener('DOMContentLoaded', function() {
    const downloadBtn = document.getElementById('download-csv');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            if (!currentData || !currentData.guides) {
                alert('No data available to download');
                return;
            }
            
            const guides = currentData.guides;
            
            // Create CSV content
            const headers = ['Gene', 'PAO1_ID', 'Condition', 'Spacer', 'LFC', 'Position', 'Strand', 'Off_Targets', 'GC'];
            const rows = guides.map(g => [
                g.gene_name,
                g.PAO1_ID,
                g.condition,
                g.spacer,
                g['LFC.adj'].toFixed(3),
                Math.round(g.guide_center),
                g.forward ? 'Forward' : 'Reverse',
                g.off_target_n || 0,
                g.gc ? (g.gc * 100).toFixed(1) : ''
            ]);
            
            let csvContent = headers.join(',') + '\n';
            rows.forEach(row => {
                csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
            });
            
            // Download
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `guides_${currentData.target_gene.gene_name}_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
});

/**
 * Utility functions
 */

function getOperonColor(operon) {
    // Simple hash-based color generation for operons
    if (!operon) return '#666666';
    
    const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5', '#9333ea', '#db2777'];
    let hash = 0;
    for (let i = 0; i < operon.length; i++) {
        hash = operon.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getConditionColor(idx) {
    const colors = ['#dc2626', '#ea580c', '#16a34a', '#0891b2', '#4f46e5', '#9333ea', '#db2777', '#ca8a04'];
    return colors[idx % colors.length];
}

function getLFCColor(lfc) {
    if (lfc < -1) return '#16a34a';  // Green for negative
    if (lfc > 1) return '#dc2626';   // Red for positive
    return '#a0a0a0';                // Gray for neutral
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.style.display = 'none';
}

function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    loadingDiv.style.display = show ? 'block' : 'none';
}

function showPlots() {
    document.getElementById('plots-container').style.display = 'block';
}

function hidePlots() {
    document.getElementById('plots-container').style.display = 'none';
}
