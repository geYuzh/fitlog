path = r'C:\Users\18537\Documents\记录软件\fitness-tracker\app.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Fix attachWheelListeners - remove c3
old_attach = '''function attachWheelListeners() {
  var c1 = document.getElementById('chartWeight');
  var c2 = document.getElementById('chartVolume');
  var c3 = document.getElementById('chartFreq');
  if (c1) c1.onwheel = function(e) { onChartWheel(e, 1); };
  if (c2) c2.onwheel = function(e) { onChartWheel(e, 2); };
  if (c3) c3.onwheel = function(e) { onChartWheel(e, 3); };
}'''

new_attach = '''function attachWheelListeners() {
  var c1 = document.getElementById('chartWeight');
  var c2 = document.getElementById('chartVolume');
  if (c1) c1.onwheel = function(e) { onChartWheel(e, 1); };
  if (c2) c2.onwheel = function(e) { onChartWheel(e, 2); };
}'''

c = c.replace(old_attach, new_attach)

# 2. Restore onChartWheel function (insert before attachWheelListeners)
old_marker = "// Attach wheel listeners to chart canvases"
wheel_func = '''function onChartWheel(e, chartNum) {
  e.preventDefault();
  var delta = e.deltaY > 0 ? 3 : -3;
  if (chartNum === 1) {
    zoom1 = Math.max(1, Math.min(30, zoom1 + delta));
    updateChart1();
  } else if (chartNum === 2) {
    zoom2 = Math.max(1, Math.min(30, zoom2 + delta));
    updateChart2();
  }
}

// Attach wheel listeners to chart canvases'''

c = c.replace(old_marker, wheel_func)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed wheel handler and c3 references')
