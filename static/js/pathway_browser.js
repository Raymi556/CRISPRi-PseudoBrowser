let selectedTerm = null;
let currentGenes = [];
let searchDebounce = null;
let datasetTable = null;

function setHidden(element, hidden) {
    if (element) {
        element.hidden = hidden;
    }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const raw = await response.text();

    let data;
    try {
        data = raw ? JSON.parse(raw) : {};
    } catch (error) {
        throw new Error(`Server returned a non-JSON response (${response.status}).`);
    }

    if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}.`);
    }

    return data;
}

function getSelectedDataset() {
    return document.getElementById('dataset-select').value;
}

function getSelectedDatasetLabel() {
    const select = document.getElementById('dataset-select');
    const option = select.options[select.selectedIndex];
    return option ? option.text.trim().replace(/^PAO1\s*/i, '') : 'Dataset';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateDatasetTitle() {
    const title = document.getElementById('dataset-records-title');
    if (!title) {
        return;
    }
    title.textContent = getSelectedDatasetLabel();
}

function showPathwayMessage(text) {
    const box = document.getElementById('pathway-message');
    box.textContent = text;
    setHidden(box, false);
}

function hidePathwayMessage() {
    const box = document.getElementById('pathway-message');
    setHidden(box, true);
}

function showPathwayError(text) {
    const box = document.getElementById('pathway-error');
    box.textContent = text;
    setHidden(box, false);
}

function hidePathwayError() {
    const box = document.getElementById('pathway-error');
    setHidden(box, true);
}

function updateSelectionCount() {
    const checkedCount = document.querySelectorAll('#gene-checklist input[type="checkbox"]:checked').length;
    const totalCount = document.querySelectorAll('#gene-checklist input[type="checkbox"]').length;
    const label = document.getElementById('selection-count');
    if (totalCount === 0) {
        label.textContent = '';
        return;
    }
    label.textContent = `${checkedCount} selected of ${totalCount} linked genes`;
}

function renderGenes(genes) {
    const container = document.getElementById('gene-checklist');

    if (!genes.length) {
        container.innerHTML = '<div class="list-box__placeholder">No genes found for this term.</div>';
        updateSelectionCount();
        return;
    }

    const rows = genes.map(gene => {
        const label = gene.gene_name ? `${gene.gene_name} (${gene.PAO1_ID})` : gene.PAO1_ID;
        const checked = gene.starred ? 'checked' : '';
        return `
            <label class="list-box__item">
                <input type="checkbox" class="pathway-gene-checkbox" value="${gene.PAO1_ID}" data-gene-name="${gene.gene_name || ''}" ${checked}>
                <span class="list-box__item-text">${label}</span>
                <span class="list-box__item-meta">${gene.product_name || 'No product name available'}</span>
            </label>
        `;
    });

    container.innerHTML = rows.join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', updateSelectionCount);
    });

    updateSelectionCount();
}

function renderDatasetTable(records) {
    const container = document.getElementById('dataset-table-container');

    if (datasetTable) {
        datasetTable.destroy();
        datasetTable = null;
    }

    if (!records.length) {
        container.innerHTML = '<div class="empty-state">No dataset rows available.</div>';
        return;
    }

    const headers = Object.keys(records[0]).filter(
        key => !['PAO1 ID', 'PAO1_ID'].includes(String(key).trim().toUpperCase().replace(/\s+/g, ' '))
    );

    const dedupedRecords = [];
    const seen = new Set();
    records.forEach(record => {
        const dedupeKey = headers.map(key => String(record[key] ?? '')).join('||');
        if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            dedupedRecords.push(record);
        }
    });

    const body = dedupedRecords.map(record => {
        const accession = record.Accession || '';
        const name = record.Name || '';

        return `
            <tr>
                ${headers.map(key => {
                    const value = record[key] || '';
                    if (key === 'Accession' || key === 'Name') {
                        return `
                            <td>
                                <a href="#" class="dataset-term-link table-link" data-accession="${escapeHtml(accession)}" data-name="${escapeHtml(name)}">
                                    ${escapeHtml(value)}
                                </a>
                            </td>
                        `;
                    }
                    return `<td>${escapeHtml(value)}</td>`;
                }).join('')}
            </tr>
        `;
    }).join('');

    const footer = headers.map((key, index) => `
        <td>
            <input type="text" class="column-search" placeholder="${escapeHtml(key)}" data-column="${index}">
        </td>
    `).join('');

    container.innerHTML = `
        <div class="table-container table-container--flush">
            <table id="pathway-dataset-table" class="table table--full-width display">
                <thead><tr>${headers.map(key => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead>
                <tfoot><tr>${footer}</tr></tfoot>
                <tbody>${body}</tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.dataset-term-link').forEach(link => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            const accession = link.dataset.accession || '';
            const name = link.dataset.name || '';
            const termSearch = document.getElementById('term-search');
            termSearch.value = accession && name ? `${accession} - ${name}` : (accession || name);
            selectedTerm = {dataset: getSelectedDataset(), accession, name};
            try {
                await loadGenesForTerm({accession, name});
            } catch (error) {
                showPathwayError(error.message);
            }
        });
    });

    if ($.fn.dataTable) {
        datasetTable = $('#pathway-dataset-table').DataTable({
            destroy: true,
            paging: true,
            searching: true,
            ordering: true,
            pageLength: 10,
            lengthMenu: [10, 25, 50],
            order: [[0, 'asc']],
            layout: {
                topStart: 'buttons',
                topEnd: 'search'
            },
            buttons: [
                {extend: 'copyHtml5', text: 'Copy'},
                {extend: 'excelHtml5', text: 'Excel'}
            ],
            language: {
                search: 'Search records:',
                paginate: {
                    previous: '← Previous',
                    next: 'Next →'
                }
            }
        });

        $('#pathway-dataset-table').on('keyup change', '.column-search', function() {
            const columnIndex = $(this).data('column');
            const searchValue = $(this).val();
            datasetTable.column(columnIndex).search(searchValue).draw();
        });
    }
}

async function loadGenesForTerm(term) {
    hidePathwayError();
    hidePathwayMessage();

    const data = await fetchJson(window.PATHWAY_TERM_GENES_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.CSRF_TOKEN
        },
        body: JSON.stringify({
            dataset: getSelectedDataset(),
            accession: term.accession,
            name: term.name
        })
    });

    selectedTerm = data.selected_term;
    currentGenes = data.genes || [];

    renderGenes(currentGenes);
}

async function loadDatasetRecords() {
    const data = await fetchJson(`${window.PATHWAY_DATASET_RECORDS_URL}?dataset=${encodeURIComponent(getSelectedDataset())}`);
    renderDatasetTable(data.records || []);
}

function showTermDropdown(terms) {
    const dropdown = document.getElementById('term-dropdown');

    if (!terms.length) {
        setHidden(dropdown, true);
        dropdown.innerHTML = '';
        return;
    }

    const html = terms.map(term => `
        <div class="autocomplete-item pathway-term-item" data-accession="${term.accession}" data-name="${term.name}">
            <span class="autocomplete-value">${term.accession}</span>
            <span class="autocomplete-type">${term.name}</span>
        </div>
    `).join('');

    dropdown.innerHTML = html;
    setHidden(dropdown, false);

    dropdown.querySelectorAll('.pathway-term-item').forEach(item => {
        item.addEventListener('click', async () => {
            const accession = item.dataset.accession;
            const name = item.dataset.name;
            document.getElementById('term-search').value = `${accession} - ${name}`;
            setHidden(dropdown, true);

            try {
                await loadGenesForTerm({accession, name});
            } catch (error) {
                showPathwayError(error.message);
            }
        });
    });
}

async function searchTerms(query) {
    const dataset = getSelectedDataset();
    const url = `${window.PATHWAY_TERMS_URL}?dataset=${encodeURIComponent(dataset)}&q=${encodeURIComponent(query || '')}`;
    const data = await fetchJson(url);
    showTermDropdown(data.terms || []);
}

async function handleImportSubmit(event) {
    event.preventDefault();
    hidePathwayError();
    hidePathwayMessage();

    if (!selectedTerm) {
        showPathwayError('Select a term first.');
        return;
    }

    const visibleGeneIds = currentGenes.map(g => g.PAO1_ID);
    const checkboxes = Array.from(document.querySelectorAll('.pathway-gene-checkbox'));
    const selectedGeneIds = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
    const selectedGeneMap = {};
    checkboxes.forEach(cb => {
        selectedGeneMap[cb.value] = cb.dataset.geneName || '';
    });

    try {
        const data = await fetchJson(window.PATHWAY_SYNC_STARRED_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.CSRF_TOKEN
            },
            body: JSON.stringify({
                dataset: selectedTerm.dataset,
                accession: selectedTerm.accession,
                name: selectedTerm.name,
                visible_gene_ids: visibleGeneIds,
                selected_gene_ids: selectedGeneIds,
                selected_gene_map: selectedGeneMap
            })
        });

        showPathwayMessage(`Import complete. Added: ${data.added}, Removed: ${data.removed}, Total starred: ${data.total_starred}.`);
    } catch (error) {
        showPathwayError(error.message);
    }
}

function resetTermUI() {
    selectedTerm = null;
    currentGenes = [];
    document.getElementById('term-search').value = '';
    setHidden(document.getElementById('term-dropdown'), true);
    renderGenes([]);
    hidePathwayError();
    hidePathwayMessage();
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('pathway-form');
    const datasetSelect = document.getElementById('dataset-select');
    const termSearch = document.getElementById('term-search');

    form.addEventListener('submit', handleImportSubmit);

    datasetSelect.addEventListener('change', function() {
        updateDatasetTitle();
        resetTermUI();
        loadDatasetRecords().catch(error => showPathwayError(error.message));
    });

    termSearch.addEventListener('input', function() {
        clearTimeout(searchDebounce);
        const query = termSearch.value.trim();

        searchDebounce = setTimeout(async () => {
            try {
                await searchTerms(query);
            } catch (error) {
                showPathwayError(error.message);
            }
        }, 220);
    });

    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('term-dropdown');
        if (!dropdown.contains(event.target) && event.target !== termSearch) {
            setHidden(dropdown, true);
        }
    });

    updateDatasetTitle();
    loadDatasetRecords().catch(error => showPathwayError(error.message));
});
