function setDownloadButtonLoading(button, loading) {
    button.disabled = loading;
    button.querySelector('.download-button__label').hidden = loading;
    button.querySelector('.download-button__spinner').hidden = !loading;
}

async function downloadExcel(button) {
    setDownloadButtonLoading(button, true);
    try {
        const response = await fetch(button.dataset.downloadUrl);
        if (!response.ok) {
            throw new Error('Unable to generate this download.');
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = response.headers
            .get('Content-Disposition')
            ?.match(/filename="([^"]+)"/)?.[1] || 'browser_data.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        window.alert(error.message);
    } finally {
        setDownloadButtonLoading(button, false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.download-button').forEach((button) => {
        button.addEventListener('click', () => downloadExcel(button));
    });
});
