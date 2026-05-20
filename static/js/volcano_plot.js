/**
 * Volcano Plot - CRISPRi-seq Condition Browser
 * Interactive Plotly visualization with adjustable thresholds
 */

// Global state
let currentData = null;
let lfcThresholdSlider = null;
let fdrThresholdSlider = null;

function setHidden(element, hidden) {
    if (element) {
        element.hidden = hidden;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Condition browser initializing...');
    console.log('Available globals:', {
        VOLCANO_DATA_URL: window.VOLCANO_DATA_URL,
        CSRF_TOKEN: window.CSRF_TOKEN
    });
    
    const form = document.getElementById('volcano-form');
    form.addEventListener('submit', handleFormSubmit);
    
    // Initialize LFC threshold slider
    const lfcSlider = document.getElementById('lfc-threshold-slider');
    const lfcInput = document.getElementById('lfc-threshold-input');
    if (lfcSlider && lfcInput) {
        lfcThresholdSlider = new CustomSlider(lfcSlider, lfcInput, {
            min: 0,
            max: 5,
            step: 0.001,
            defaultValue: 0,
            storageKey: 'volcanoLFCThreshold',
            onChange: (value) => {
                // Debounce redraw
                if (currentData) {
                    redrawVolcanoPlot();
                }
            }
        });
        
        // Add real-time input listener for smooth dragging
        lfcSlider.addEventListener('input', () => {
            lfcInput.value = parseFloat(lfcSlider.value).toFixed(3);
            if (currentData) {
                redrawVolcanoPlot();
            }
        });
    }
    
    // Initialize FDR threshold slider
    const fdrSlider = document.getElementById('fdr-threshold-slider');
    const fdrInput = document.getElementById('fdr-threshold-input');
    if (fdrSlider && fdrInput) {
        fdrThresholdSlider = new CustomSlider(fdrSlider, fdrInput, {
            min: 0,
            max: 300,
            step: 0.001,
            defaultValue: 0,
            storageKey: 'volcanoFDRThreshold',
            onChange: (value) => {
                // Debounce redraw
                if (currentData) {
                    redrawVolcanoPlot();
                }
            }
        });
        
        // Add real-time input listener for smooth dragging
        fdrSlider.addEventListener('input', () => {
            fdrInput.value = parseFloat(fdrSlider.value).toFixed(3);
            if (currentData) {
                redrawVolcanoPlot();
            }
        });
    }
    
    // Download plot button
    const downloadBtn = document.getElementById('download-plot');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            const plotDiv = document.getElementById('volcano-plot');
            Plotly.downloadImage(plotDiv, { format: 'png', width: 1000, height: 800, filename: 'volcano_plot' });
        });
    }
    
    console.log('Condition browser initialization complete');
});

/**
 * Handle form submission
 */
function handleFormSubmit(event) {
    event.preventDefault();
    loadVolcanoData();
}

/**
 * Fetch volcano data from the server
 */
async function loadVolcanoData() {
    const condition = document.getElementById('condition-select').value;
    const lfcThreshold = parseFloat(document.getElementById('lfc-threshold-input').value);
    const fdrLogThreshold = parseFloat(document.getElementById('fdr-threshold-input').value);
    const fdrThreshold = Math.pow(10, -fdrLogThreshold);
    
    if (!condition) {
        showError('Please select a condition');
        return;
    }
    
    // Show loading, hide previous results
    showLoading(true);
    hideError();
    hidePlots();
    
    try {
        const response = await fetch(window.VOLCANO_DATA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.CSRF_TOKEN
            },
            body: JSON.stringify({
                condition: condition,
                lfc_threshold: lfcThreshold,
                fdr_threshold: fdrThreshold
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showError(data.error || 'Failed to fetch data');
            throw new Error(data.error || 'Failed to fetch data');
        }
        
        currentData = data;

        const fdrSlider = document.getElementById('fdr-threshold-slider');
        const fdrInput = document.getElementById('fdr-threshold-input');
        const maxLog10Fdr = Number.isFinite(data.max_log10_fdr) ? data.max_log10_fdr : 5;
        if (fdrSlider) {
            fdrSlider.max = maxLog10Fdr.toFixed(3);
        }
        if (fdrInput) {
            fdrInput.max = maxLog10Fdr.toFixed(3);
        }
        if (fdrThresholdSlider && typeof fdrThresholdSlider.updateLimits === 'function') {
            fdrThresholdSlider.updateLimits(0, maxLog10Fdr);
        }
        if (parseFloat(fdrInput.value) > maxLog10Fdr) {
            fdrInput.value = maxLog10Fdr.toFixed(3);
            fdrSlider.value = maxLog10Fdr.toFixed(3);
        }
        
        showPlots();
        
        // Create volcano plot after the container is visible so Plotly can measure it correctly
        createVolcanoPlot(data, lfcThreshold, fdrLogThreshold);
        createGenesTable(data.records);
        
        const plotDiv = document.getElementById('volcano-plot');
        if (plotDiv && window.Plotly) {
            requestAnimationFrame(() => {
                Plotly.Plots.resize(plotDiv);
            });
        }
        
    } catch (error) {
        showError(error.message);
        console.error('Error loading volcano data:', error);
    } finally {
        showLoading(false);
    }
}

/**
 * Redraw volcano plot with updated thresholds
 */
function redrawVolcanoPlot() {
    if (!currentData || !currentData.records) return;
    
    const lfcThreshold = parseFloat(document.getElementById('lfc-threshold-input').value);
    const fdrThreshold = parseFloat(document.getElementById('fdr-threshold-input').value);
    
    createVolcanoPlot(currentData, lfcThreshold, fdrThreshold);
}

/**
 * Create Plotly volcano plot with interactive threshold lines
 */
function createVolcanoPlot(data, lfcThreshold, fdrThreshold) {
    const plotDiv = document.getElementById('volcano-plot');
    
    if (!plotDiv) {
        throw new Error('Plot container "volcano-plot" was not found in the DOM');
    }
    
    plotDiv.innerHTML = '';
    
    if (!data.records || data.records.length === 0) {
        plotDiv.innerHTML = '<p class="empty-state">No data available for this condition</p>';
        return;
    }
    
    // Separate significant and non-significant genes
    const significantGenes = [];
    const nonSignificantGenes = [];
    
    const actualFdrThreshold = Math.pow(10, -fdrThreshold);

    data.records.forEach(record => {
        const isSig = (Math.abs(record.lfc) >= Math.abs(lfcThreshold)) && (record.fdr <= actualFdrThreshold);
        if (isSig) {
            significantGenes.push(record);
        } else {
            nonSignificantGenes.push(record);
        }
    });
    
    // Create traces
    const traces = [];
    
    // Non-significant genes trace
    if (nonSignificantGenes.length > 0) {
        const trace1 = {
            x: nonSignificantGenes.map(r => r.lfc),
            y: nonSignificantGenes.map(r => r.log10_fdr),
            mode: 'markers',
            type: 'scatter',
            name: 'Not Significant',
            marker: {
                size: 6,
                color: 'rgba(160, 160, 160, 0.5)',
                line: {
                    color: 'rgba(160, 160, 160, 0.7)',
                    width: 0.5
                }
            },
            text: nonSignificantGenes.map(r => 
                `<b>${r.gene_name}</b><br>LFC: ${r.lfc.toFixed(2)}<br>FDR: ${r.fdr.toExponential(2)}`
            ),
            hovertemplate: '%{text}<extra></extra>',
            showlegend: true
        };
        traces.push(trace1);
    }
    
    // Significant genes trace
    if (significantGenes.length > 0) {
        const trace2 = {
            x: significantGenes.map(r => r.lfc),
            y: significantGenes.map(r => r.log10_fdr),
            mode: 'markers',
            type: 'scatter',
            name: 'Significant',
            marker: {
                size: 8,
                color: '#dc2626',
                line: {
                    color: '#ef4444',
                    width: 1
                }
            },
            text: significantGenes.map(r => 
                `<b>${r.gene_name}</b><br>LFC: ${r.lfc.toFixed(2)}<br>FDR: ${r.fdr.toExponential(2)}`
            ),
            hovertemplate: '%{text}<extra></extra>',
            showlegend: true
        };
        traces.push(trace2);
    }
    
    // Create shapes for threshold lines
    const shapes = [];
    
    // Vertical lines for LFC thresholds
    if (lfcThreshold > 0) {
        shapes.push({
            type: 'line',
            x0: lfcThreshold,
            y0: 0,
            x1: lfcThreshold,
            y1: 1,
            xref: 'x',
            yref: 'paper',
            line: {
                color: 'rgba(220, 38, 38, 0.5)',
                width: 2,
                dash: 'dash'
            }
        });
        
        shapes.push({
            type: 'line',
            x0: -lfcThreshold,
            y0: 0,
            x1: -lfcThreshold,
            y1: 1,
            xref: 'x',
            yref: 'paper',
            line: {
                color: 'rgba(220, 38, 38, 0.5)',
                width: 2,
                dash: 'dash'
            }
        });
    }
    
    // Horizontal line for FDR threshold
    if (fdrThreshold > 0) {
        const fdrLine = fdrThreshold;
        shapes.push({
            type: 'line',
            x0: 0,
            y0: fdrLine,
            x1: 1,
            y1: fdrLine,
            xref: 'paper',
            yref: 'y',
            line: {
                color: 'rgba(220, 38, 38, 0.5)',
                width: 2,
                dash: 'dash'
            }
        });
    }
    
    // Create layout
    const thresholdTitle = `|LFC| ≥ ${Math.abs(lfcThreshold).toFixed(3)}, -log10(FDR) ≥ ${fdrThreshold.toFixed(3)}`;

    const layout = {
        title: {
            text: `${data.condition} (${thresholdTitle})`,
            font: { size: 16, color: '#e0e0e0' }
        },
        xaxis: {
            title: 'Log<sub>2</sub> Fold Change',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a',
            zeroline: true,
            zerolinecolor: '#666666',
            zerolinewidth: 1.5
        },
        yaxis: {
            title: '-Log<sub>10</sub> FDR',
            color: '#a0a0a0',
            gridcolor: '#2a2a2a',
            zeroline: true,
            zerolinecolor: '#666666',
            zerolinewidth: 1.5
        },
        shapes: shapes,
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#e0e0e0' },
        margin: { t: 60, b: 80, l: 80, r: 40 },
        height: 700,
        hovermode: 'closest',
        legend: {
            x: 0.02,
            y: 0.98,
            xanchor: 'left',
            yanchor: 'top',
            bgcolor: 'rgba(26, 26, 26, 0.8)',
            bordercolor: '#404040',
            borderwidth: 1
        }
    };
    
    const config = {
        responsive: true,
        displaylogo: false
    };
    
    Plotly.newPlot(plotDiv, traces, layout, config);
}

/**
 * Create genes table
 */
function createGenesTable(records) {
    const tableContainer = document.getElementById('genes-table-container');
    
    if (!records || records.length === 0) {
        tableContainer.innerHTML = '<p class="empty-state">No genes available</p>';
        return;
    }

    const sortedRecords = [...records].sort((left, right) => {
        const leftFdr = Number(left.fdr);
        const rightFdr = Number(right.fdr);
        return leftFdr - rightFdr;
    });
    
    // Create table HTML
    let tableHTML = `
        <table class="table table--full-width" id="genes-datatable">
            <thead>
                <tr>
                    <th>Gene Name</th>
                    <th>PAO1 ID</th>
                    <th>Log2 FC</th>
                    <th>FDR</th>
                    <th>Product</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedRecords.forEach(record => {
        const geneLink = `/gene/?gene=${encodeURIComponent(record.gene_name)}&condition=${encodeURIComponent(currentData.condition)}`;
        tableHTML += `
            <tr>
                <td class="table-cell-primary"><a href="${geneLink}" class="table-link">${record.gene_name}</a></td>
                <td class="table-cell-secondary table-cell-secondary--small">${record.PAO1_ID}</td>
                <td class="table-cell-primary">${record.lfc.toFixed(3)}</td>
                <td class="table-cell-secondary" data-order="${record.fdr}">${record.fdr.toExponential(2)}</td>
                <td class="table-cell-secondary table-cell-secondary--small">${record.product_name || '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    
    tableContainer.innerHTML = tableHTML;
    
    // Initialize DataTables if available
    if ($.fn.dataTable) {
        const table = $('#genes-datatable').DataTable({
            destroy: true,
            paging: true,
            searching: true,
            ordering: true,
            order: [[3, 'asc']],
            pageLength: 10,
            language: {
                search: 'Search genes:',
                paginate: {
                    previous: '← Previous',
                    next: 'Next →'
                }
            }
        });
    }
}

/**
 * UI Helper functions
 */
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    setHidden(errorDiv, false);
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    setHidden(errorDiv, true);
}

function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    setHidden(loadingDiv, !show);
}

function showPlots() {
    const plotsContainer = document.getElementById('plots-container');
    const volcanoCard = document.getElementById('volcano-info-card');
    const tableWrapper = document.getElementById('table-wrapper');
    
    setHidden(plotsContainer, false);
    setHidden(volcanoCard, false);
    setHidden(tableWrapper, false);
}

function hidePlots() {
    const plotsContainer = document.getElementById('plots-container');
    const volcanoCard = document.getElementById('volcano-info-card');
    const tableWrapper = document.getElementById('table-wrapper');
    
    setHidden(plotsContainer, true);
    setHidden(volcanoCard, true);
    setHidden(tableWrapper, true);
}
