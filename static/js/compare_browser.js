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

function showCompareLoading() {
    const loading = document.getElementById('compare-loading');
    const plot = document.getElementById('heatmap-plot');
    if (loading) {
        loading.style.display = 'flex';
    }
    if (plot) {
        plot.style.display = 'none';
    }
}

function hideCompareLoading() {
    const loading = document.getElementById('compare-loading');
    const plot = document.getElementById('heatmap-plot');
    if (loading) {
        loading.style.display = 'none';
    }
    if (plot) {
        plot.style.display = 'block';
    }
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

function buildDendrogramTraces(dendrogram) {
    const segments = dendrogram?.segments || [];
    return segments.map(segment => ({
        type: 'scatter',
        mode: 'lines',
        x: [segment.x0, segment.x1],
        y: [segment.y0, segment.y1],
        line: {
            color: '#a0a0a0',
            width: 1.2
        },
        hoverinfo: 'skip',
        showlegend: false,
        xaxis: 'x2',
        yaxis: 'y2'
    }));
}

async function downloadComparePlot() {
    const plotDiv = document.getElementById('heatmap-plot');
    if (!plotDiv || !plotDiv.data || !plotDiv.layout) {
        throw new Error('Plot is not available for download');
    }

    await Plotly.downloadImage(plotDiv, {
        format: 'png',
        width: 1400,
        height: 900,
        filename: 'compare_heatmap'
    });
}

function renderHeatmap(data) {
    const rowCount = data.genes.length;
    const yPositions = Array.from({length: rowCount}, (_, i) => i);
    const geneTextMatrix = data.genes.map(gene =>
        data.condition_labels.map(() => gene)
    );
    const maxAbsLfc = Math.max(1e-9, Number(data.lfc_color_max || 1.0));

    const heatmapTrace = {
        type: 'heatmap',
        z: data.z_lfc,
        x: data.condition_labels,
        y: yPositions,
        colorscale: [
            [0.00, '#143a8b'],
            [0.25, '#6f8ed7'],
            [0.50, '#ffffff'],
            [0.75, '#df7a7a'],
            [1.00, '#8f1010']
        ],
        zmin: -maxAbsLfc,
        zmax: maxAbsLfc,
        zmid: 0,
        hoverongaps: false,
        hovertemplate:
            'Gene: %{text}<br>' +
            'Condition: %{x}<br>' +
            'Median LFC: %{z:.3f}<extra></extra>',
        text: geneTextMatrix,
        xaxis: 'x',
        yaxis: 'y',
        colorbar: {
            title: 'Median LFC',
            orientation: 'h',
            thickness: 14,
            len: 0.82,
            x: 0.5,
            xanchor: 'center',
            y: -0.22,
            yanchor: 'top'
        }
    };

    const dendrogramTraces = buildDendrogramTraces(data.dendrogram);

    const dendrogramMax = Math.max(1e-6, Number(data.dendrogram?.max_distance || 1.0));

    const layout = {
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: {color: '#e0e0e0'},
        margin: {l: 20, r: 10, t: 50, b: 210},
        title: {
            text: 'Clustered Heatmap (Starred Genes x All Conditions)',
            font: {color: '#e0e0e0'}
        },
        xaxis: {
            domain: [0.355, 1.0],
            tickangle: -40,
            automargin: true,
            showgrid: false
        },
        yaxis: {
            domain: [0, 1],
            automargin: true,
            tickmode: 'array',
            tickvals: yPositions,
            ticktext: data.genes,
            showgrid: false,
            zeroline: false,
            autorange: 'reversed',
            side: 'right',
            ticklabelposition: 'outside'
        },
        xaxis2: {
            domain: [0.0, 0.35],
            range: [dendrogramMax, 0],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            fixedrange: true
        },
        yaxis2: {
            domain: [0, 1],
            range: [-0.5, rowCount - 0.5],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            fixedrange: true,
            autorange: 'reversed'
        },
        height: Math.max(640, 32 * rowCount + 250)
    };

    Plotly.newPlot('heatmap-plot', [...dendrogramTraces, heatmapTrace], layout, {responsive: true});
}

async function generateHeatmap() {
    hideCompareError();
    hideCompareMessage();
    showCompareLoading();

    try {
        const response = await fetch(window.COMPARE_HEATMAP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.CSRF_TOKEN
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate clustered heatmap.');
        }

        renderHeatmap(data);
    } finally {
        hideCompareLoading();
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const downloadPlotBtn = document.getElementById('download-plot');
    if (downloadPlotBtn) {
        downloadPlotBtn.addEventListener('click', async function() {
            try {
                await downloadComparePlot();
            } catch (error) {
                showCompareError(error.message || 'Failed to download plot');
            }
        });
    }

    document.getElementById('refresh-heatmap').addEventListener('click', async function() {
        try {
            await generateHeatmap();
        } catch (error) {
            hideCompareLoading();
            showCompareError(error.message);
        }
    });

    try {
        await fetchStarredGenes();
    } catch (error) {
        hideCompareLoading();
        showCompareError(error.message);
    }
});
