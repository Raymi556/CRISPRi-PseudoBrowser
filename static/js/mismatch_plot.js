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
            Plotly.downloadImage(document.getElementById('mismatch-plot'), {
                format: 'png',
                width: 1200,
                height: 800,
                filename: 'mismatch_data'
            });
        }
    });
});

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
    document.getElementById('mismatch-results').hidden = false;
    document.getElementById('mismatch-title').textContent =
        `${data.gene} (${data.PAO1_ID}) - ${data.condition}`;
    const perfect = data.records.filter(record => record.type === 'perfect');
    const mismatch = data.records.filter(record => record.type === 'mismatch');
    const traces = [
        {
            x: perfect.map(record => record.y_pred),
            y: perfect.map(record => record['LFC.adj']),
            text: perfect.map(record => record.spacer),
            mode: 'markers',
            name: 'Perfect guides',
            marker: {color: '#dc2626', size: 9}
        },
        {
            x: mismatch.map(record => record.y_pred),
            y: mismatch.map(record => record['LFC.adj']),
            text: mismatch.map(record => record.original),
            mode: 'markers',
            name: 'Mismatch guides',
            marker: {color: '#6f8ed7', size: 8}
        },
        {
            x: data.bins.map(record => record.y_pred),
            y: data.bins.map(record => record.med_LFC),
            mode: 'lines+markers',
            name: 'Binned median',
            marker: {color: '#ffffff', size: 7},
            line: {color: '#ffffff', width: 2}
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
    Plotly.newPlot('mismatch-plot', traces, {
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: {color: '#e0e0e0'},
        xaxis: {title: 'Predicted guide activity', range: [0.05, 1]},
        yaxis: {title: 'Adjusted log2FC'},
        shapes,
        height: 700,
        hovermode: 'closest'
    }, {responsive: true, displaylogo: false});

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
        <p class="text-muted">Severity: ${summary.severity ?? 'NA'} | EC50: ${summary.ec50 ?? 'NA'} | Sensitivity: ${summary.sensitivity ?? 'NA'} | Protection: ${summary.protection ?? 'NA'}</p>
        <table id="mismatch-data-table" class="table table--full-width display">
            <thead><tr><th>Type</th><th>Predicted activity</th><th>Adjusted log2FC</th><th>Guide</th><th>Parent guide</th><th>Batch</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    new DataTable('#mismatch-data-table', {
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
            topEnd: 'search'
        },
        buttons: [
            {extend: 'copyHtml5', text: 'Copy'},
            {extend: 'excelHtml5', text: 'Excel'}
        ],
        language: {
            search: 'Search guides:',
            paginate: {
                previous: '← Previous',
                next: 'Next →'
            }
        }
    });
}
