let mismatchData = null;

document.addEventListener('DOMContentLoaded', () => {
    const geneInput = document.getElementById('mismatch-gene');
    new GeneAutocomplete(geneInput, {
        apiUrl: window.GENE_LIST_URL,
        maxSuggestions: 10,
        debounceDelay: 300
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
    const sourcePlotDiv = document.getElementById('mismatch-plot');
    if (!sourcePlotDiv || !sourcePlotDiv.data || !sourcePlotDiv.layout) {
        throw new Error('Plot is not available for download');
    }

    const paperData = JSON.parse(JSON.stringify(sourcePlotDiv.data));
    const paperLayout = buildPaperReadyMismatchLayout(sourcePlotDiv.layout);
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
            filename: 'mismatch_data',
            width: exportWidth,
            height: exportHeight,
            scale: 2
        });
    } finally {
        Plotly.purge(tempDiv);
        tempDiv.remove();
    }
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
                gene: document.getElementById('mismatch-gene').value,
                condition: document.getElementById('mismatch-condition').value
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load mismatch data.');
        mismatchData = data;
        renderMismatchData(data);
    } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
    } finally {
        loading.hidden = true;
    }
}

function renderMismatchData(data) {
    document.getElementById('mismatch-table-filter').hidden = true;
    document.getElementById('mismatch-results').hidden = false;
    document.getElementById('mismatch-title').textContent =
        `${data.gene} (${data.PAO1_ID}) - ${data.condition}`;
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
    Plotly.newPlot('mismatch-plot', traces, {
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: {color: '#e0e0e0'},
        xaxis: {title: 'Predicted guide activity', range: [0.05, 1.05]},
        yaxis: {title: 'Adjusted log2FC'},
        shapes,
        annotations: [summaryBox],
        height: 700,
        hovermode: 'closest'
    }, {responsive: true, displaylogo: false}).then(() => {
        const plot = document.getElementById('mismatch-plot');
        plot.on('plotly_click', event => {
            const point = event.points[0];
            const record = point && point.data && point.data.customdata
                ? point.data.customdata[point.pointNumber]
                : null;
            if (!record) {
                return;
            }
            filterTableFromPlot({
                tableSelector: '#mismatch-data-table',
                columnIndex: 4,
                value: record.original,
                label: 'parent guide',
                messageId: 'mismatch-table-filter'
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
    document.getElementById('mismatch-table').innerHTML = `
        <table id="mismatch-data-table" class="table table--full-width display">
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
    const table = new DataTable('#mismatch-data-table', {
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
            bottomEnd: 'info'
        },
        buttons: [
            {extend: 'copyHtml5', text: 'Copy'},
            {extend: 'excelHtml5', text: 'Excel'}
        ],
        language: {
            search: 'Search guides:',
            info: 'Total entries: _MAX_ (showing _START_ to _END_ of _TOTAL_ matching)',
            paginate: {
                previous: '← Previous',
                next: 'Next →'
            }
        }
    });
    $('#mismatch-data-table').on('keyup change', '.column-search', function() {
        const columnIndex = $(this).data('column');
        table.column(columnIndex).search($(this).val()).draw();
    });
}
