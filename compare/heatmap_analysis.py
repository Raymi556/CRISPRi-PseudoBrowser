"""Utilities to prepare clustered compare heatmap data."""

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, leaves_list, to_tree
from scipy.spatial.distance import pdist

from gene.data_loader import get_available_conditions, load_melted_results


def _resolve_lfc_column(df):
    """Pick the first known LFC column present in the melted dataset."""
    candidates = ["medLFC", "LFC.adj", "LFC", "lfc"]
    for column in candidates:
        if column in df.columns:
            return column
    raise ValueError("No supported LFC column found in melted results data.")


def _display_condition_label(condition):
    """Format condition names for axis labels only."""
    left_part = str(condition).split("-", 1)[0].strip()
    return left_part.replace("_", " ")


def _build_dendrogram_segments(linkage_matrix, ordered_leaf_ids):
    """Build line segments for a left-side dendrogram aligned to row indices."""
    if linkage_matrix is None or len(ordered_leaf_ids) <= 1:
        return {"segments": [], "max_distance": 1.0}

    root = to_tree(linkage_matrix)
    leaf_to_row = {leaf_id: row_idx for row_idx, leaf_id in enumerate(ordered_leaf_ids)}
    segments = []

    def walk(node):
        if node.is_leaf():
            return 0.0, float(leaf_to_row[node.id])

        left_x, left_y = walk(node.left)
        right_x, right_y = walk(node.right)
        node_x = float(node.dist)
        node_y = (left_y + right_y) / 2.0

        segments.append({"x0": left_x, "y0": left_y, "x1": node_x, "y1": left_y})
        segments.append({"x0": right_x, "y0": right_y, "x1": node_x, "y1": right_y})
        segments.append({"x0": node_x, "y0": left_y, "x1": node_x, "y1": right_y})

        return node_x, node_y

    max_distance, _ = walk(root)
    max_distance = max(1e-9, float(max_distance))

    return {
        "segments": segments,
        "max_distance": max_distance,
    }


def prepare_compare_heatmap_data(starred_genes):
    """Create clustered heatmap payload for starred genes across all conditions."""
    if not starred_genes:
        raise ValueError("No starred genes found. Add genes in Pathway first.")

    melted = load_melted_results()
    lfc_column = _resolve_lfc_column(melted)

    condition_list = get_available_conditions()
    if not condition_list:
        raise ValueError("No conditions available in melted results.")

    starred_df = pd.DataFrame(starred_genes)
    if "PAO1_ID" not in starred_df.columns:
        raise ValueError("Starred genes are missing PAO1_ID values.")

    starred_df["PAO1_ID"] = starred_df["PAO1_ID"].astype(str)
    starred_df = starred_df.drop_duplicates(subset=["PAO1_ID"])

    filtered = melted[
        melted["PAO1_ID"].astype(str).isin(starred_df["PAO1_ID"]) &
        melted["condition"].isin(condition_list)
    ][["PAO1_ID", "condition", lfc_column]].copy()

    if filtered.empty:
        raise ValueError("No LFC values found for the current starred genes.")

    filtered["PAO1_ID"] = filtered["PAO1_ID"].astype(str)

    median_df = (
        filtered
        .groupby(["PAO1_ID", "condition"], dropna=False)[lfc_column]
        .median()
        .reset_index()
        .rename(columns={lfc_column: "median_lfc"})
    )

    matrix_df = median_df.pivot(index="PAO1_ID", columns="condition", values="median_lfc")
    matrix_df = matrix_df.reindex(index=starred_df["PAO1_ID"].tolist(), columns=condition_list)
    matrix_df = matrix_df.fillna(0.0)

    raw_matrix = matrix_df.to_numpy(dtype=float)

    if raw_matrix.shape[0] > 1:
        cluster_matrix = raw_matrix - raw_matrix.mean(axis=1, keepdims=True)
        row_stds = cluster_matrix.std(axis=1, keepdims=True)
        cluster_matrix = np.divide(
            cluster_matrix,
            row_stds,
            out=np.zeros_like(cluster_matrix),
            where=row_stds > 0,
        )
        distance_vector = pdist(cluster_matrix, metric="correlation")
        distance_vector = np.where(np.isfinite(distance_vector), distance_vector, 1.0)
        linkage_matrix = linkage(distance_vector, method="average")
        leaf_order = leaves_list(linkage_matrix).tolist()
    else:
        linkage_matrix = None
        leaf_order = [0]

    ordered_ids = matrix_df.index.to_numpy()[leaf_order].tolist()
    ordered_raw = raw_matrix[leaf_order, :]
    id_to_name = {
        str(row["PAO1_ID"]): str(row.get("gene_name") or "").strip()
        for row in starred_genes
    }
    gene_labels = [
        f"{id_to_name.get(pao1_id)} ({pao1_id})" if id_to_name.get(pao1_id) else pao1_id
        for pao1_id in ordered_ids
    ]

    dendrogram = _build_dendrogram_segments(linkage_matrix, leaf_order)

    return {
        "genes": gene_labels,
        "pao1_ids": ordered_ids,
        "conditions": condition_list,
        "condition_labels": [_display_condition_label(cond) for cond in condition_list],
        "z_lfc": ordered_raw.tolist(),
        "lfc_color_max": float(max(1e-9, np.max(np.abs(ordered_raw)))),
        "dendrogram": dendrogram,
    }
