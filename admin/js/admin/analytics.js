(function () {
    function safeChart(id, type, data, options) {
        var ctx = document.getElementById(id);
        if (!ctx || !window.Chart) {
            return;
        }
        new Chart(ctx, { type: type, data: data, options: options || {} });
    }

    safeChart('userActivityChart', 'line', {
        labels: [],
        datasets: []
    }, { responsive: true, maintainAspectRatio: false });

    safeChart('contentDistributionChart', 'doughnut', {
        labels: [],
        datasets: []
    }, { responsive: true, maintainAspectRatio: false });

    safeChart('genreDistributionChart', 'bar', {
        labels: [],
        datasets: []
    }, { responsive: true, maintainAspectRatio: false });
})();
