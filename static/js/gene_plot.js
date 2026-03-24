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
        createCombinedGenePlot(data.genes, data.guides, data.region);
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
        <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse; line-height: 1.25;">
            <tr>
                <td class="gene-info-head"><strong>PAO1 ID:</strong></td>
                <td class="gene-info-details">${geneData.PAO1_ID}</td>
            </tr>
            <tr>
                <td class="gene-info-head"><strong>Gene Name:</strong></td>
                <td class="gene-info-details">${geneData.gene_name}</td>
            </tr>
            <tr>
                <td class="gene-info-head"><strong>Location:</strong></td>
                <td class="gene-info-details">${geneData.start.toLocaleString()} - ${geneData.end.toLocaleString()}</td>
            </tr>
            <tr>
                <td class="gene-info-head"><strong>Strand:</strong></td>
                <td class="gene-info-details">${strand}</td>
            </tr>
            ${geneData.operon ? `
            <tr>
                <td class="gene-info-head"><strong><strong>Operon:</strong></td>
                <td class="gene-info-details">${geneData.operon}</td>
            </tr>
            ` : ''}
        </table>
    `;
    
    infoCard.style.display = 'block';
}

/**
 * Create combined stacked visualization with shared genomic x-axis
 */
function createCombinedGenePlot(genes, guides, region) {
    const plotDiv = document.getElementById('combined-gene-plot');

    if (!plotDiv) {
        throw new Error('Plot container "combined-gene-plot" was not found in the DOM');
    }

    // Reset any fallback HTML from prior no-data states before plotting.
    plotDiv.innerHTML = '';
    
    if ((!genes || genes.length === 0) && (!guides || guides.length === 0)) {
        plotDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No data available for this region</p>';
        return;
    }

    const geneLayer = buildGeneContextLayer(genes);
    const lfcTraces = buildLFCTraces(guides);

    // Add median lines for each condition
    let medianTraces = [];
    if (currentData.median_lfc) {
        const conditions = Object.keys(currentData.median_lfc);
        medianTraces = conditions.map((condition, idx) => {
            const medianValue = currentData.median_lfc[condition];
            return {
                x: [region.start, region.end],
                y: [medianValue, medianValue],
                mode: 'lines',
                name: `${condition} median`,
                line: {
                    color: getConditionColor(idx),
                    width: 2,
                    dash: 'dash'
                },
                yaxis: 'y',
                hovertemplate: `<b>${condition} Median</b><br>LFC: %{y:.2f}<extra></extra>`
            };
        });
    }

    const annotations = [...geneLayer.annotations];
    if (!genes || genes.length === 0) {
        annotations.push({
            x: (region.start + region.end) / 2,
            y: 0.84,
            xref: 'x2',
            yref: 'paper',
            text: 'No genes in this region',
            showarrow: false,
            font: { size: 12, color: '#a0a0a0' }
        });
    }

    if (!guides || guides.length === 0) {
        annotations.push({
            x: (region.start + region.end) / 2,
            y: 0.28,
            xref: 'x',
            yref: 'paper',
            text: 'No guide data available for selected conditions',
            showarrow: false,
            font: { size: 12, color: '#a0a0a0' }
        });
    }

    const layout = {
        // Bottom panel (LFC)
        xaxis: {
            range: [region.start, region.end],
            title: 'Genomic Position (bp)',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a',
            domain: [0, 1],
            anchor: 'y'
        },
        yaxis: {
            title: 'Log2 Fold Change',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a',
            zeroline: true,
            zerolinecolor: '#666666',
            zerolinewidth: 2,
            domain: [0, 0.62]
        },
        // Top panel (Gene context)
        xaxis2: {
            range: [region.start, region.end],
            matches: 'x',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a',
            showticklabels: false,
            domain: [0, 1],
            anchor: 'y2'
        },
        yaxis2: {
            range: [0, 1],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            domain: [0.7, 1]
        },
        legend: {
            x: 0.5,
            y: -0.2,
            xanchor: 'center',
            yanchor: 'top',
            bgcolor: '#2a2a2a',
            bordercolor: '#404040',
            borderwidth: 0.8,
            orientation: 'h'
        },
        shapes: geneLayer.shapes,
        annotations: annotations,
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#e0e0e0' },
        margin: { t: 20, b: 120, l: 60, r: 20 },
        height: 620,
        hovermode: 'closest'
    };

    const config = {
        responsive: true,
        displaylogo: false
    };

    Plotly.newPlot(plotDiv, [...lfcTraces, ...medianTraces], layout, config);
}

function buildGeneContextLayer(genes) {
    const shapes = [];
    const annotations = [];

    if (!genes || genes.length === 0) {
        return { shapes: shapes, annotations: annotations };
    }

    genes.forEach(gene => {
        const y = 0.5;
        const height = 0.3;
        const isForward = gene.strand === '+';

        // Gene body (rectangle)
        shapes.push({
            type: 'rect',
            x0: gene.start,
            x1: gene.end,
            y0: y - height / 2,
            y1: y + height / 2,
            xref: 'x2',
            yref: 'y2',
            fillcolor: getOperonColor(gene.operon),
            line: { color: '#ffffff', width: 1 },
            layer: 'below'
        });

        // Arrow head
        const arrowSize = Math.min((gene.end - gene.start) * 0.1, 200);
        shapes.push({
            type: 'path',
            path: isForward
                ? `M ${gene.end - arrowSize} ${y - height / 2} L ${gene.end} ${y} L ${gene.end - arrowSize} ${y + height / 2}`
                : `M ${gene.start + arrowSize} ${y - height / 2} L ${gene.start} ${y} L ${gene.start + arrowSize} ${y + height / 2}`,
            xref: 'x2',
            yref: 'y2',
            fillcolor: getOperonColor(gene.operon),
            line: { color: '#ffffff', width: 1 },
            layer: 'below'
        });

        // Gene label
        annotations.push({
            x: (gene.start + gene.end) / 2,
            y: y + 0.3,
            xref: 'x2',
            yref: 'y2',
            text: gene.gene_name || gene.PAO1_ID,
            showarrow: false,
            font: { size: 10, color: '#e0e0e0' },
            textangle: 90
        });
    });

    return { shapes: shapes, annotations: annotations };
}

function buildLFCTraces(guides) {
    if (!guides || guides.length === 0) {
        return [];
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
    return Object.keys(conditionGroups).map((condition, idx) => {
        const conditionGuides = conditionGroups[condition];

        return {
            x: conditionGuides.map(g => g.guide_center),
            y: conditionGuides.map(g => g['LFC.adj']),
            mode: 'markers',
            type: 'scatter',
            name: condition,
            xaxis: 'x',
            yaxis: 'y',
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
}

/**
 * Create guides data table with DataTables
 */
function createGuidesTable(guides) {
    const container = document.getElementById('guides-table-container');
    
    if (!guides || guides.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No guide data available</p>';
        return;
    }
    
    // Clear previous table if exists
    if ($.fn.dataTable.isDataTable('#guidesDataTable')) {
        $('#guidesDataTable').DataTable().destroy();
    }
    
    // Build table HTML
    let tableHTML = `
        <table id="guidesDataTable" class="table display" style="width:100%;">
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
            <tfoot>
                <tr>
                    <td><input type="text" class="column-search" placeholder="Gene" data-column="0"></td>
                    <td><input type="text" class="column-search" placeholder="PAO1_ID" data-column="1"></td>
                    <td><input type="text" class="column-search" placeholder="Condition" data-column="2"></td>
                    <td><input type="text" class="column-search" placeholder="Spacer" data-column="3"></td>
                    <td><input type="text" class="column-search" placeholder="LFC" data-column="4"></td>
                    <td><input type="text" class="column-search" placeholder="Position" data-column="5"></td>
                    <td><input type="text" class="column-search" placeholder="Strand" data-column="6"></td>
                    <td><input type="text" class="column-search" placeholder="Off-targets" data-column="7"></td>
                    <td><input type="text" class="column-search" placeholder="GC%" data-column="8"></td>
                </tr>
            </tfoot>
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
                <td>${guide.forward ? '+' : '-'}</td>
                <td>${guide.off_target_n || 0}</td>
                <td>${guide.gc ? (guide.gc * 100).toFixed(1) : 'N/A'}</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
    
    // Initialize DataTables with configuration
    let table = new DataTable('#guidesDataTable', {
        pageLength: 10,
        responsive: true,
        paging: true,
        searching: true,
        ordering: true,
        order: [[4, 'asc']], // Sort by LFC (column 4) ascending by default
        lengthMenu: [10, 25, 50],
        layout: {
            topEnd: 'search'
        },
        buttons: [
            {
                extend: 'copy',
                className: 'btn btn-secondary',
                text: 'Copy'
            },
            {
                extend: 'csv',
                className: 'btn btn-secondary',
                text: 'Download CSV',
                filename: `guides_${currentData.target_gene.gene_name}_${Date.now()}`
            }
        ],
        columnDefs: [
            {
                targets: '_all',
                orderable: true,
                searchable: true,
                className: 'dt-left',
            }
        ],
    });
    
    // Add event listeners for column-specific search inputs
    $('#guidesDataTable').on('keyup change', '.column-search', function() {
        const columnIndex = $(this).data('column');
        const searchValue = $(this).val();
        table.column(columnIndex).search(searchValue).draw();
    });
}

/**
 * Download guides data as CSV (removed - now handled by DataTables)
 */
document.addEventListener('DOMContentLoaded', function() {
    const downloadPlotBtn = document.getElementById('download-plot');
    if (downloadPlotBtn) {
        downloadPlotBtn.addEventListener('click', async function() {
            try {
                await downloadPaperReadyPlot();
            } catch (error) {
                alert(error.message || 'Failed to download plot');
                console.error('Error downloading paper-ready plot:', error);
            }
        });
    }

    // Note: CSV download is now handled by DataTables buttons extension
    // The download-csv button is removed from the template and DataTables handles CSV export
});


async function downloadPaperReadyPlot() {
    if (!currentData) {
        throw new Error('No plot data available to download');
    }

    const sourcePlotDiv = document.getElementById('combined-gene-plot');
    if (!sourcePlotDiv || !sourcePlotDiv.data || !sourcePlotDiv.layout) {
        throw new Error('Plot is not available for download');
    }

    const paperData = JSON.parse(JSON.stringify(sourcePlotDiv.data));
    const paperLayout = buildPaperReadyLayout(sourcePlotDiv.layout);

    const exportWidth = 1800;
    const exportHeight = 1200;
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-10000px';
    tempDiv.style.top = '0';
    tempDiv.style.width = `${exportWidth}px`;
    tempDiv.style.height = `${exportHeight}px`;
    document.body.appendChild(tempDiv);

    try {
        await Plotly.newPlot(tempDiv, paperData, paperLayout, {
            displayModeBar: false,
            displaylogo: false,
            responsive: false,
            staticPlot: true
        });

        await Plotly.downloadImage(tempDiv, {
            format: 'png',
            filename: `paper_figure_${currentData.target_gene.gene_name}_${Date.now()}`,
            width: exportWidth,
            height: exportHeight,
            scale: 2
        });
    } finally {
        Plotly.purge(tempDiv);
        tempDiv.remove();
    }
}

function buildPaperReadyLayout(sourceLayout) {
    const layout = JSON.parse(JSON.stringify(sourceLayout || {}));

    layout.paper_bgcolor = '#ffffff';
    layout.plot_bgcolor = '#ffffff';
    layout.font = {
        ...(layout.font || {}),
        color: '#111111',
        size: 17,
        family: 'Arial, sans-serif'
    };
    layout.margin = { t: 30, b: 90, l: 110, r: 30 };

    ['xaxis', 'xaxis2', 'yaxis', 'yaxis2'].forEach(axisName => {
        if (!layout[axisName]) {
            return;
        }

        layout[axisName].color = '#111111';
        layout[axisName].gridcolor = '#d9d9d9';
        layout[axisName].tickfont = {
            ...(layout[axisName].tickfont || {}),
            size: 15,
            color: '#111111'
        };
        layout[axisName].title = {
            ...(layout[axisName].title || {}),
            font: {
                ...((layout[axisName].title && layout[axisName].title.font) || {}),
                size: 17,
                color: '#111111'
            }
        };
    });

    if (layout.yaxis) {
        layout.yaxis.zerolinecolor = '#777777';
    }

    if (layout.annotations) {
        layout.annotations = layout.annotations.map(annotation => ({
            ...annotation,
            font: {
                ...(annotation.font || {}),
                color: '#111111',
                size: Math.max((annotation.font && annotation.font.size) || 10, 12)
            }
        }));
    }

    if (layout.shapes) {
        layout.shapes = layout.shapes.map(shape => {
            const updatedShape = { ...shape };
            if (updatedShape.line) {
                updatedShape.line = { ...updatedShape.line, color: '#111111' };
            }
            return updatedShape;
        });
    }

    if (layout.legend) {
        layout.legend = {
            ...layout.legend,
            bgcolor: '#ffffff',
            bordercolor: '#111111',
            borderwidth: 1,
            font: {
                ...(layout.legend.font || {}),
                color: '#111111',
                size: 14
            }
        };
    }

    return layout;
}

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
    loadingDiv.style.display = show ? 'flex' : 'none';
}

function showPlots() {
    document.getElementById('plots-container').style.display = 'block';
    document.getElementById('table-wrapper').style.display = 'block';
}

function hidePlots() {
    document.getElementById('plots-container').style.display = 'none';
    document.getElementById('table-wrapper').style.display = 'none';
}
