// The legend row above the chart: clicking a line's name hides or shows that line.
// The buttons are marked in HTML with data-series="0..4".

export function updateLegendButtons(chart) {
    document.querySelectorAll("[data-series]").forEach((btn) => {
        const visible = chart ? chart.isDatasetVisible(Number(btn.dataset.series)) : true;
        btn.classList.toggle("opacity-40", !visible);
        btn.setAttribute("aria-pressed", String(visible));
    });
}

// getChart: a function that returns the current chart (since the chart is rebuilt for every test)
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