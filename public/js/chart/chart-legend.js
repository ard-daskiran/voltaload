// Grafiğin üstündeki açıklama satırı: çizgi adına tıklayınca çizgi gizlenir ya da gösterilir.
// Butonlar HTML'de data-series="0..4" ile işaretli.

export function updateLegendButtons(chart) {
    document.querySelectorAll("[data-series]").forEach((btn) => {
        const visible = chart ? chart.isDatasetVisible(Number(btn.dataset.series)) : true;
        btn.classList.toggle("opacity-40", !visible);
        btn.setAttribute("aria-pressed", String(visible));
    });
}

// getChart: o anki grafiği döndüren fonksiyon (grafik her testte yeniden kurulduğu için)
export function bindLegend(getChart) {
    document.querySelectorAll("[data-series]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const chart = getChart();
            if (!chart) return;

            const index = Number(btn.dataset.series);
            chart.setDatasetVisibility(index, !chart.isDatasetVisible(index));
            chart.update("none");
            updateLegendButtons(chart);
        });
    });
}