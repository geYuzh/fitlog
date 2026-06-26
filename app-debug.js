// ========== DATA STORE ==========
var STORAGE_KEY = 'fitlog_workouts';
var workouts = [];
function loadData() { try { workouts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { workouts = []; } }
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ========== EXERCISE PRESETS ==========
var exercisePresets = [
  '\u5367\u63a8', '\u6df1\u8e72', '\u786c\u62c9', '\u5f15\u4f53\u5411\u4e0a', '\u5212\u8239', '\u80a9\u63a8',
  '\u4e8c\u5934\u5f2f\u4e3e', '\u4e09\u5934\u4e0b\u538b', '\u4fa7\u5e73\u4e3e', '\u6760\u94c3\u5f2f\u4e3e', '\u817f\u4e3e',
  '\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9', '\u54d1\u94c3\u98de\u9e1f', '\u9762\u62c9', '\u5377\u8179', '\u5e73\u677f\u652f\u6491',
  '\u8dd1\u6b65', '\u8df3\u7ef3', '\u5212\u8239\u673a', '\u9a91\u884c'
];
var presetColors = {};
exercisePresets.forEach(function(e) {
  presetColors[e] = 'hsl(' + Math.random()*360 + ',60%,55%)';
});

// ========== STATE ==========
var currentTab = 'record';
var calYear, calMonth, selectedDay = null;
var chartWeightInst, chartVolumeInst, chartFreqInst;
var chartFilterEx = 'all';

// ========== INIT ==========
function init() {
  loadData();
  setTodayDate();
  initRecordForm();
  renderStats();
  renderPresets();
  var now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
  switchTab('record');
  document.getElementById('todayLabel').textContent = formatDate(new Date());
}
function setTodayDate() {
  document.getElementById('recDate').value = new Date().toISOString().split('T')[0];
}
function formatDate(d) {
  var m = d.getMonth()+1, day = d.getDate();
  var w = ['\u65e5','\u4e00','\u4e8c','\u4e09','\u56db','\u4e94','\u516d'];
  return m + '\u6708' + day + '\u65e5 \u5468' + w[d.getDay()];
}
function dateKey(d) { return d.toISOString().split('T')[0]; }

// ========== STATS ==========
function renderStats() {
  var total = workouts.length;
  var thisWeek = getWeekWorkouts();
  var exercises = new Set(workouts.map(function(w){return w.exercise;}));
  var bar = document.getElementById('statsBar');
  bar.innerHTML =
    '<div class="stat-card"><div class="stat-val">' + total + '</div><div class="stat-label">\u603b\u8bb0\u5f55</div></div>' +
    '<div class="stat-card"><div class="stat-val">' + thisWeek + '</div><div class="stat-label">\u672c\u5468\u8bad\u7ec3</div></div>' +
    '<div class="stat-card"><div class="stat-val">' + exercises.size + '</div><div class="stat-label">\u8bad\u7ec3\u9879\u76ee</div></div>';
}
function getWeekWorkouts() {
  var now = new Date();
  var day = now.getDay();
  var monday = new Date(now);
  monday.setDate(now.getDate() - (day===0?6:day-1));
  monday.setHours(0,0,0,0);
  return workouts.filter(function(w) { return new Date(w.date) >= monday; }).length;
}

// ========== RECORD FORM ==========
function initRecordForm() {
  var container = document.getElementById('setsContainer');
  container.innerHTML = '';
  addSet();
}
function renderPresets() {
  var el = document.getElementById('exercisePresets');
  el.innerHTML = exercisePresets.map(function(e) {
    return '<span class="preset-chip" onclick="selectPreset(\\'' + e + '\\')">' + e + '</span>';
  }).join('');
}
function selectPreset(name) {
  document.getElementById('recExercise').value = name;
  document.querySelectorAll('#exercisePresets .preset-chip').forEach(function(c) { c.classList.remove('selected'); });
  event.target.classList.add('selected');
}
function addSet() {
  var container = document.getElementById('setsContainer');
  var idx = container.children.length + 1;
  var div = document.createElement('div');
  div.className = 'set-row';
  div.innerHTML =
    '<span class="set-num">#' + idx + '</span>' +
    '<span class="set-label">\u91cd\u91cf</span><input type="number" placeholder="kg" step="0.5" min="0" class="set-weight">' +
    '<span class="set-label">\u6b21\u6570</span><input type="number" placeholder="\u6b21" step="1" min="0" class="set-reps">' +
    '<button class="btn btn-danger btn-sm btn-icon" onclick="this.parentElement.remove();renumberSets(\\'setsContainer\\')">x</button>';
  container.appendChild(div);
}
function renumberSets(containerId) {
  var rows = document.querySelectorAll('#' + containerId + ' .set-row');
  rows.forEach(function(row, i) {
    row.querySelector('.set-num').textContent = '#' + (i+1);
  });
}
function getSetsFromContainer(containerId) {
  var rows = document.querySelectorAll('#' + containerId + ' .set-row');
  var sets = [];
  rows.forEach(function(row) {
    var w = parseFloat(row.querySelector('.set-weight').value) || 0;
    var r = parseInt(row.querySelector('.set-reps').value) || 0;
    if (w > 0 || r > 0) sets.push({ weight: w, reps: r });
  });
  return sets;
}

function saveWorkout() {
  var date = document.getElementById('recDate').value;
  var exercise = document.getElementById('recExercise').value.trim();
  if (!exercise) { showToast('\u8bf7\u8f93\u5165\u8bad\u7ec3\u9879\u76ee'); return; }
  var sets = getSetsFromContainer('setsContainer');
  if (sets.length === 0) { showToast('\u8bf7\u81f3\u5c11\u6dfb\u52a0\u4e00\u7ec4\u8bad\u7ec3\u6570\u636e'); return; }
  workouts.push({ id: genId(), date: date, exercise: exercise, sets: sets });
  saveData();
  showToast('\u8bb0\u5f55\u5df2\u4fdd\u5b58');
  document.getElementById('recExercise').value = '';
  document.querySelectorAll('#exercisePresets .preset-chip').forEach(function(c) { c.classList.remove('selected'); });
  initRecordForm();
  setTodayDate();
  renderStats();
  renderCalendar();
}
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2000);
}

// ========== TAB SWITCHING ==========
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('panel-' + tab).classList.add('active');
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
  if (tab === 'calendar') renderCalendar();
  if (tab === 'charts') renderCharts();
  if (tab === 'history') renderHistory();
  if (tab === 'record') renderStats();
}

// ========== CALENDAR ==========
function renderCalendar() {
  document.getElementById('monthLabel').textContent = calYear + '\u5e74 ' + (calMonth+1) + '\u6708';
  var firstDay = new Date(calYear, calMonth, 1).getDay();
  var daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  var daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
  var today = dateKey(new Date());
  var grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  var wByDate = {};
  workouts.forEach(function(w) {
    if (!wByDate[w.date]) wByDate[w.date] = new Set();
    wByDate[w.date].add(w.exercise);
  });
  // Prev month days
  for (var i = firstDay-1; i >= 0; i--) {
    var d = daysInPrevMonth - i;
    var pm = calMonth === 0 ? 12 : calMonth;
    var py = calMonth === 0 ? calYear-1 : calYear;
    var dt = py + '-' + String(pm).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    grid.appendChild(createDayEl(d, true, dt, wByDate, today));
  }
  // Current month
  for (var d = 1; d <= daysInMonth; d++) {
    var dt = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    grid.appendChild(createDayEl(d, false, dt, wByDate, today));
  }
  // Next month
  var remaining = 42 - (firstDay + daysInMonth);
  for (var d = 1; d <= remaining; d++) {
    var nm = calMonth+2 > 12 ? 1 : calMonth+2;
    var ny = calMonth+2 > 12 ? calYear+1 : calYear;
    var dt = ny + '-' + String(nm).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    grid.appendChild(createDayEl(d, true, dt, wByDate, today));
  }
  if (selectedDay) showDayDetail(selectedDay);
}
function createDayEl(day, otherMonth, dt, wByDate, today) {
  var div = document.createElement('div');
  var cls = 'cal-day';
  if (otherMonth) cls += ' other-month';
  if (dt === today) cls += ' today';
  if (dt === selectedDay) cls += ' selected';
  div.className = cls;
  div.textContent = day;
  div.onclick = function() { selectedDay = dt; renderCalendar(); };
  if (wByDate[dt] && wByDate[dt].size > 0) {
    var dot = document.createElement('div');
    dot.className = 'dot';
    var exercises = Array.from(wByDate[dt]);
    dot.style.background = presetColors[exercises[0]] || 'var(--accent2)';
    div.appendChild(dot);
  }
  return div;
}
function showDayDetail(dt) {
  var dayWorkouts = workouts.filter(function(w) { return w.date === dt; });
  var el = document.getElementById('dayDetail');
  if (dayWorkouts.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);">\u5f53\u5929\u65e0\u8bad\u7ec3\u8bb0\u5f55</div>';
    return;
  }
  var d = new Date(dt + 'T00:00:00');
  var html = '<div class="card-title" style="margin-top:8px;">' + formatDate(d) + ' \u7684\u8bad\u7ec3</div>';
  dayWorkouts.forEach(function(w) {
    var maxW = Math.max.apply(null, w.sets.map(function(s) { return s.weight; }));
    var totalV = w.sets.reduce(function(a,s) { return a + s.weight*s.reps; }, 0);
    html += '<div class="workout-item">' +
      '<div class="wo-exercise">' + w.exercise + '</div>' +
      '<div class="wo-sets">' + w.sets.length + '\u7ec4 | \u6700\u5927\u91cd\u91cf ' + maxW + 'kg | \u603b\u8bad\u7ec3\u91cf ' + totalV + 'kg</div>' +
      '<div class="wo-sets">' + w.sets.map(function(s,i) { return '#' + (i+1) + ': ' + s.weight + 'kg x ' + s.reps + '\u6b21'; }).join(' | ') + '</div>' +
      '<div class="wo-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="openEditModal(\\'' + w.id + '\\')">\u7f16\u8f91</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteWorkout(\\'' + w.id + '\\')">\u5220\u9664</button>' +
      '</div></div>';
  });
  el.innerHTML = html;
}
function prevMonth() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); }
function nextMonth() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); }
function goToday() {
  var now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  selectedDay = dateKey(now);
  renderCalendar();
}

// ========== CHARTS ==========
function destroyCharts() {
  [chartWeightInst, chartVolumeInst, chartFreqInst].forEach(function(c) { if(c) c.destroy(); });
}
function getChartData(exerciseFilter) {
  var filtered = exerciseFilter === 'all' ? workouts.slice() : workouts.filter(function(w) { return w.exercise === exerciseFilter; });
  filtered.sort(function(a,b) { return a.date.localeCompare(b.date); });
  var labels = filtered.map(function(w) { return w.date; });
  var maxWeights = filtered.map(function(w) { return Math.max.apply(null, w.sets.map(function(s) { return s.weight; })); });
  var volumes = filtered.map(function(w) { return w.sets.reduce(function(a,s) { return a + s.weight*s.reps; }, 0); });
  var freqMap = {};
  filtered.forEach(function(w) { freqMap[w.date] = (freqMap[w.date]||0)+1; });
  var freqLabels = Object.keys(freqMap).sort();
  var freqData = freqLabels.map(function(d) { return freqMap[d]; });
  return { labels: labels, maxWeights: maxWeights, volumes: volumes, freqLabels: freqLabels, freqData: freqData };
}
function renderCharts() {
  destroyCharts();
  var data = getChartData(chartFilterEx);
  if (data.labels.length === 0) {
    document.querySelectorAll('#panel-charts .chart-container canvas').forEach(function(c) { c.style.display = 'none'; });
    return;
  }
  document.querySelectorAll('#panel-charts .chart-container canvas').forEach(function(c) { c.style.display = ''; });
  function chartOpts() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#999', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#999', font: { size: 10 } }, grid: { color: '#2a2a2a' }, beginAtZero: false }
      }
    };
  }
  var ctx1 = document.getElementById('chartWeight').getContext('2d');
  chartWeightInst = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{ label: '\u6700\u5927\u91cd\u91cf(kg)', data: data.maxWeights, borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#ff6b35' }]
    },
    options: chartOpts()
  });
  var ctx2 = document.getElementById('chartVolume').getContext('2d');
  chartVolumeInst = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{ label: '\u8bad\u7ec3\u91cf(kg)', data: data.volumes, borderColor: '#4ecdc4', backgroundColor: 'rgba(78,205,196,0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#4ecdc4' }]
    },
    options: chartOpts()
  });
  var ctx3 = document.getElementById('chartFreq').getContext('2d');
  var freqOpts = chartOpts();
  freqOpts.scales.y.beginAtZero = true;
  freqOpts.scales.y.ticks = { stepSize: 1, color: '#999' };
  chartFreqInst = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: data.freqLabels,
      datasets: [{ label: '\u8bad\u7ec3\u6b21\u6570', data: data.freqData, backgroundColor: 'rgba(241,196,15,0.6)', borderColor: '#f1c40f', borderWidth: 1, borderRadius: 4 }]
    },
    options: freqOpts
  });
  // Render chart filters
  var uniqueEx = Array.from(new Set(workouts.map(function(w) { return w.exercise; })));
  var filterEl = document.getElementById('chartFilter');
  var html = '<span class="preset-chip ' + (chartFilterEx==='all'?'selected':'') + '" onclick="chartFilterEx=\\'all\\';renderCharts();">\u5168\u90e8</span>';
  uniqueEx.forEach(function(e) {
    html += '<span class="preset-chip ' + (chartFilterEx===e?'selected':'') + '" onclick="chartFilterEx=\\'' + e + '\\';renderCharts();">' + e + '</span>';
  });
  filterEl.innerHTML = html;
}

// ========== HISTORY ==========
function renderHistory() {
  var search = (document.getElementById('historySearch').value || '').toLowerCase();
  var filtered = workouts.filter(function(w) { return !search || w.exercise.toLowerCase().includes(search); });
  filtered.sort(function(a,b) { return b.date.localeCompare(a.date); });
  var el = document.getElementById('historyList');
  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128236;</div><p>\u6682\u65e0\u8bad\u7ec3\u8bb0\u5f55</p></div>';
    return;
  }
  var html = '';
  filtered.forEach(function(w) {
    var maxW = Math.max.apply(null, w.sets.map(function(s) { return s.weight; }));
    var totalV = w.sets.reduce(function(a,s) { return a + s.weight*s.reps; }, 0);
    html += '<div class="workout-item">' +
      '<div class="wo-date">' + w.date + '</div>' +
      '<div class="wo-exercise">' + w.exercise + '</div>' +
      '<div class="wo-sets">' + w.sets.length + '\u7ec4 | \u6700\u5927 ' + maxW + 'kg | \u603b\u91cf ' + totalV + 'kg</div>' +
      '<div class="wo-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="openEditModal(\\'' + w.id + '\\')">\u7f16\u8f91</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteWorkout(\\'' + w.id + '\\')">\u5220\u9664</button>' +
      '</div></div>';
  });
  el.innerHTML = html;
}

// ========== EDIT / DELETE ==========
function openEditModal(id) {
  var w = workouts.find(function(w) { return w.id === id; });
  if (!w) return;
  document.getElementById('editId').value = w.id;
  document.getElementById('editDate').value = w.date;
  document.getElementById('editExercise').value = w.exercise;
  var container = document.getElementById('editSetsContainer');
  container.innerHTML = '';
  w.sets.forEach(function(s, i) {
    var div = document.createElement('div');
    div.className = 'set-row';
    div.innerHTML =
      '<span class="set-num">#' + (i+1) + '</span>' +
      '<span class="set-label">\u91cd\u91cf</span><input type="number" value="' + s.weight + '" step="0.5" min="0" class="set-weight">' +
      '<span class="set-label">\u6b21\u6570</span><input type="number" value="' + s.reps + '" step="1" min="0" class="set-reps">' +
      '<button class="btn btn-danger btn-sm btn-icon" onclick="this.parentElement.remove();renumberSets(\\'editSetsContainer\\')">x</button>';
    container.appendChild(div);
  });
  document.getElementById('editModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
function addEditSet() {
  var container = document.getElementById('editSetsContainer');
  var idx = container.children.length + 1;
  var div = document.createElement('div');
  div.className = 'set-row';
  div.innerHTML =
    '<span class="set-num">#' + idx + '</span>' +
    '<span class="set-label">\u91cd\u91cf</span><input type="number" placeholder="kg" step="0.5" min="0" class="set-weight">' +
    '<span class="set-label">\u6b21\u6570</span><input type="number" placeholder="\u6b21" step="1" min="0" class="set-reps">' +
    '<button class="btn btn-danger btn-sm btn-icon" onclick="this.parentElement.remove();renumberSets(\\'editSetsContainer\\')">x</button>';
  container.appendChild(div);
}
function saveEdit() {
  var id = document.getElementById('editId').value;
  var w = workouts.find(function(w) { return w.id === id; });
  if (!w) return;
  var exercise = document.getElementById('editExercise').value.trim();
  if (!exercise) { showToast('\u8bf7\u8f93\u5165\u8bad\u7ec3\u9879\u76ee'); return; }
  var sets = getSetsFromContainer('editSetsContainer');
  if (sets.length === 0) { showToast('\u8bf7\u81f3\u5c11\u6dfb\u52a0\u4e00\u7ec4'); return; }
  w.date = document.getElementById('editDate').value;
  w.exercise = exercise;
  w.sets = sets;
  saveData();
  closeEditModal();
  showToast('\u5df2\u66f4\u65b0');
  renderCalendar(); renderHistory(); renderStats();
}
function deleteEdit() {
  if (!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u8bb0\u5f55\uff1f')) return;
  deleteWorkout(document.getElementById('editId').value);
  closeEditModal();
}
function deleteWorkout(id) {
  if (!confirm('\u786e\u5b9a\u5220\u9664\uff1f')) return;
  workouts = workouts.filter(function(w) { return w.id !== id; });
  saveData();
  showToast('\u5df2\u5220\u9664');
  renderCalendar(); renderHistory(); renderStats();
  if (currentTab === 'charts') renderCharts();
}

// ========== STARTUP ==========
init();
