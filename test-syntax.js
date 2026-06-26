var x =     return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: !!showLegend, position: 'top', labels: { color: '#999', font: { size: 10 }, boxWidth: 12, padding: 8 } },
        }
      },
      scales: {
        x: {
          ticks: {
            color: function(ctx) {
              if (!ctx.tick || !ctx.tick.label) return '#999';
              return ctx.tick.label.indexOf('\u6708') >= 0 ? '#ff6b35' : '#999';
            },
            font: function(ctx) {
              var w = ctx.tick && ctx.tick.label && ctx.tick.label.indexOf('\u6708') >= 0 ? 'bold' : 'normal';
              return { size: 10, weight: w };
            },
            maxRotation: 0,
            autoSkip: false,
            callback: function(val, index, ticks) {
              var label = this.getLabelForValue(val);
              if (!label) return '';
              var parts = label.split('-');
              var year = parts[0];
              var month = parseInt(parts[1]);
              var day = parseInt(parts[2]);
              var prevYear = '', prevMonth = '';
              if (index > 0 && ticks[index-1]) {
                var prevLabel = this.getLabelForValue(ticks[index-1].value);
                if (prevLabel) {
                  var prevParts = prevLabel.split('-');
                  prevYear = prevParts[0];
                  prevMonth = prevParts[1];
                }
              }
              if (index === 0 || prevYear !== year) {
                return year + '\u5e74' + month + '\u6708' + day + '\u65e5';
              }
              if (prevMonth !== parts[1]) {
                return month + '\u6708' + day + '\u65e5';
              }
              return day + '\u65e5';
            }
          },
          grid: { color: '#2a2a2a' }
        },
        y: { ticks: { color: '#999', font: { size: 10 } }, grid: { color: '#2a2a2a' }, beginAtZero: false, title: { display: true, text: 'kg', color: '#999' } }
      }
    };
  }; console.log('OK');
