let starredGenes = [];

function showCompareMessage(text) {
    const box = document.getElementById('compare-message');
    box.textContent = text;
    box.style.display = 'block';
}

function hideCompareMessage() {
    const box = document.getElementById('compare-message');
    box.style.display = 'none';
}

function showCompareError(text) {
    const box = document.getElementById('compare-error');
    box.textContent = text;
    box.style.display = 'block';
}

function hideCompareError() {
    const box = document.getElementById('compare-error');
    box.style.display = 'none';
}

function selectedConditions() {
    const select = document.getElementById('condition-select');
    return Array.from(select.selectedOptions).map(opt => opt.value);
}

function renderStarredGenes() {
    const container = document.getElementById('starred-genes-container');

    if (!starredGenes.length) {
        container.innerHTML = '<div style="color: var(--text-secondary);">No starred genes yet. Add genes from Pathway tab.</div>';
        return;
    }

    container.innerHTML = starredGenes.map(gene => {
        const label = gene.gene_name ? `${gene.gene_name} (${gene.PAO1_ID})` : gene.PAO1_ID;
        const source = `${gene.source_dataset || ''} ${gene.source_accession || ''}`.trim();
        return `
            <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 0.7rem; margin-bottom: 0.6rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.7rem;">
                    <div>
                        <div style="color: var(--text-primary); font-weight: 600;">${label}</div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">${source}</div>
                    </div>
                    <button class="btn btn-secondary remove-starred-btn" data-pao1-id="${gene.PAO1_ID}" style="padding: 0.35rem 0.7rem;">Remove</button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.remove-starred-btn').forEach(button => {
        button.addEventListener('click', async () => {
            await removeStarredGene(button.dataset.pao1Id);
        });
    });
}

async function fetchStarredGenes() {
    const response = await fetch(window.COMPARE_STARRED_URL);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to load starred genes.');
    }
    starredGenes = data.genes || [];
    renderStarredGenes();
}

async function removeStarredGene(pao1Id) {
    hideCompareError();
    hideCompareMessage();

    const response = await fetch(window.COMPARE_REMOVE_STARRED_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.CSRF_TOKEN
        },
        body: JSON.stringify({PAO1_ID: pao1Id})
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to remove gene.');
    }

    showCompareMessage(`Removed ${pao1Id} from starred genes.`);
    await fetchStarredGenes();
}

function renderDummyHeatmap(data) {
    const trace = {
        type: 'heatmap',
        z: data.z,
        x: data.conditions,
        y: data.genes,
        colorscale: 'RdBu',
        zmid: 0,
        hoverongaps: false,
        colorbar: {
            title: 'Dummy LFC'
        }
    };

    const layout = {
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: {color: '#e0e0e0'},
        margin: {l: 140, r: 20, t: 40, b: 100},
        title: {
            text: 'Placeholder Heatmap (Starred Genes x Conditions)',
            font: {color: '#e0e0e0'}
        },
        xaxis: {
            tickangle: -40,
            automargin: true
        },
        yaxis: {
            automargin: true
        }
    };

    Plotly.newPlot('heatmap-plot', [trace], layout, {responsive: true});

    const placeholder = document.getElementById('hierarchy-placeholder');
    placeholder.textContent = data.tree_placeholder?.message || 'Hierarchy tree placeholder ready.';
}

async function generateHeatmap() {
    hideCompareError();
    hideCompareMessage();

    const conditions = selectedConditions();
    if (!conditions.length) {
        showCompareError('Select at least one condition.');
        return;
    }

    const response = await fetch(window.COMPARE_DUMMY_HEATMAP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.CSRF_TOKEN
        },
        body: JSON.stringify({conditions: conditions})
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to generate placeholder heatmap.');
    }

    renderDummyHeatmap(data);
}

document.addEventListener('DOMContentLoaded', async function() {
    document.getElementById('refresh-heatmap').addEventListener('click', async function() {
        try {
            await generateHeatmap();
        } catch (error) {
            showCompareError(error.message);
        }
    });

    try {
        await fetchStarredGenes();
    } catch (error) {
        showCompareError(error.message);
    }
});
