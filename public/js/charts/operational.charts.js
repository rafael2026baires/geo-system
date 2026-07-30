let streetRhythmChart = null;
let streetAccumChart = null;

let baseRhythmChart = null;
let baseAccumChart = null;

const emptyChartData = {
  labels: [],
  delivered_rhythm: [],
  delivered_accumulated: []
};

const lineShadowPlugin = {
  id: 'lineShadowPlugin',

  beforeDatasetDraw(chart) {
    const { ctx } = chart;

    ctx.save();
  ctx.shadowColor = '#00000085';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  },

  afterDatasetDraw(chart) {
    chart.ctx.restore();
  }
};

function getThemeColor(cssVarName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVarName)
    .trim();
}

function hideFlatZeroSeries(series) {
  if (!Array.isArray(series)) return [];

  const hasRealValue = series.some(value => Number(value) > 0);

  if (!hasRealValue) {
    return series.map(() => null);
  }

  return series;
}

function getXAxisTickLabel(value) {
  const label = this.getLabelForValue(value);
  if (!label) return '';

  const [hh, mm] = label.split(':');

  if (mm === '00') {
    return hh;
  }

  return '|';
}

function getCommonOptions(bottomPadding = 14) {
  return {
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 700,
      easing: 'easeOutCubic'
    },  

    layout: {
      padding: {
        top: 4,
        right: 8,
        bottom: bottomPadding,
        left: 4
      }
    },

    plugins: {
      legend: {
        display: false
      }
    },

    scales: {
      x: {
        offset: true,
        border: {
          display: true,
          color: '#c9c9c9'
        },         
        grid: {
          display: false,
          //color: '#c9c9c9',
          //lineWidth: 0.5,
          //drawBorder: false          
        },
        ticks: {
          display: true,
          autoSkip: false,
          padding: 8,
          //color: getThemeColor('--chart-axis-text-color'),
          color: "#c9c9c9",
          font: {
            size: 10
          },
          maxRotation: 0,
          minRotation: 0,     

          callback: function(value, index, ticks) {
            const label = this.getLabelForValue(value);
            if (!label) return '';

            const total = ticks.length;
            const maxLabels = 4; // cambiar tranquilo: 2, 3, 4, 5...

            if (total <= maxLabels) {
              return label;
            }
            if (maxLabels <= 2) {
              return (index === 0 || index === total - 1) ? label : '';
            }
            const positions = new Set();

            for (let i = 0; i < maxLabels; i++) {
              const pos = Math.round(i * (total - 1) / (maxLabels - 1));
              positions.add(pos);
            }
            return positions.has(index) ? label : '';
          }

        }
      },

      y: {
        beginAtZero: true,
        border: {
          display: true,
          color: '#c9c9c9'
        },        
        ticks: {
          precision: 0,
          //color: getThemeColor('--chart-axis-text-color'),
          color: '#c9c9c9',
          font: {
            size: 10
          }
        },
        grid: {          
          //color: getThemeColor('--chart-grid-line-color'),          
          color: '#5e5e5e',
          lineWidth: 0.5,
          drawBorder: false
        }
      }
    }
  };
}

export function initStreetRhythmChart() {
  const canvas = document.getElementById('streetRhythmChart');
  if (!canvas || !window.Chart) return;

  if (streetRhythmChart) return;

  streetRhythmChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: emptyChartData.labels,
      datasets: [
        {
          data: emptyChartData.delivered_rhythm,
          tension: 0.25,
          fill: false,

          //borderColor: getThemeColor('--chart-line-color'),
          borderColor: '#20cf35',
          //pointBackgroundColor: getThemeColor('--chart-line-color'),
          pointBackgroundColor: '#150ba5',
          //pointBorderColor: getThemeColor('--chart-line-color'),
          pointBorderColor: '#fc0022',

          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 8
        }
      ]
    },
    options: getCommonOptions(15),
    plugins: [lineShadowPlugin]
  });
}

export function initStreetAccumChart() {
  const canvas = document.getElementById('streetAccumChart');
  if (!canvas || !window.Chart) return;

  if (streetAccumChart) return;

  streetAccumChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: emptyChartData.labels,
      datasets: [
        {
          data: emptyChartData.delivered_accumulated,
          tension: 0.25,
          fill: false,

          //borderColor: getThemeColor('--chart-line-color'),
          borderColor: '#20cf35',
          pointBackgroundColor: getThemeColor('--chart-line-color'),
          pointBorderColor: getThemeColor('--chart-line-color'),

          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 8
        }
      ]
    },
    options: getCommonOptions(15),
    plugins: [lineShadowPlugin]
  });
}

export function initBaseRhythmChart() {
  const canvas = document.getElementById('baseRhythmChart');
  if (!canvas || !window.Chart) return;

  if (baseRhythmChart) return;

  baseRhythmChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: emptyChartData.labels,
      datasets: [
        {
          data: [],
          tension: 0.25,
          fill: false,
          //borderColor: getThemeColor('--chart-line-color'),
          borderColor: '#54A1F7',
          pointBackgroundColor: getThemeColor('--chart-line-color'),
          pointBorderColor: getThemeColor('--chart-line-color'),
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 8
        }
      ]
    },
    options: getCommonOptions(15),
    plugins: [lineShadowPlugin]
  });
}

export function initBaseAccumChart() {
  const canvas = document.getElementById('baseAccumChart');
  if (!canvas || !window.Chart) return;

  if (baseAccumChart) return;

  baseAccumChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: emptyChartData.labels,
      datasets: [
        {
          data: [],
          tension: 0.25,
          fill: false,
          //borderColor: getThemeColor('--chart-line-color'),
          borderColor: '#54A1F7',
          pointBackgroundColor: getThemeColor('--chart-line-color'),
          pointBorderColor: getThemeColor('--chart-line-color'),
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 8
        }
      ]
    },
    options: getCommonOptions(15),
    plugins: [lineShadowPlugin]
  });
}

export function updateBaseCharts(data) {
  if (!data || !data.labels || !data.series) return;

  initBaseRhythmChart();
  initBaseAccumChart();

  if (baseRhythmChart) {
    baseRhythmChart.data.labels = data.labels;    
    baseRhythmChart.data.datasets[0].data = hideFlatZeroSeries(data.series.loaded_rhythm || []);
    baseRhythmChart.update();
  }

  if (baseAccumChart) {
    baseAccumChart.data.labels = data.labels;
    baseAccumChart.data.datasets[0].data = hideFlatZeroSeries(data.series.loaded_accumulated || []);

    const loadTotal = data.targets?.load_total;

    if (Number.isFinite(loadTotal) && loadTotal > 0) {
      baseAccumChart.options.scales.y.max = loadTotal;
    } else {
      delete baseAccumChart.options.scales.y.max;
    }

    baseAccumChart.update('none');
  }
}

export function updateDeliveryCharts(data) {
  if (!data || !data.labels || !data.series) return;

  initStreetRhythmChart();
  initStreetAccumChart();

  if (streetRhythmChart) {
    streetRhythmChart.data.labels = data.labels;
    streetRhythmChart.data.datasets[0].data = hideFlatZeroSeries(data.series.delivered_rhythm || []);
    streetRhythmChart.update();
  }

  if (streetAccumChart) {
    streetAccumChart.data.labels = data.labels;
    streetAccumChart.data.datasets[0].data = hideFlatZeroSeries(data.series.delivered_accumulated || []);

    const deliveryTotal = data.targets?.delivery_total;

    if (Number.isFinite(deliveryTotal) && deliveryTotal > 0) {
      streetAccumChart.options.scales.y.max = deliveryTotal;
    } else {
      delete streetAccumChart.options.scales.y.max;
    }
    
    streetAccumChart.update('none');
  }
}