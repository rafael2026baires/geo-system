let locationDonutChart = null;

const locationCenterTextPlugin = {
  id: 'locationCenterTextPlugin',
  afterDraw(chart) {
    const text = chart.options.plugins.centerText?.text ?? '';
    if (!text) return;

    const meta = chart.getDatasetMeta(0);
    const arc = meta?.data?.[0];
    if (!arc) return;

    const { ctx } = chart;
    const x = arc.x;
    const y = arc.y;

    ctx.save();

    ctx.font = '300 12px "Segoe UI Light"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 6);
    ctx.fillText('vehículos', x, y + 5);
    ctx.restore();
  }
};

export function renderLocationDonut(json) {
  const v = json?.kpi_summary?.vehicles;
  if (!v) return;

  const canvas = document.getElementById('locationDonutChart');
  if (!canvas) return;
  
  const rawData = [
    Number(v.in_base || 0),
    Number(v.in_street || 0),
    Number(v.in_client || 0)
  ]; 

  // ------------------- valores ----------------------------------------------
  const baseValue = rawData[0];
  const streetValue = rawData[1];
  const clientValue = rawData[2];

  const baseEl = document.getElementById('kpi-veh-base-main');
  const streetEl = document.getElementById('kpi-veh-calle-main');
  const clientEl = document.getElementById('kpi-veh-cliente-main');

  if (baseEl) baseEl.textContent = baseValue;
  if (streetEl) streetEl.textContent = streetValue;
  if (clientEl) clientEl.textContent = clientValue;
  // --------------------------------------------------------------------------

  const total = Number(v.active || 0);
  const hasData = rawData.some(n => n > 0);

  const data = hasData ? rawData : [1];
  const labels = hasData ? ['Base', 'Calle', 'Cliente'] : ['Sin datos'];

  const neutralColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--kpi-block-bg')
  .trim();

  const colors = hasData
    ? ['#d9d9d9', '#6f6f6f', '#3f3f3f']
    : [neutralColor];    


  if (!locationDonutChart) {
    locationDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#969595',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1600,
          easing: 'easeOutQuart'
        },
        cutout: '62%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true
          },
          centerText: {
            text: String(total)
          }
        }
      },
      plugins: [locationCenterTextPlugin]
    });

    return;
  }

  locationDonutChart.data.labels = labels;
  locationDonutChart.data.datasets[0].data = data;
  locationDonutChart.data.datasets[0].backgroundColor = colors;
  locationDonutChart.options.plugins.centerText.text = String(total);
  locationDonutChart.update();
}