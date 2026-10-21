let mismatchData = null;

document.addEventListener('DOMContentLoaded', () => {
    const geneInput = document.getElementById('mismatch-gene');
    new GeneAutocomplete(geneInput, {
        apiUrl: window.GENE_LIST_URL,
        maxSuggestions: 10,
        debounceDelay: 300,
        getQuery: () => geneInput.value.split(',').pop(),
        formatSelection: value => {
            const prefix = geneInput.value.slice(0, geneInput.value.lastIndexOf(',') + 1);
            return `${prefix}${prefix ? ' ' : ''}${value}, `;
        }
    });
    document.getElementById('mismatch-form').addEventListener('submit', loadMismatchData);
    document.getElementById('mismatch-download').addEventListener('click', () => {
        if (mismatchData) {
            downloadPaperReadyMismatchPlot().catch(error => {
                const errorBox = document.getElementById('mismatch-error');
                errorBox.textContent = error.message || 'Failed to download plot';
                errorBox.hidden = false;
                console.error('Error downloading paper-ready mismatch plot:', error);
            });
        }

    });
});

function formatMetric(value) {
    return value === null || value === undefined ? 'NA' : Number(value).toFixed(2);
}

async function downloadPaperReadyMismatchPlot() {
    const sourcePlots = Array.from(
        document.querySelectorAll('.mismatch-panel > div[id$="-plot"]')
    ).filter(plot => plot.data && plot.layout);
    if (!sourcePlots.length) {
        throw new Error('No mismatch plots are available for download');
    }

    const columns = sourcePlots.length === 1 ? 1 : sourcePlots.length <= 4 ? 2 : 3;
    const panelWidth = 1000;
    const panelHeight = 760;
    const titleHeight = 55;
    const canvas = document.createElement('canvas');
    canvas.width = columns * panelWidth;
    canvas.height = Math.ceil(sourcePlots.length / columns) * panelHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 24px Arial, sans-serif';
    context.fillStyle = '#111111';

    for (let index = 0; index < sourcePlots.length; index += 1) {
        const sourcePlot = sourcePlots[index];
        const row = Math.floor(index / columns);
        const column = index % columns;
        const temporaryPlot = document.createElement('div');
        temporaryPlot.style.position = 'fixed';
        temporaryPlot.style.left = '-10000px';
        temporaryPlot.style.width = `${panelWidth}px`;
        temporaryPlot.style.height = `${panelHeight - titleHeight}px`;
        document.body.appendChild(temporaryPlot);
        try {
            const paperLayout = buildPaperReadyMismatchLayout(sourcePlot.layout);
            paperLayout.width = panelWidth;
            paperLayout.height = panelHeight - titleHeight;
            await Plotly.newPlot(
                temporaryPlot,
                JSON.parse(JSON.stringify(sourcePlot.data)),
                paperLayout,
                {displayModeBar: false, displaylogo: false, staticPlot: true}
            );
            const imageUrl = await Plotly.toImage(temporaryPlot, {
                format: 'png',
                width: panelWidth,
                height: panelHeight - titleHeight,
                scale: 1
            });
            const image = await loadImage(imageUrl);
            const x = column * panelWidth;
            const y = row * panelHeight;
            const title = document.querySelectorAll('.mismatch-panel h3')[index];
            context.fillText(title ? title.textContent : `Mismatch panel ${index + 1}`, x + 20, y + 35);
            context.drawImage(image, x, y + titleHeight, panelWidth, panelHeight - titleHeight);
        } finally {
            Plotly.purge(temporaryPlot);
            temporaryPlot.remove();
        }
    }

    const link = document.createElement('a');
    link.download = 'mismatch_data_grid.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
    });
}

function buildPaperReadyMismatchLayout(sourceLayout) {
    const layout = JSON.parse(JSON.stringify(sourceLayout || {}));

    layout.paper_bgcolor = '#ffffff';
    layout.plot_bgcolor = '#ffffff';
    layout.font = {
        ...(layout.font || {}),
        color: '#111111',
        size: 22,
        family: 'Arial, sans-serif'
    };
    layout.margin = { t: 50, b: 120, l: 120, r: 50 };

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
        layout.shapes = layout.shapes.map(shape => {
            const updatedShape = { ...shape };
            if (updatedShape.line) {
                updatedShape.line = { ...updatedShape.line, color: '#555555' };
            }
            return updatedShape;
        });
    }
    if (layout.annotations) {
        layout.annotations = layout.annotations.map(annotation => ({
            ...annotation,
            bgcolor: '#ffffff',
            bordercolor: '#111111',
            borderwidth: 1,
            font: {
                ...(annotation.font || {}),
                color: '#111111',
                size: Math.max((annotation.font && annotation.font.size) || 16, 16)
            }
        }));
    }

    return layout;
}

async function loadMismatchData(event) {
    event.preventDefault();
    const error = document.getElementById('mismatch-error');
    const loading = document.getElementById('mismatch-loading');
    error.hidden = true;
    loading.hidden = false;
    try {
        const response = await fetch(window.MISMATCH_DATA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.CSRF_TOKEN
            },
            body: JSON.stringify({
                genes: document.getElementById('mismatch-gene').value
                    .split(',')
                    .map(value => value.trim())
                    .filter(Boolean),
                conditions: Array.from(
                    document.getElementById('mismatch-condition').selectedOptions
                ).map(option => option.value)
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load mismatch data.');
        mismatchData = data.panels
            ? data.panels.map(panel => panel.data).filter(Boolean)
            : [data];
        renderMismatchPanels(data.panels || [{data}]);
    } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
    } finally {
        loading.hidden = true;
    }
}

function renderMismatchPanels(panels) {
    const results = document.getElementById('mismatch-results');
    const title = document.getElementById('mismatch-title');
    title.textContent = 'Mismatch plots';
    const grid = document.getElementById('mismatch-plot');
    grid.className = 'mismatch-panel-grid';
    grid.style.gridTemplateColumns = panels.length <= 4
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))';
    grid.innerHTML = panels.map((panel, index) => {
        const panelId = `mismatch-panel-${index}`;
        if (panel.error) {
            return `<div class="mismatch-panel mismatch-panel--error">
                <strong>${panel.gene_input} - ${panel.condition}</strong>
                <p>${panel.error}</p>
            </div>`;
        }
        return `<div class="mismatch-panel">
            <h3>${panel.data.gene} (${panel.data.PAO1_ID}) - ${panel.data.condition}</h3>
            <div id="${panelId}-plot"></div>
            <div id="${panelId}-filter" class="table-filter-message" hidden></div>
            <div id="${panelId}-table"></div>
        </div>`;
    }).join('');
    results.hidden = false;
    panels.forEach((panel, index) => {
        if (!panel.error) {
            renderMismatchPanel(
                panel.data,
                `mismatch-panel-${index}-plot`,
                `mismatch-panel-${index}-table`,
                `mismatch-panel-${index}-filter`,
                index
            );
        }
    });
    const tableSelect = document.getElementById('mismatch-table-select');
    const tableContainer = document.getElementById('mismatch-table');
    tableContainer.innerHTML = '';
    tableSelect.innerHTML = '';
    panels.forEach((panel, index) => {
        if (!panel.data) return;
        const source = document.getElementById(`mismatch-panel-${index}-table`);
        const filter = document.getElementById(`mismatch-panel-${index}-filter`);
        source.hidden = index !== 0;
        filter.hidden = true;
        tableContainer.append(filter, source);
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${panel.data.gene} (${panel.data.PAO1_ID}) - ${panel.data.condition}`;
        tableSelect.appendChild(option);
    });
    tableSelect.onchange = () => selectMismatchTable(Number(tableSelect.value));
}

function selectMismatchTable(index) {
    document.querySelectorAll('#mismatch-table > div[id$="-table"]').forEach(table => {
        table.hidden = !table.id.startsWith(`mismatch-panel-${index}-`);
    });
}

function renderMismatchPanel(data, plotId, tableId, filterId, panelIndex) {
    document.getElementById('mismatch-results').hidden = false;
    const mismatch = data.records.filter(record => record.type === 'mismatch');
    const traces = [
        {
            x: mismatch.map(record => record.y_pred),
            y: mismatch.map(record => record['LFC.adj']),
            text: mismatch.map(record => record.original),
            customdata: mismatch,
            mode: 'markers',
            name: 'Mismatch guides',
            marker: {color: '#dc2626', size: 8}
        },
        {
            x: data.bins.map(record => record.y_pred),
            y: data.bins.map(record => record.med_LFC),
            mode: 'lines+markers',
            name: 'Binned median',
            marker: {color: '#0f766e', size: 7},
            line: {color: '#0f766e', width: 2}
        }
    ];
    if (data.predicted.length) {
        traces.push({
            x: data.predicted.map(record => record.dose),
            y: data.predicted.map(record => record.p),
            mode: 'lines',
            name: 'Sigmoid fit',
            line: {color: '#f59e0b', width: 2}
        });
    }
    const shapes = [-1, 2].map(value => ({
        type: 'line',
        x0: 0.05,
        x1: 1,
        y0: value,
        y1: value,
        line: {color: '#a0a0a0', dash: 'dash'}
    }));
    ['ec50', 'sensitivity', 'protection'].forEach(key => {
        if (data.summary[key] !== null) {
            shapes.push({
                type: 'line',
                x0: data.summary[key],
                x1: data.summary[key],
                y0: -15,
                y1: 15,
                line: {color: '#555555', dash: 'dot'}
            });
        }
    });
    const summaryBox = {
        x: 0.06,
        y: 0.08,
        xref: 'paper',
        yref: 'paper',
        xanchor: 'left',
        yanchor: 'bottom',
        align: 'left',
        text: [
            `Sev=${formatMetric(data.summary.severity)}`,
            `Emax=${formatMetric(data.summary.emax)}`,
            `EC50=${formatMetric(data.summary.ec50)}`,
            `Sens=${formatMetric(data.summary.sensitivity)}`,
            `Prot=${formatMetric(data.summary.protection)}`
        ].join('<br>'),
        showarrow: false,
        bgcolor: 'rgba(26, 26, 26, 0.9)',
        bordercolor: '#a0a0a0',
        borderwidth: 1,
        borderpad: 5,
        font: {color: '#e0e0e0', size: 11}
    };
    Plotly.newPlot(plotId, traces, {
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: {color: '#e0e0e0'},
        xaxis: {title: 'Predicted guide activity', range: [0.05, 1.05]},
        yaxis: {title: 'Adjusted log2FC'},
        shapes,
        annotations: [summaryBox],
        height: 560,
        legend: {
            x: 1,
            y: 1,
            xanchor: 'right',
            yanchor: 'top',
            bgcolor: 'rgba(26, 26, 26, 0.85)',
            bordercolor: '#a0a0a0',
            borderwidth: 1
        },
        hovermode: 'closest'
    }, {responsive: true, displaylogo: false}).then(() => {
        const plot = document.getElementById(plotId);
        plot.on('plotly_click', event => {
            const point = event.points[0];
            const record = point && point.data && point.data.customdata
                ? point.data.customdata[point.pointNumber]
                : null;
            if (!record) {
                return;
            }
            const tableSelect = document.getElementById('mismatch-table-select');
            tableSelect.value = panelIndex;
            selectMismatchTable(panelIndex);
            filterTableFromPlot({
                tableSelector: `#${tableId}-data`,
                columnIndex: 4,
                value: record.original,
                label: 'parent guide',
                messageId: filterId
            });
        });
    });

    const summary = data.summary;
    const rows = data.records.map(record => `
        <tr>
            <td>${record.type}</td>
            <td>${record.y_pred}</td>
            <td>${Number(record['LFC.adj']).toFixed(3)}</td>
            <td>${record.spacer}</td>
            <td>${record.original}</td>
            <td>${record.batch}</td>
        </tr>
    `).join('');
    document.getElementById(tableId).innerHTML = `
        <table id="${tableId}-data" class="table table--full-width display">
            <thead><tr><th>Type</th><th>Predicted activity</th><th>Adjusted log2FC</th><th>Guide</th><th>Parent guide</th><th>Batch</th></tr></thead>
            <tfoot><tr>
                <td><input type="text" class="column-search" placeholder="Type" data-column="0"></td>
                <td><input type="text" class="column-search" placeholder="Activity" data-column="1"></td>
                <td><input type="text" class="column-search" placeholder="Log2FC" data-column="2"></td>
                <td><input type="text" class="column-search" placeholder="Guide" data-column="3"></td>
                <td><input type="text" class="column-search" placeholder="Parent guide" data-column="4"></td>
                <td><input type="text" class="column-search" placeholder="Batch" data-column="5"></td>
            </tr></tfoot>
            <tbody>${rows}</tbody>
        </table>
    `;
    const table = new DataTable(`#${tableId}-data`, {
        destroy: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50],
        responsive: true,
        paging: true,
        searching: true,
        ordering: true,
        order: [[2, 'asc']],
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
            search: 'Search guides:',
            info: 'Total entries: _TOTAL_',
            paginate: {
                previous: '← Previous',
                next: 'Next →'
            }
        }
    });
    $(`#${tableId}-data`).on('keyup change', '.column-search', function() {
        const columnIndex = $(this).data('column');
        table.column(columnIndex).search($(this).val()).draw();
    });
}
