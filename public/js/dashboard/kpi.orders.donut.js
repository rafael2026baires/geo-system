let ordersDonutChart = null;

const ordersCenterTextPlugin = {
  id: 'ordersCenterTextPlugin',
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
    
    ctx.font = '300 16px "Segoe UI Light"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 6);
    ctx.fillText('pedidos', x, y + 5);
    ctx.restore();
  }
};

export function renderOrdersDonut(json) {
  const o = json?.kpi_summary?.orders;
  if (!o) return;

  const canvas = document.getElementById('ordersDonutChart');
  if (!canvas) return;

  const rawData = [
    Number(o.pending_load || 0),
    Number(o.pending_delivery || 0),
    Number(o.delivered || 0)
  ];

  // ------------------- valores ---------------------------------------------- 
  const pendingLoadValue = rawData[0];
  const pendingDeliveryValue = rawData[1];
  const deliveredValue = rawData[2];

  const pendingLoadEl = document.getElementById('kpi-orders-pending-load-main');
  const pendingDeliveryEl = document.getElementById('kpi-orders-pending-delivery-main');
  const deliveredEl = document.getElementById('kpi-orders-delivered-main');

  if (pendingLoadEl) pendingLoadEl.textContent = pendingLoadValue;
  if (pendingDeliveryEl) pendingDeliveryEl.textContent = pendingDeliveryValue;
  if (deliveredEl) deliveredEl.textContent = deliveredValue;  
  // --------------------------------------------------------------------------

  const total = Number(o.in_operation || 0);
  const hasData = rawData.some(n => n > 0);

  const data = hasData ? rawData : [1];
  const labels = hasData ? ['Pend. carga', 'Pend. entrega', 'Entregados'] : ['Sin datos'];


  const neutralColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--kpi-block-bg')
  .trim();

  const colors = hasData
    ? ['#725959', '#54A1F7', '#22c55e']
    : [neutralColor];


  if (!ordersDonutChart) {
    ordersDonutChart = new Chart(canvas, {
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
      plugins: [ordersCenterTextPlugin]
    });

    return;
  }

  ordersDonutChart.data.labels = labels;
  ordersDonutChart.data.datasets[0].data = data;
  ordersDonutChart.data.datasets[0].backgroundColor = colors;
  ordersDonutChart.options.plugins.centerText.text = String(total);
  ordersDonutChart.update();
}