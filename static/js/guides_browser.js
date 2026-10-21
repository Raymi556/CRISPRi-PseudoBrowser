function showGuidesError(message) {
    const error = document.getElementById('guides-error');
    error.textContent = message;
    error.hidden = false;
}

function clearGuidesError() {
    const error = document.getElementById('guides-error');
    error.hidden = true;
    error.textContent = '';
}

function renderGuideResults(data) {
    const body = document.querySelector('#guide-ranking-table tbody');
    if ($.fn.dataTable.isDataTable('#guide-ranking-table')) {
        $('#guide-ranking-table').DataTable().destroy();
    }
    body.innerHTML = data.records.map((record) => `
        <tr>
            <td><code class="code-chip">${record.spacer}</code></td>
            <td>${record.kawalek_score === '' ? 'N/A' : Number(record.kawalek_score).toFixed(3)}</td>
            <td>${record.off_target_n === '' ? 'N/A' : record.off_target_n}</td>
            <td>${Number(record.median_lfc).toFixed(3)}</td>
            <td>${Number(record.max_abs_lfc).toFixed(3)}</td>
            <td>${Number(record.median_abundance).toFixed(2)}</td>
            <td>${record.conditions}</td>
            <td>${record.batches}</td>
        </tr>
    `).join('');

    new DataTable('#guide-ranking-table', {
        pageLength: 10,
        lengthMenu: [10, 25, 50],
        searching: true,
        ordering: true,
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
        order: [[1, 'desc']],
        language: {
            info: 'Total entries: _TOTAL_',
            paginate: {
                previous: '← Previous',
                next: 'Next →'
            }
        }
    });
    document.getElementById('guides-results').hidden = false;
}

async function loadGuideResults() {
    clearGuidesError();
    const query = document.getElementById('guide-gene').value.trim();
    if (!query) {
        showGuidesError('Enter a gene name or PAO1 ID.');
        return;
    }
    try {
        const response = await fetch(`/guides/api/data/?gene=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to load guide data.');
        }
        renderGuideResults(data);
    } catch (error) {
        showGuidesError(error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GeneAutocomplete(document.getElementById('guide-gene'), {
        apiUrl: window.GUIDES_LIST_URL
    });
    document.getElementById('guide-search').addEventListener('click', loadGuideResults);
    document.getElementById('guide-gene').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loadGuideResults();
    });
});
