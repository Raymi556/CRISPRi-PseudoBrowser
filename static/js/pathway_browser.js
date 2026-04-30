let selectedTerm = null;
let currentGenes = [];
let currentDatasetRecords = [];
let searchDebounce = null;
let datasetTable = null;

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

function updateDatasetTitle() {
    const title = document.getElementById('dataset-records-title');
    if (!title) {
        return;
    }
    title.textContent = getSelectedDatasetLabel();
}

function buildDatasetTableRow(record) {
    const accession = record.Accession || '';
    const name = record.Name || '';
    const termLabel = accession || name ? `${accession}${accession && name ? ' - ' : ''}${name}` : '';
    return `
        <tr>
            ${Object.keys(record).map(key => {
                if (key === 'Accession' || key === 'Name') {
                    const value = record[key] || '';
                    return `<td><a href="#" class="dataset-term-link" data-accession="${accession}" data-name="${name}" style="color: var(--accent-red); text-decoration: none;">${value}</a></td>`;
                }
                return `<td>${record[key] || ''}</td>`;
            }).join('')}
        </tr>
    `;
}

function showPathwayMessage(text) {
    const box = document.getElementById('pathway-message');
    box.textContent = text;
    box.style.display = 'block';
}

function hidePathwayMessage() {
    const box = document.getElementById('pathway-message');
    box.style.display = 'none';
}

function showPathwayError(text) {
    const box = document.getElementById('pathway-error');
    box.textContent = text;
    box.style.display = 'block';
}

function hidePathwayError() {
    const box = document.getElementById('pathway-error');
    box.style.display = 'none';
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
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem;">No genes found for this term.</div>';
        updateSelectionCount();
        return;
    }

    const rows = genes.map(gene => {
        const label = gene.gene_name ? `${gene.gene_name} (${gene.PAO1_ID})` : gene.PAO1_ID;
        const checked = gene.starred ? 'checked' : '';
        return `
            <label style="display: block; margin-bottom: 0.5rem; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                <input type="checkbox" class="pathway-gene-checkbox" value="${gene.PAO1_ID}" data-gene-name="${gene.gene_name || ''}" ${checked}>
                <span style="margin-left: 0.5rem; color: var(--text-primary);">${label}</span>
                <span style="display: block; margin-left: 1.65rem; color: var(--text-secondary); font-size: 0.85rem;">${gene.product_name || 'No product name available'}</span>
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

    if (!records.length) {
        container.innerHTML = '<div style="color: var(--text-secondary);">No dataset rows available.</div>';
        if (datasetTable) {
            datasetTable.destroy();
            datasetTable = null;
        }
        return;
    }

    const headers = Object.keys(records[0]).map(key => `<th>${key}</th>`).join('');
    const body = records.map(record => buildDatasetTableRow(record)).join('');

    container.innerHTML = `
        <div class="table-container" style="padding: 0; margin: 0; border: none; background: transparent;">
            <table id="pathway-dataset-table" class="table" style="width: 100%;">
                <thead><tr>${headers}</tr></thead>
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
    currentDatasetRecords = data.records || [];
    renderDatasetTable(currentDatasetRecords);
}

function showTermDropdown(terms) {
    const dropdown = document.getElementById('term-dropdown');

    if (!terms.length) {
        dropdown.style.display = 'none';
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
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.pathway-term-item').forEach(item => {
        item.addEventListener('click', async () => {
            const accession = item.dataset.accession;
            const name = item.dataset.name;
            document.getElementById('term-search').value = `${accession} - ${name}`;
            dropdown.style.display = 'none';

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
    document.getElementById('term-dropdown').style.display = 'none';
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
            dropdown.style.display = 'none';
        }
    });

    updateDatasetTitle();
    loadDatasetRecords().catch(error => showPathwayError(error.message));
});
