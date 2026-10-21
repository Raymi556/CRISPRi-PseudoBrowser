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
    const highlightInput = document.getElementById('highlight-genes');
    if (highlightInput) {
        new GeneAutocomplete(highlightInput, {
            apiUrl: window.GENE_LIST_URL,
            maxSuggestions: 10,
            debounceDelay: 250,
            getQuery: () => highlightInput.value.split(',').pop().trim(),
            formatSelection: value => {
                const parts = highlightInput.value.split(',');
                parts[parts.length - 1] = ` ${value}`;
                return `${parts.join(',').replace(/^ /, '')}, `;
            }
        });
    }

    // Download plot button
    const downloadBtn = document.getElementById('download-plot');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async function() {
            try {
                await downloadPaperReadyVolcanoPlot();
            } catch (error) {
                showError(error.message || 'Failed to download plot');
                console.error('Error downloading paper-ready volcano plot:', error);
            }
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
                condition: condition,
                highlight_genes: document.getElementById('highlight-genes').value
                    .split(',')
                    .map(value => value.trim())
                    .filter(Boolean)
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showError(data.error || 'Failed to fetch data');
            throw new Error(data.error || 'Failed to fetch data');
        }
        
        currentData = data;
        const criteria = document.getElementById('condition-criteria');
        if (criteria) {
            criteria.textContent = `Criteria: LFC < ${data.negative_lfc_threshold.toFixed(2)} or `
                + `LFC > ${data.positive_lfc_threshold.toFixed(2)}, `
                + `Stouffer p-value < ${data.fdr_threshold.toFixed(2)}. `
            criteria.hidden = false;
        }

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
    const highlightedGenes = data.records.filter(record => record.highlighted);
    const sensitizingGenes = [];
    const protectiveGenes = [];
    const nonSignificantGenes = [];
    
    data.records.forEach(record => {
        if (record.direction === 'sensitizing') {
            sensitizingGenes.push(record);
        } else if (record.direction === 'protective') {
            protectiveGenes.push(record);
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
            customdata: nonSignificantGenes,
            text: nonSignificantGenes.map(r => 
                `<b>${r.gene_name}</b><br>LFC: ${r.lfc.toFixed(2)}<br>Stouffer p: ${r.fdr.toExponential(2)}`
            ),
            hovertemplate: '%{text}<extra></extra>',
            showlegend: true
        };
        traces.push(trace1);
    }
    
    function categoryTrace(records, name, color) {
        return {
            x: records.map(r => r.lfc),
            y: records.map(r => r.log10_fdr),
            mode: 'markers',
            type: 'scatter',
            name: name,
            marker: {size: 8, color: color, line: {color: color, width: 1}},
            customdata: records,
            text: records.map(r =>
                `<b>${r.gene_name}</b><br>LFC: ${r.lfc.toFixed(2)}<br>Stouffer p: ${r.fdr.toExponential(2)}`
            ),
            hovertemplate: '%{text}<extra></extra>',
            showlegend: true
        };
    }

    if (sensitizingGenes.length > 0) {
        traces.push(categoryTrace(sensitizingGenes, 'Sensitizing', '#3b82c4'));
    }
    if (protectiveGenes.length > 0) {
        traces.push(categoryTrace(protectiveGenes, 'Protective', '#991b1b'));
    }
    if (highlightedGenes.length > 0) {
        traces.push({
            x: highlightedGenes.map(record => record.lfc),
            y: highlightedGenes.map(record => record.log10_fdr),
            mode: 'markers+text',
            type: 'scatter',
            name: 'Highlighted genes',
            text: highlightedGenes.map(record => record.gene_name),
            textposition: 'top center',
            marker: {size: 13, color: '#f59e0b', line: {color: '#111111', width: 1.5}},
            customdata: highlightedGenes,
            hovertemplate: '<b>%{text}</b><extra></extra>',
            showlegend: true
        });
    }
    if (sensitizingGenes.length + protectiveGenes.length > 0) {
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
        margin: { t: 60, b: 130, l: 80, r: 40 },
        height: 700,
        hovermode: 'closest',
        legend: {
            x: 0.04,
            y: 0.06,
            xanchor: 'left',
            yanchor: 'bottom',
            bgcolor: 'rgba(26, 26, 26, 0.8)',
            bordercolor: '#404040',
            borderwidth: 1
        }
    };
    
    const config = {
        responsive: true,
        displaylogo: false
    };
    
    Plotly.newPlot(plotDiv, traces, layout, config).then(() => {
        plotDiv.on('plotly_click', event => {
            const point = event.points[0];
            const record = point && point.data && point.data.customdata
                ? point.data.customdata[point.pointNumber]
                : null;
            if (!record) {
                return;
            }
            filterTableFromPlot({
                tableSelector: '#genes-datatable',
                columnIndex: 0,
                value: record.gene_name,
                label: 'gene',
                messageId: 'genes-table-filter'
            });
        });
    });
}

async function downloadPaperReadyVolcanoPlot() {
    const sourcePlotDiv = document.getElementById('volcano-plot');
    if (!sourcePlotDiv || !sourcePlotDiv.data || !sourcePlotDiv.layout) {
        throw new Error('Plot is not available for download');
    }

    const paperData = JSON.parse(JSON.stringify(sourcePlotDiv.data));
    const paperLayout = buildPaperReadyVolcanoLayout(sourcePlotDiv.layout);
    addPaperReadyVolcanoLabels(paperData, paperLayout);
    const exportWidth = 1800;
    const exportHeight = 1400;
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
            filename: 'volcano_plot',
            width: exportWidth,
            height: exportHeight,
            scale: 2
        });
    } finally {
        Plotly.purge(tempDiv);
        tempDiv.remove();
    }

    function addPaperReadyVolcanoLabels(data, layout) {
        const records = currentData.records
            .filter(record => record.is_significant)
            .sort((left, right) => left.fdr - right.fdr)
            .slice(0, 20);
        const placed = [];
        layout.annotations = (layout.annotations || []).concat(records.map((record, index) => {
            const crowded = placed.some(previous =>
                Math.abs(previous.x - record.lfc) < 0.45
                && Math.abs(previous.y - record.log10_fdr) < 1.5
            );
            const side = index % 2 === 0 ? 1 : -1;
            const vertical = crowded ? (index % 3 === 0 ? -58 : 58) : (index % 3 === 0 ? -34 : 34);
            placed.push({x: record.lfc, y: record.log10_fdr});
            return {
                x: record.lfc,
                y: record.log10_fdr,
                xref: 'x',
                yref: 'y',
                text: `<i>${record.gene_name}</i>`,
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: 1,
                arrowcolor: '#333333',
                ax: side * (crowded ? 42 : 28),
                ay: vertical,
                font: {size: 15, color: '#111111'},
                bgcolor: 'rgba(255,255,255,0.8)'
            };
        }));
    }
}

function buildPaperReadyVolcanoLayout(sourceLayout) {
    const layout = JSON.parse(JSON.stringify(sourceLayout || {}));

    layout.paper_bgcolor = '#ffffff';
    layout.plot_bgcolor = '#ffffff';
    layout.font = {
        ...(layout.font || {}),
        color: '#111111',
        size: 22,
        family: 'Arial, sans-serif'
    };
    layout.margin = { t: 80, b: 110, l: 120, r: 50 };
    layout.annotations = (layout.annotations || []).map(annotation => ({
        ...annotation,
        font: {
            ...(annotation.font || {}),
            color: '#111111',
            size: Math.max((annotation.font && annotation.font.size) || 15, 15)
        },
        bgcolor: annotation.bgcolor || 'rgba(255,255,255,0.8)',
        bordercolor: annotation.bordercolor || '#777777',
        borderwidth: annotation.borderwidth || 0.5
    }));

    ['xaxis', 'yaxis'].forEach(axisName => {
        if (!layout[axisName]) {
            return;
        }

        layout[axisName].color = '#111111';
        layout[axisName].gridcolor = '#d9d9d9';
        layout[axisName].tickfont = {
            ...(layout[axisName].tickfont || {}),
            size: 20,
            color: '#111111'
        };
        layout[axisName].title = {
            ...(layout[axisName].title || {}),
            font: {
                ...((layout[axisName].title && layout[axisName].title.font) || {}),
                size: 22,
                color: '#111111'
            }
        };
        layout[axisName].zerolinecolor = '#777777';
    });

    if (layout.title) {
        layout.title = {
            ...layout.title,
            text: layout.title.text.replace(', Stouffer p < 0.05', ''),
            font: {
                ...(layout.title.font || {}),
                size: 24,
                color: '#111111'
            }
        };
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
                size: 18
            }
        };
    }

    if (layout.shapes) {
        layout.shapes = layout.shapes
            .filter(shape => !(shape.type === 'line' && shape.yref === 'y'))
            .map(shape => {
                const updatedShape = { ...shape };
                if (updatedShape.line) {
                    updatedShape.line = { ...updatedShape.line, color: '#555555' };
                }
                return updatedShape;
            });
    }

    return layout;
}

/**
 * Create genes table
 */
function createGenesTable(records) {
    const tableContainer = document.getElementById('genes-table-container');
    document.getElementById('genes-table-filter').hidden = true;
    
    if (!records || records.length === 0) {
        tableContainer.innerHTML = '<p class="empty-state">No genes available</p>';
        return;
    }

    const tableRecords = records.filter(record => record.is_significant || record.highlighted);
    if (tableRecords.length === 0) {
        tableContainer.innerHTML = '<p class="empty-state">No significant or highlighted genes available</p>';
        return;
    }

    const sortedRecords = [...tableRecords].sort((left, right) => {
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
            <tfoot>
                <tr>
                    <td><input type="text" class="column-search" placeholder="Gene" data-column="0"></td>
                    <td><input type="text" class="column-search" placeholder="PAO1 ID" data-column="1"></td>
                    <td><input type="text" class="column-search" placeholder="Log2 FC" data-column="2"></td>
                    <td><input type="text" class="column-search" placeholder="p-value" data-column="3"></td>
                    <td><input type="text" class="column-search" placeholder="Product" data-column="4"></td>
                </tr>
            </tfoot>
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
            lengthMenu: [10, 25, 50],
            layout: {
                topStart: 'buttons',
                topEnd: 'search',
                bottomStart: 'pageLength',
                bottomEnd: ['info', 'paging']
            },
            buttons: [
                {extend: 'copyHtml5', text: 'Copy'},
                {extend: 'excelHtml5', text: 'Excel'}
            ],
            language: {
                search: 'Search genes:',
                info: 'Total entries: _TOTAL_',
                paginate: {
                    previous: '← Previous',
                    next: 'Next →'
                }
            }
        });
        $('#genes-datatable').on('keyup change', '.column-search', function() {
            const columnIndex = $(this).data('column');
            table.column(columnIndex).search($(this).val()).draw();
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
