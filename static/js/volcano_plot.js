/**
 * Volcano Plot - CRISPRi-seq Condition Browser
 * Interactive Plotly visualization with fixed significance thresholds
 */

// Global state
let currentData = null;

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

    // Download plot button
    const downloadBtn = document.getElementById('download-plot');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            const plotDiv = document.getElementById('volcano-plot');
            Plotly.downloadImage(plotDiv, { format: 'png', width: 1000, height: 800, filename: 'volcano_plot' });
        });
    }

    loadVolcanoData();
    
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
                condition: condition
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showError(data.error || 'Failed to fetch data');
            throw new Error(data.error || 'Failed to fetch data');
        }
        
        currentData = data;

        showPlots();
        
        // Create volcano plot after the container is visible so Plotly can measure it correctly
        createVolcanoPlot(data);
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
/**
 * Create Plotly volcano plot with fixed significance thresholds.
 */
function createVolcanoPlot(data) {
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
    
    data.records.forEach(record => {
        const isSig = record.is_significant;
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
                `<b>${r.gene_name}</b><br>LFC: ${r.lfc.toFixed(2)}<br>Stouffer p: ${r.fdr.toExponential(2)}`
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
                `<b>${r.gene_name}</b><br>LFC: ${r.lfc.toFixed(2)}<br>Stouffer p: ${r.fdr.toExponential(2)}`
            ),
            hovertemplate: '%{text}<extra></extra>',
            showlegend: true
        };
        traces.push(trace2);
    }
    
    // Create shapes for threshold lines
    const shapes = [];
    
    // Vertical lines for the log2FC threshold
    {
        shapes.push({
            type: 'line',
            x0: 1,
            y0: 0,
            x1: 1,
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
            x0: -1,
            y0: 0,
            x1: -1,
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
    
    // Horizontal line for the Stouffer p-value threshold
    {
        const fdrLine = -Math.log10(0.05);
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
    const thresholdTitle = '|log2FC| > 1, Stouffer p < 0.05';

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
            title: '-Log<sub>10</sub> Stouffer p-value',
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

    const significantRecords = records.filter(record => record.is_significant);
    if (significantRecords.length === 0) {
        tableContainer.innerHTML = '<p class="empty-state">No significant genes available</p>';
        return;
    }

    const sortedRecords = [...significantRecords].sort((left, right) => {
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
                    <th>Stouffer p-value</th>
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
            layout: {
                topStart: 'buttons',
                topEnd: 'search'
            },
            buttons: [
                {extend: 'copyHtml5', text: 'Copy'},
                {extend: 'excelHtml5', text: 'Excel'}
            ],
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
