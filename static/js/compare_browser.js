let starredGenes = [];

function showHeatmapCard() {
    const card = document.getElementById('heatmap-card');
    if (card) {
        card.hidden = false;
    }
}

function hideHeatmapCard() {
    const card = document.getElementById('heatmap-card');
    const downloadButton = document.getElementById('download-plot');
    if (downloadButton) {
        downloadButton.hidden = true;
    }
    if (card) {
        card.hidden = true;
    }
}

function setHidden(element, hidden) {
    if (element) {
        element.hidden = hidden;
    }
}

function showCompareMessage(text) {
    const box = document.getElementById('compare-message');
    box.textContent = text;
    setHidden(box, false);
}

function hideCompareMessage() {
    const box = document.getElementById('compare-message');
    setHidden(box, true);
}

function showCompareError(text) {
    const box = document.getElementById('compare-error');
    box.textContent = text;
    setHidden(box, false);
}

function hideCompareError() {
    const box = document.getElementById('compare-error');
    setHidden(box, true);
}

function showCompareLoading() {
    const loading = document.getElementById('compare-loading');
    if (loading) {
        setHidden(loading, false);
    }
    hideHeatmapCard();
}

function hideCompareLoading() {
    const loading = document.getElementById('compare-loading');
    if (loading) {
        setHidden(loading, true);
    }
}

function renderStarredGenes() {
    const container = document.getElementById('starred-genes-container');

    if (!starredGenes.length) {
        container.innerHTML = '<div class="empty-state">No starred genes yet. Add genes from Pathway tab.</div>';
        return;
    }

    container.innerHTML = starredGenes.map(gene => {
        const label = gene.gene_name ? `${gene.gene_name} (${gene.PAO1_ID})` : gene.PAO1_ID;
        const source = `${gene.source_dataset || ''} ${gene.source_accession || ''}`.trim();
        return `
            <div class="list-box__item compare-gene-card">
                <div class="compare-gene-row">
                    <div>
                        <div class="text-primary font-semibold">${label}</div>
                        <div class="text-muted text-sm">${source}</div>
                    </div>
                    <button class="btn btn-secondary remove-starred-btn btn--tight" data-pao1-id="${gene.PAO1_ID}">Remove</button>
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
        x: [segment.y0, segment.y1],
        y: [segment.x0, segment.x1],
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

    const paperData = JSON.parse(JSON.stringify(plotDiv.data));
    const paperLayout = buildPaperReadyCompareLayout(plotDiv.layout, paperData);
    const exportWidth = 2200;
    const exportHeight = Math.max(1400, 32 * (paperLayout.yaxis?.tickvals?.length || 0) + 500);
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
            width: exportWidth,
            height: exportHeight,
            filename: 'compare_heatmap',
            scale: 2
        });
    } finally {
        Plotly.purge(tempDiv);
        tempDiv.remove();
    }
}

function buildPaperReadyCompareLayout(sourceLayout, data) {
    const layout = JSON.parse(JSON.stringify(sourceLayout || {}));

    layout.paper_bgcolor = '#ffffff';
    layout.plot_bgcolor = '#ffffff';
    layout.font = {
        ...(layout.font || {}),
        color: '#111111',
        size: 22,
        family: 'Arial, sans-serif'
    };
    layout.margin = {l: 130, r: 30, t: 170, b: 150};

    ['xaxis', 'yaxis', 'xaxis2', 'yaxis2'].forEach(axisName => {
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
        if (layout[axisName].title) {
            layout[axisName].title = {
                ...layout[axisName].title,
                font: {
                    ...(layout[axisName].title.font || {}),
                    size: 22,
                    color: '#111111'
                }
            };
        }
    });

    if (layout.title) {
        layout.title = {
            ...layout.title,
            font: {
                ...(layout.title.font || {}),
                size: 24,
                color: '#111111'
            }
        };
    }

    data.forEach(trace => {
        if (trace.colorbar?.title) {
            trace.colorbar.title = {
                ...trace.colorbar.title,
                font: {
                    ...(trace.colorbar.title.font || {}),
                    size: 20,
                    color: '#111111'
                }
            };
        }
    });

    return layout;
}

async function renderHeatmap(data) {
    const geneCount = data.genes.length;
    const conditionCount = data.condition_labels.length;
    const genePositions = Array.from({length: geneCount}, (_, i) => i);
    const conditionPositions = Array.from({length: conditionCount}, (_, i) => i);
    const transposedValues = data.condition_labels.map((_, conditionIndex) =>
        data.genes.map((_, geneIndex) => data.z_lfc[geneIndex][conditionIndex])
    );
    const geneTextMatrix = data.condition_labels.map(() =>
        data.genes.map(gene => gene)
    );
    const maxAbsLfc = Math.max(1e-9, Number(data.lfc_color_max || 1.0));

    const heatmapTrace = {
        type: 'heatmap',
        z: transposedValues,
        x: genePositions,
        y: conditionPositions,
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
            'Gene: %{text}<br>' +
            'Condition: %{y}<br>' +
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
        margin: {l: 90, r: 10, t: 130, b: 80},
        title: {
            text: 'Clustered Heatmap (Starred Genes x All Conditions)',
            font: {color: '#e0e0e0'}
        },
        xaxis: {
            domain: [0.0, 1.0],
            tickmode: 'array',
            tickvals: genePositions,
            ticktext: data.genes,
            tickangle: -55,
            automargin: true,
            showgrid: false
        },
        yaxis: {
            domain: [0, 0.82],
            automargin: true,
            tickmode: 'array',
            tickvals: conditionPositions,
            ticktext: data.condition_labels,
            showgrid: false,
            zeroline: false,
            autorange: 'reversed',
            side: 'left',
            ticklabelposition: 'outside'
        },
        xaxis2: {
            domain: [0.0, 1.0],
            range: [-0.5, geneCount - 0.5],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            fixedrange: true
        },
        yaxis2: {
            domain: [0.84, 1.0],
            range: [0, dendrogramMax],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            fixedrange: true,
        },
        height: Math.max(640, 32 * conditionCount + 250)
    };

    showHeatmapCard();
    await Plotly.newPlot('heatmap-plot', [...dendrogramTraces, heatmapTrace], layout, {responsive: true});

    const downloadPlotBtn = document.getElementById('download-plot');
    if (downloadPlotBtn) {
        downloadPlotBtn.hidden = false;
    }
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

        await renderHeatmap(data);
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

    hideHeatmapCard();

    try {
        await fetchStarredGenes();
    } catch (error) {
        hideCompareLoading();
        showCompareError(error.message);
    }
});
