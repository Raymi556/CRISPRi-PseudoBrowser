function filterTableFromPlot({tableSelector, columnIndex, value, label, messageId}) {
    const table = $(tableSelector).DataTable();
    const filterValue = String(value ?? '');
    table.column(columnIndex).search(filterValue, false, true).draw();

    const message = document.getElementById(messageId);
    message.innerHTML = `
        <span>Table filtered by ${label}: <strong>${escapeTableFilterText(filterValue)}</strong></span>
        <button type="button" class="table-filter-clear" aria-label="Remove table filter">&times;</button>
    `;
    message.hidden = false;
    message.querySelector('.table-filter-clear').addEventListener('click', () => {
        table.column(columnIndex).search('').draw();
        message.hidden = true;
    });
    message.scrollIntoView({behavior: 'smooth', block: 'start'});
}

function escapeTableFilterText(value) {
    return value.replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[character]));
}
