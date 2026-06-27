
// ========== DATA STORE ==========
var STORAGE_KEY = 'fitlog_workouts';
var CATEGORY_KEY = 'fitlog_categories';
var FREQ_KEY = 'fitlog_freq';
var INCREMENT_KEY = 'fitlog_increment';
var DEFAULT_CAT_KEY = 'fitlog_default_categories';
var HISTORY_YEAR_KEY = 'fitlog_history_year_expand';
var HISTORY_MONTH_KEY = 'fitlog_history_month_expand';
var workouts = [];

var defaultCategories = {
  '\u80f8': ['\u81ea\u7531\u5367\u63a8', '\u53f2\u5bc6\u65af\u5e73\u677f\u5367\u63a8', '\u4e0a\u659c\u5367\u63a8', '\u4e0b\u659c\u5367\u63a8', '\u54d1\u94c3\u98de\u9e1f', '\u7ef3\u7d22\u5939\u80f8', '\u53cc\u6760\u81c2\u5c48\u4f38'],
  '\u80cc': ['\u9ad8\u4f4d\u4e0b\u62c9', '\u5c71\u7f8a\u633a\u8eab', '\u5f15\u4f53\u5411\u4e0a', '\u6760\u94c3\u5212\u8239', '\u5355\u81c2\u54d1\u94c3\u5212\u8239', '\u5750\u59ff\u5212\u8239', '\u9762\u62c9'],
  '\u817f': ['\u6df1\u8e72', '\u786c\u62c9', '\u817f\u4e3e', '\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9', '\u817f\u5f2f\u4e3e', '\u817f\u5c48\u4f38', '\u4fdd\u52a0\u5229\u4e9a\u5206\u817f\u8e72', '\u81c0\u63a8'],
  '\u80a9': ['\u80a9\u63a8', '\u4fa7\u5e73\u4e3e', '\u524d\u5e73\u4e3e', '\u9762\u62c9', '\u963f\u8bfa\u5fb7\u63a8\u4e3e', '\u76f4\u7acb\u5212\u8239'],
  '\u624b\u81c2': ['\u4e8c\u5934\u5f2f\u4e3e', '\u4e09\u5934\u4e0b\u538b', '\u6760\u94c3\u5f2f\u4e3e', '\u9524\u5f0f\u5f2f\u4e3e', '\u7ef3\u7d22\u4e0b\u538b', '\u7a84\u8ddd\u5367\u63a8'],
  '\u81c0': ['\u81c0\u63a8', '\u4fdd\u52a0\u5229\u4e9a\u5206\u817f\u8e72', '\u8638\u7f8a\u63d0\u817f', '\u81c0\u6865']
};
var exerciseCategories = {};
var exerciseFreq = {};

function loadData() {
  try { workouts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { workouts = []; }
  try { exerciseCategories = JSON.parse(localStorage.getItem(CATEGORY_KEY)); } catch(e) {}
    var savedDefault = localStorage.getItem(DEFAULT_CAT_KEY);
  if (savedDefault) {
    try { defaultCategories = JSON.parse(savedDefault); } catch(e) {}
  }
  if (!exerciseCategories || Object.keys(exerciseCategories).length === 0) {
    exerciseCategories = JSON.parse(JSON.stringify(defaultCategories));
  } else {
    // Merge new default categories
    Object.keys(defaultCategories).forEach(function(cat) {
      if (!exerciseCategories[cat]) {
        exerciseCategories[cat] = defaultCategories[cat].slice();
      }
    });
  }
  try { exerciseFreq = JSON.parse(localStorage.getItem(FREQ_KEY) || '{}'); } catch(e) { exerciseFreq = {}; }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts)); }
function saveCategories() { localStorage.setItem(CATEGORY_KEY, JSON.stringify(exerciseCategories)); }
function saveFreq() { localStorage.setItem(FREQ_KEY, JSON.stringify(exerciseFreq)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function getIncrement() { var v = parseFloat(localStorage.getItem(INCREMENT_KEY)); return (v > 0) ? v : 2.5; }
function setIncrement(v) { localStorage.setItem(INCREMENT_KEY, v); }

function trackExercise(name) {
  exerciseFreq[name] = (exerciseFreq[name] || 0) + 1;
  saveFreq();
}
function getFrequent(n) {
  var entries = [];
  Object.keys(exerciseFreq).forEach(function(k) { entries.push({name: k, count: exerciseFreq[k]}); });
  entries.sort(function(a,b) { return b.count - a.count; });
  return entries.slice(0, n).map(function(e) { return e.name; });
}
function getAllExercises() {
  var all = [];
  Object.keys(exerciseCategories).forEach(function(cat) {
    exerciseCategories[cat].forEach(function(ex) { all.push(ex); });
  });
  return all;
}

// ========== STATE ==========
var currentTab = 'record';
var chartWeightInst = null, chartVolumeInst = null, chartFreqInst = null;
var chartFilterEx = 'all';
var chartExpandedCat = null;


function init() {
  loadData();
  setTodayDate();
  initRecordForm();
  renderStats();
  renderPresets();
  renderSettingsPage();
  switchTab('record');
  document.getElementById('todayLabel').textContent = formatDate(new Date());
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.rep-menu-wrap')) {
      document.querySelectorAll('.rep-menu-drop').forEach(function(d) { d.style.display = 'none'; });
    }
  });
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
  document.getElementById('statsBar').innerHTML =
    '<div class="stat-card"><div class="stat-val">' + total + '</div><div class="stat-label">\u603b\u8bb0\u5f55</div></div>' +
    '<div class="stat-card"><div class="stat-val">' + thisWeek + '</div><div class="stat-label">\u672c\u5468\u8bad\u7ec3</div></div>';
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
  document.getElementById('setsContainer').innerHTML = '';
  addSet();
}
function renderPresets() {
  var el = document.getElementById('exercisePresets');
  var freq = getFrequent(8);
  var html = '';
  freq.forEach(function(e) {
    html += '<span class="preset-chip" data-ex="' + e + '" onclick="selectPreset(this)">' + e + '</span>';
  });
  if (freq.length === 0) {
    html = '<span style="font-size:12px;color:var(--text2)">\u8bb0\u5f55\u8bad\u7ec3\u540e\u8fd9\u91cc\u4f1a\u51fa\u73b0\u5e38\u7528\u9879\u76ee</span>';
  }
  el.innerHTML = html;
}
function selectPreset(el) {
  document.getElementById('recExercise').value = el.getAttribute('data-ex');
  document.querySelectorAll('#exercisePresets .preset-chip').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
}

// ========== CATEGORY PICKER ==========
function openCategoryPicker() {
  document.getElementById('catPickerModal').style.display = 'flex';
  renderCategoryPicker();
}
function closeCategoryPicker() {
  document.getElementById('catPickerModal').style.display = 'none';
}
function renderCategoryPicker(catName) {
  var catList = document.getElementById('catList');
  var exList = document.getElementById('catExList');
  var cats = Object.keys(exerciseCategories);
  catList.innerHTML = '';
  cats.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat === catName ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = function() { renderCategoryPicker(cat); };
    catList.appendChild(btn);
  });
  exList.innerHTML = '';
  var selectedCat = catName || cats[0];
  if (selectedCat && exerciseCategories[selectedCat]) {
    exerciseCategories[selectedCat].forEach(function(ex) {
      var chip = document.createElement('span');
      chip.className = 'ex-chip';
      chip.textContent = ex;
      chip.onclick = function() {
        document.getElementById('recExercise').value = ex;
        closeCategoryPicker();
      };
      exList.appendChild(chip);
    });
  }
}

// ========== SET ROWS ==========
function addSet() {
  var container = document.getElementById('setsContainer');
  var idx = container.children.length + 1;
  var inc = getIncrement();
  var lastWeight = '';
  var lastReps = '';
  var rows = container.querySelectorAll('.set-row');
  if (rows.length > 0) {
    var lastW = rows[rows.length-1].querySelector('.set-weight');
    var lastR = rows[rows.length-1].querySelector('.set-reps');
    lastWeight = lastW ? (lastW.value || '') : '';
    lastReps = lastR ? (lastR.value || '') : '';
  }
  var div = document.createElement('div');
  div.className = 'set-row';
  div.innerHTML =
    '<span class="set-num">#' + idx + '</span>' +
    '<div class="set-input-wrap" style="flex:1"><input type="number" placeholder="0" step="0.5" min="0" class="set-weight" value="' + lastWeight + '"><span class="set-unit">kg</span></div>' +
    '<div class="wadj-stack"><button class="btn-wadj-up" type="button" onclick="adjWeight(this,1)">\u25b2</button><button class="btn-wadj-down" type="button" onclick="adjWeight(this,-1)">\u25bc</button></div>' +
    '<span class="set-label" style="margin:0 2px">\u00d7</span>' +
    '<div class="set-input-wrap" style="flex:0.8"><input type="number" placeholder="0" step="1" min="0" class="set-reps" value="' + lastReps + '"><span class="set-unit">\u6b21</span></div>' +
    '<div class="rep-menu-wrap"><button class="btn-rep-menu" type="button" onclick="toggleRepMenu(this)" title="\u5feb\u6377\u6b21\u6570">\u2261</button><div class="rep-menu-drop"><span class="rep-chip" onclick="setRep(this,4)">4</span><span class="rep-chip" onclick="setRep(this,8)">8</span><span class="rep-chip" onclick="setRep(this,12)">12</span></div></div>' +
    '<div class="radj-stack"><button class="btn-radj-up" type="button" onclick="adjRep(this,1)">\u25b2</button><button class="btn-radj-down" type="button" onclick="adjRep(this,-1)">\u25bc</button></div>' +
    '<button class="btn btn-danger btn-sm btn-icon" type="button" onclick="this.closest(\x27.set-row\x27).remove();renumberSets(\x27setsContainer\x27)">x</button>';
  container.appendChild(div);
}
function setRep(chip, val) {
  var row = chip.closest('.set-row');
  var input = row.querySelector('.set-reps');
  input.value = val;
  row.querySelectorAll('.rep-chip').forEach(function(c) { c.classList.remove('active'); });
  chip.classList.add('active');
}
function adjWeight(btn, sign) {
  var row = btn.closest('.set-row');
  var input = row.querySelector('.set-weight');
  var inc = getIncrement();
  var v = parseFloat(input.value) || 0;
  v = Math.max(0, Math.round((v + inc * sign) * 10) / 10);
  input.value = v;
}
function adjRep(btn, sign) {
  var row = btn.closest('.set-row');
  var input = row.querySelector('.set-reps');
  var v = parseInt(input.value) || 0;
  v = Math.max(0, v + sign);
  input.value = v;
}
function toggleRepMenu(btn) {
  var drop = btn.nextElementSibling;
  var isOpen = drop.style.display === 'flex';
  // close all others first
  document.querySelectorAll('.rep-menu-drop').forEach(function(d) { d.style.display = 'none'; });
  drop.style.display = isOpen ? 'none' : 'flex';
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
  var dateInput = document.getElementById('recDate');
  var date = dateInput.value;
  var exercise = document.getElementById('recExercise').value.trim();
  if (!exercise) { showToast('\u8bf7\u8f93\u5165\u8bad\u7ec3\u9879\u76ee'); return; }
  var sets = getSetsFromContainer('setsContainer');
  if (sets.length === 0) { showToast('\u8bf7\u81f3\u5c11\u6dfb\u52a0\u4e00\u7ec4\u8bad\u7ec3\u6570\u636e'); return; }
  workouts.push({ id: genId(), date: date, exercise: exercise, sets: sets });
  trackExercise(exercise);
  saveData();
  var savedDate = date;
  showToast('\u8bb0\u5f55\u5df2\u4fdd\u5b58 (\u65e5\u671f:' + savedDate + ')');
  document.getElementById('recExercise').value = '';
  document.querySelectorAll('#exercisePresets .preset-chip').forEach(function(c) { c.classList.remove('selected'); });
  initRecordForm();
  renderStats();
  renderPresets();
  if (currentTab === 'history') renderHistory();
  // Reset date to today
  setTodayDate();
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
  var panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');
  var btn = document.querySelector('[data-tab="' + tab + '"]');
  if (btn) btn.classList.add('active');
  if (tab === 'charts') renderCharts();
  if (tab === 'history') renderHistory();
  if (tab === 'record') renderStats();
  if (tab === 'settings') renderSettingsPage();
}

// ========== SETTINGS PAGE ==========
var currentSetting = null;

var expandedCategories = {};

function renderSettingsPage() {
  document.getElementById('settingsMenu').style.display = '';
  document.getElementById('settingSubpanel').style.display = 'none';
  currentSetting = null;
  expandedCategories = {};
}

function openSetting(name) {
  currentSetting = name;
  document.getElementById('settingsMenu').style.display = 'none';
  var panel = document.getElementById('settingSubpanel');
  panel.style.display = '';

  if (name === 'categories') {
    var cats = Object.keys(exerciseCategories);
    var html = '<div class="settings-back" onclick="renderSettingsPage()">\u2039 \u8fd4\u56de\u8bbe\u7f6e</div>';
    html += '<div class="card"><div class="card-title">\u7ba1\u7406\u8bad\u7ec3\u5206\u7c7b</div>';
    cats.forEach(function(cat) {
      html += '<div class="settings-cat">' +
        '<div class="settings-cat-header" onclick="toggleCategory(\'' + cat + '\')" style="cursor:pointer">' +
          '<span class="settings-cat-toggle" id="catToggle-' + cat + '">' + (expandedCategories[cat] ? '\u25bc' : '\u25b6') + '</span>' +
          '<span class="settings-cat-name">' + cat + ' (' + exerciseCategories[cat].length + ')</span>' +
          '<button class="btn btn-danger btn-sm" type="button" onclick="event.stopPropagation();deleteCategory(\'' + cat + '\')">\u5220\u9664\u5206\u7c7b</button>' +
        '</div>' +
        '<div class="settings-ex-list" id="catBody-' + cat + '" style="display:' + (expandedCategories[cat] ? '' : 'none') + '">';
      exerciseCategories[cat].forEach(function(ex) {
        html += '<div class="settings-ex-row">' +
          '<span ondblclick="renameExercise(\x27' + cat + '\x27,\x27' + ex + '\x27)">' + ex + '</span>' +
          '<button class="btn btn-danger btn-sm btn-icon" type="button" onclick="deleteExercise(\'' + cat + '\',\'' + ex + '\')">x</button>' +
          '</div>';
      });
      html += '<div style="margin-top:6px;display:flex;gap:4px">' +
          '<input type="text" id="newEx-' + cat + '" placeholder="\u6dfb\u52a0\u9879\u76ee..." style="flex:1;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px">' +
          '<button class="btn btn-outline btn-sm" type="button" onclick="addExercise(\'' + cat + '\')">+</button>' +
        '</div></div></div>';
    });
    html += '<div style="margin-top:12px;display:flex;gap:4px">' +
      '<input type="text" id="newCatName" placeholder="\u65b0\u5efa\u5206\u7c7b\u540d\u79f0..." style="flex:1;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px">' +
      '<button class="btn btn-primary btn-sm" type="button" onclick="addCategory()">+ \u65b0\u5efa</button>' +
      '</div></div>';
    html += '<div style="margin-top:12px;display:flex;gap:8px">';
    html += '<button class="btn btn-outline btn-sm" type="button" onclick="resetCategories()" style="flex:1">\u6062\u590d\u9ed8\u8ba4\u5206\u7c7b</button>';
    html += '<button class="btn btn-outline btn-sm" type="button" onclick="setAsDefault()" style="flex:1">\u8bbe\u4e3a\u9ed8\u8ba4\u5206\u7c7b</button>';
    html += '</div>';
    panel.innerHTML = html;
  }
  else if (name === 'theme') {
    var current = localStorage.getItem(THEME_KEY) || 'dark';
    var html = '<div class="settings-back" onclick="renderSettingsPage()">\u2039 \u8fd4\u56de\u8bbe\u7f6e</div>';
    html += '<div class="card"><div class="card-title">\u9009\u62e9\u4e3b\u9898</div>';
    THEME_LIST.forEach(function(th) {
      var sel = current === th.id ? ' selected' : '';
      var check = current === th.id ? '<span class="theme-check">\u2713</span>' : '';
      html += '<div class="theme-option' + sel + '" onclick="setTheme(\x27' + th.id + '\x27)">';
      html += '<span class="theme-icon">' + th.icon + '</span><div><div class="theme-name">' + th.name + '</div><div class="theme-desc">' + th.desc + '</div></div>';
      html += check;
      html += '</div>';
    });
    html += '</div></div>';
    panel.innerHTML = html;
  }
  else if (name === 'increment') {
    var inc = getIncrement();
    var html = '<div class="settings-back" onclick="renderSettingsPage()">\u2039 \u8fd4\u56de\u8bbe\u7f6e</div>';
    html += '<div class="card"><div class="card-title">\u91cd\u91cf\u6bcf\u6b21\u589e\u52a0\u8bbe\u7f6e</div>';
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:12px">\u70b9\u51fb +/-\u6309\u94ae\u65f6\uff0c\u91cd\u91cf\u6bcf\u6b21\u589e\u51cf\u7684\u6570\u503c</p>';
    html += '<div style="display:flex;gap:8px;align-items:center">';
    html += '<input type="number" id="incValue" value="' + inc + '" step="0.5" min="0.5" max="100" style="flex:1;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:16px">';
    html += '<span style="color:var(--text2);font-size:14px">kg</span>';
    html += '<button class="btn btn-primary" type="button" onclick="saveIncrement()">\u4fdd\u5b58</button>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">';
    [0.5, 1, 2.5, 5, 7.5, 10, 15, 20, 25, 50].forEach(function(v) {
      html += '<button class="btn btn-outline btn-sm" type="button" onclick="document.getElementById(\'incValue\').value=' + v + '">' + v + ' kg</button>';
    });
    html += '</div></div>';
    panel.innerHTML = html;
  }
    else if (name === 'debugData') {
    var inDebug = localStorage.getItem('fitlog_debug_mode') === '1';
    var html = '<div class="settings-back" onclick="renderSettingsPage()">\u2039 \u8fd4\u56de\u8bbe\u7f6e</div>';
    html += '<div class="card"><div class="card-title">\u8c03\u8bd5\u6570\u636e\u6d4b\u8bd5</div>';
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:16px">\u751f\u6210 2004\u5e745\u67082\u65e5\u8d77\u4e09\u5e74\u7684\u5e73\u677f\u5367\u63a8\u8bb0\u5f55\u3002</p>';
    if (inDebug) {
      html += '<p style="font-size:13px;color:var(--accent);margin-bottom:12px">\u2713 \u5f53\u524d\u6b63\u5728\u8c03\u8bd5\u6a21\u5f0f</p>';
      html += '<button class="btn btn-outline btn-block" type="button" onclick="exitDebugMode()">\u9000\u51fa\u8c03\u8bd5</button>';
    }
    html += '<button class="btn btn-primary btn-block" type="button" onclick="generateDebugData()" style="margin-top:8px">\u8bbe\u7f6e\u8bad\u7ec3\u6570\u636e\u8fdb\u884c\u8c03\u8bd5</button>';
    html += '</div>';
    panel.innerHTML = html;
  }
  else if (name === 'about') {
    var html = '<div class="settings-back" onclick="renderSettingsPage()">\u2039 \u8fd4\u56de\u8bbe\u7f6e</div>';
    html += '<div class="card" style="text-align:center">';
    html += '<div class="card-title">FitLog \u5065\u8eab\u8bb0\u5f55</div>';
    html += '<p style="font-size:13px;color:var(--text2)">\u7248\u672c 1.0</p>';
    html += '<p style="font-size:13px;color:var(--text2);margin-top:8px">\u8bb0\u5f55\u6bcf\u4e00\u6b21\u8bad\u7ec3\uff0c\u8ffd\u8e2a\u6bcf\u4e00\u70b9\u8fdb\u6b65\u3002</p>';
    html += '<p style="font-size:11px;color:var(--text2);margin-top:16px">\u6570\u636e\u4ec5\u5b58\u50a8\u5728\u672c\u5730\u6d4f\u89c8\u5668\u4e2d</p>';
    html += '</div>';
    panel.innerHTML = html;
  }
  else if (name === 'historyExpand') {
    var yearOn = localStorage.getItem(HISTORY_YEAR_KEY) !== 'false';
    var monthOn = localStorage.getItem(HISTORY_MONTH_KEY) === 'true';
    var html = '<div class="settings-back" onclick="renderSettingsPage()">\u2039 \u8fd4\u56de\u8bbe\u7f6e</div>';
    html += '<div class="card"><div class="card-title">\u5386\u53f2\u5206\u7ea7\u5c55\u5f00\u8bbe\u7f6e</div>';
    html += '<div class="theme-option' + (yearOn ? ' selected' : '') + '" onclick="toggleHistoryExpand(\x27year\x27)">';
    html += '<span class="theme-icon">\ud83d\udcc5</span><div><div class="theme-name">\u5e74\u5206\u7ea7\u9ed8\u8ba4\u5c55\u5f00</div><div class="theme-desc">\u6253\u5f00\u5386\u53f2\u65f6\u81ea\u52a8\u5c55\u5f00\u5e74\u4efd</div></div>';
    html += yearOn ? '<span class="theme-check">\u2713</span>' : '';
    html += '</div>';
    html += '<div class="theme-option' + (monthOn ? ' selected' : '') + '" onclick="toggleHistoryExpand(\x27month\x27)">';
    html += '<span class="theme-icon">\ud83d\udcc6</span><div><div class="theme-name">\u6708\u5206\u7ea7\u9ed8\u8ba4\u5c55\u5f00</div><div class="theme-desc">\u6253\u5f00\u5386\u53f2\u65f6\u81ea\u52a8\u5c55\u5f00\u6708\u4efd</div></div>';
    html += monthOn ? '<span class="theme-check">\u2713</span>' : '';
    html += '</div></div>';
    panel.innerHTML = html;
  }
}

// Category toggle
function toggleHistoryExpand(type) {
  if (type === 'year') {
    var cur = localStorage.getItem(HISTORY_YEAR_KEY) !== 'false';
    localStorage.setItem(HISTORY_YEAR_KEY, cur ? 'false' : 'true');
  } else {
    var cur2 = localStorage.getItem(HISTORY_MONTH_KEY) === 'true';
    localStorage.setItem(HISTORY_MONTH_KEY, cur2 ? 'false' : 'true');
  }
  openSetting('historyExpand');
}

function toggleCategory(cat) {
  var body = document.getElementById('catBody-' + cat);
  var toggle = document.getElementById('catToggle-' + cat);
  if (body.style.display === 'none') {
    body.style.display = '';
    toggle.textContent = '\u25bc';
    expandedCategories[cat] = true;
  } else {
    body.style.display = 'none';
    toggle.textContent = '\u25b6';
    delete expandedCategories[cat];
  }
}

// Category CRUD
function addCategory() {
  var input = document.getElementById('newCatName');
  var name = input.value.trim();
  if (!name) { showToast('\u8bf7\u8f93\u5165\u5206\u7c7b\u540d\u79f0'); return; }
  if (exerciseCategories[name]) { showToast('\u5206\u7c7b\u5df2\u5b58\u5728'); return; }
  exerciseCategories[name] = [];
  saveCategories();
  input.value = '';
  openSetting('categories');
  showToast('\u5206\u7c7b\u5df2\u6dfb\u52a0');
}
function deleteCategory(cat) {
  if (!confirm('\u786e\u5b9a\u5220\u9664"' + cat + '"\u5206\u7c7b\uff1f')) return;
  delete exerciseCategories[cat];
  saveCategories();
  openSetting('categories');
  showToast('\u5df2\u5220\u9664');
}
function addExercise(cat) {
  var input = document.getElementById('newEx-' + cat);
  var name = input.value.trim();
  if (!name) { showToast('\u8bf7\u8f93\u5165\u9879\u76ee\u540d\u79f0'); return; }
  if (exerciseCategories[cat].indexOf(name) >= 0) { showToast('\u9879\u76ee\u5df2\u5b58\u5728'); return; }
  exerciseCategories[cat].push(name);
  saveCategories();
  input.value = '';
  openSetting('categories');
  showToast('\u9879\u76ee\u5df2\u6dfb\u52a0');
}
function deleteExercise(cat, ex) {
  exerciseCategories[cat] = exerciseCategories[cat].filter(function(e) { return e !== ex; });
  saveCategories();
  openSetting('categories');
  showToast('\u5df2\u5220\u9664');
}
function renameExercise(cat, oldName) {
  var span = event.target;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.style.cssText = 'flex:1;padding:4px 8px;background:var(--surface);border:1px solid var(--accent);border-radius:6px;color:var(--text);font-size:14px;outline:none;font-family:inherit';
  span.replaceWith(input);
  input.focus();
  input.select();
  input.onblur = function() { finishRename(cat, oldName, input); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') finishRename(cat, oldName, input);
    if (e.key === 'Escape') finishRename(cat, oldName, input);
  };
}

function finishRename(cat, oldName, input) {
  var newName = input.value.trim();
  if (!newName || newName === oldName) {
    var span2 = document.createElement('span');
    span2.textContent = oldName;
    span2.setAttribute('ondblclick', "renameExercise('" + cat + "','" + oldName + "')");
    input.replaceWith(span2);
    return;
  }
  var idx = exerciseCategories[cat].indexOf(oldName);
  if (idx < 0) return;
  if (exerciseCategories[cat].indexOf(newName) >= 0) {
    showToast('\u9879\u76ee\u5df2\u5b58\u5728');
    var span2 = document.createElement('span');
    span2.textContent = oldName;
    span2.setAttribute('ondblclick', "renameExercise('" + cat + "','" + oldName + "')");
    input.replaceWith(span2);
    return;
  }
  exerciseCategories[cat][idx] = newName;
  saveCategories();
  var span2 = document.createElement('span');
  span2.textContent = newName;
  span2.setAttribute('ondblclick', "renameExercise('" + cat + "','" + newName + "')");
  input.replaceWith(span2);
  showToast('\u5df2\u4fee\u6539');
}

function setAsDefault() {
  if (!confirm('\u5c06\u5f53\u524d\u8bad\u7ec3\u5206\u7c7b\u8bbe\u4e3a\u9ed8\u8ba4\uff1f\u4ee5\u540e\u201c\u6062\u590d\u9ed8\u8ba4\u201d\u5c06\u8fd8\u539f\u5230\u6b64\u72b6\u6001\u3002')) return;
  defaultCategories = JSON.parse(JSON.stringify(exerciseCategories));
  localStorage.setItem(DEFAULT_CAT_KEY, JSON.stringify(defaultCategories));
  showToast('\u5df2\u8bbe\u4e3a\u9ed8\u8ba4\u5206\u7c7b');
  openSetting('categories');
}

function resetCategories() {
  if (!confirm('\u6062\u590d\u9ed8\u8ba4\u5206\u7c7b\u4f1a\u8986\u76d6\u5f53\u524d\u8bbe\u7f6e\uff0c\u786e\u5b9a\uff1f')) return;
  exerciseCategories = JSON.parse(JSON.stringify(defaultCategories));
  saveCategories();
  openSetting('categories');
  showToast('\u5df2\u6062\u590d\u9ed8\u8ba4');
}

// Increment
function saveIncrement() {
  var v = parseFloat(document.getElementById('incValue').value);
  if (!v || v <= 0) { showToast('\u8bf7\u8f93\u5165\u6709\u6548\u6570\u503c'); return; }
  setIncrement(v);
  showToast('\u5df2\u4fdd\u5b58: ' + v + ' kg');
}

// Theme
var THEME_KEY = 'fitlog_theme';
function loadTheme() {
  var t = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(t, true);
}

var THEME_LIST = [
  { id: 'dark', name: '\u6df1\u8272\u6a21\u5f0f', icon: '\u263e', desc: '\u6df1\u8272\u80cc\u666f\uff0c\u62a4\u773c\u8212\u9002' },
  { id: 'light', name: '\u6d45\u8272\u6a21\u5f0f', icon: '\u2600', desc: '\u660e\u4eae\u6e05\u723d\uff0c\u767d\u5929\u4f7f\u7528' },
  { id: 'ocean', name: '\u6d77\u6d0b\u84dd', icon: '\ud83c\udf0a', desc: '\u6e05\u723d\u84dd\u8c03\uff0c\u5b81\u9759\u4e13\u6ce8' },
  { id: 'forest', name: '\u68ee\u6797\u7eff', icon: '\ud83c\udf32', desc: '\u81ea\u7136\u7eff\u610f\uff0c\u6c89\u7a33\u8212\u7f13' },
  { id: 'sunset', name: '\u65e5\u843d\u6a59', icon: '\ud83c\udf07', desc: '\u6e29\u6696\u6a59\u8c03\uff0c\u6d3b\u529b\u5145\u6c9b' },
  { id: 'purple', name: '\u7d2b\u7f57\u5170', icon: '\ud83d\udc9c', desc: '\u7d2b\u8272\u9b45\u529b\uff0c\u4f18\u96c5\u65f6\u5c1a' }
];

function setTheme(t, silent) {
  localStorage.setItem(THEME_KEY, t);
  // Remove all theme classes
  var themes = ['dark', 'light', 'ocean', 'forest', 'sunset', 'purple'];
  themes.forEach(function(th) { document.body.classList.remove('theme-' + th); });
  // Add the selected theme class (dark is default, no class needed)
  if (t !== 'dark') {
    document.body.classList.add('theme-' + t);
  }
  if (!silent && currentSetting === 'theme') openSetting('theme');
}// ========== CHARTS ==========
var chartWeightInst = null, chartVolumeInst = null, chartFreqInst = null;
var chartFilterEx = 'all';
var chartExpandedCat = null;
var setFilterMode = 'all'; // 'all' or set index 0,1,2...

var RAINBOW = [
  '#ff4444','#ff8c00','#ffd700','#2ecc71','#3498db','#8b5cf6','#e056a0',
  '#ff6b6b','#f0a500','#c9e265','#1abc9c','#5dade2','#af7ac5','#f06292'
];

var pan1 = 0, zoom1 = 30;
var pan2 = 0, zoom2 = 30;
var pan3 = 0, zoom3 = 30;
var totalLabels1 = 0, totalLabels2 = 0, totalLabels3 = 0;

function syncSliders() {
  if (chartWeightInst) {
    var s1 = document.getElementById('chartSlider');
    zoom1 = Math.min(zoom1, totalLabels1);
    if (pan1 + zoom1 > totalLabels1) pan1 = Math.max(0, totalLabels1 - zoom1);
    s1.min = 0; s1.max = Math.max(0, totalLabels1 - zoom1); s1.value = pan1;
  }
  if (chartVolumeInst) {
    var s2 = document.getElementById('chartSlider2');
    zoom2 = Math.min(zoom2, totalLabels2);
    if (pan2 + zoom2 > totalLabels2) pan2 = Math.max(0, totalLabels2 - zoom2);
    s2.min = 0; s2.max = Math.max(0, totalLabels2 - zoom2); s2.value = pan2;
  }
  if (chartFreqInst) {
    var s3 = document.getElementById('chartSlider3');
    zoom3 = Math.min(zoom3, totalLabels3);
    if (pan3 + zoom3 > totalLabels3) pan3 = Math.max(0, totalLabels3 - zoom3);
    s3.min = 0; s3.max = Math.max(0, totalLabels3 - zoom3); s3.value = pan3;
  }
}

function onSliderChange() { pan1 = parseInt(document.getElementById('chartSlider').value); updateChart1(); }
function onSliderChange2() { pan2 = parseInt(document.getElementById('chartSlider2').value); updateChart2(); }
function onSliderChange3() { pan3 = parseInt(document.getElementById('chartSlider3').value); updateChart3(); }

// Wheel zoom for charts
function onChartWheel(e, chartNum) {
  e.preventDefault();
  var delta = e.deltaY > 0 ? 3 : -3;
  if (chartNum === 1) {
    zoom1 = Math.max(1, Math.min(30, zoom1 + delta));
    updateChart1();
  } else if (chartNum === 2) {
    zoom2 = Math.max(1, Math.min(30, zoom2 + delta));
    updateChart2();
  } else if (chartNum === 3) {
    zoom3 = Math.max(1, Math.min(30, zoom3 + delta));
    updateChart3();
  }
}

// Attach wheel listeners to chart canvases
// Pinch zoom for touch devices
var pinchStates = { 1: { lastScale: 1, startZoom: 1 }, 2: { lastScale: 1, startZoom: 1 }, 3: { lastScale: 1, startZoom: 1 } };
function attachPinchListeners() {
  var ids = ['chartWeight', 'chartVolume', 'chartFreq'];
  ids.forEach(function(id, idx) {
    var cn = idx + 1;
    var canvas = document.getElementById(id);
    if (!canvas) return;
    if (typeof Hammer !== 'undefined') {
      var mc = new Hammer.Manager(canvas, { touchAction: "none" }); mc.add(new Hammer.Pinch());
      
      mc.on('pinchstart', function(e) {
        e.preventDefault();
        pinchStates[cn].startZoom = cn === 1 ? zoom1 : cn === 2 ? zoom2 : zoom3;
        pinchStates[cn].lastScale = e.scale;
      });
      mc.on('pinchmove', function(e) {
        e.preventDefault();
        var scale = e.scale;
        var delta = Math.round((pinchStates[cn].lastScale - scale) * 10);
        if (delta !== 0) {
          var newZoom = Math.max(1, Math.min(90, pinchStates[cn].startZoom + delta));
          pinchStates[cn].lastScale = scale;
          if (cn === 1 && newZoom !== zoom1) { zoom1 = newZoom; updateChart1(); }
          else if (cn === 2 && newZoom !== zoom2) { zoom2 = newZoom; updateChart2(); }
          else if (cn === 3 && newZoom !== zoom3) { zoom3 = newZoom; updateChart3(); }
        }
      });
    }
  });
}
function attachWheelListeners() {
  var c1 = document.getElementById('chartWeight');
  var c2 = document.getElementById('chartVolume');
  var c3 = document.getElementById('chartFreq');
  if (c1) c1.onwheel = function(e) { onChartWheel(e, 1); };
  if (c2) c2.onwheel = function(e) { onChartWheel(e, 2); };
  if (c3) c3.onwheel = function(e) { onChartWheel(e, 3); };
}


function updateChart1() {
  if (!chartWeightInst) return;
  var setData = buildSetData(chartFilterEx);
  totalLabels1 = setData.labels.length;
  zoom1 = Math.min(zoom1, totalLabels1);
  if (pan1 + zoom1 > totalLabels1) pan1 = Math.max(0, totalLabels1 - zoom1);
  var wStart = pan1;
  var wEnd = Math.min(pan1 + zoom1, totalLabels1);
  var wLabels = setData.labels.slice(wStart, wEnd);
  var datasetsToShow;
  if (setFilterMode === 'all') {
    datasetsToShow = setData.datasets;
  } else {
    var si = parseInt(setFilterMode);
    datasetsToShow = (si >= 0 && si < setData.datasets.length) ? [setData.datasets[si]] : [];
  }
  chartWeightInst.data.labels = wLabels;
  chartWeightInst.data.datasets = datasetsToShow.map(function(ds) {
    return {
      label: ds.label,
      data: ds.data.slice(wStart, wEnd),
      borderColor: ds.borderColor,
      backgroundColor: ds.backgroundColor,
      tension: ds.tension,
      pointRadius: ds.pointRadius,
      borderWidth: ds.borderWidth,
      spanGaps: ds.spanGaps
    };
  });
  chartWeightInst.options = chartOpts(setFilterMode === 'all' && datasetsToShow.length > 1, chartWeightInst.data.labels);
  chartWeightInst.update();
  var s1 = document.getElementById('chartSlider');
  s1.min = 0; s1.max = Math.max(0, totalLabels1 - zoom1); s1.value = pan1;
}

function updateChart2() {
  if (!chartVolumeInst) return;
  var heaviestData = buildHeaviestData(chartFilterEx);
  totalLabels2 = heaviestData.labels.length;
  zoom2 = Math.min(zoom2, totalLabels2);
  if (pan2 + zoom2 > totalLabels2) pan2 = Math.max(0, totalLabels2 - zoom2);
  var hStart = pan2;
  var hEnd = Math.min(pan2 + zoom2, totalLabels2);
  chartVolumeInst.data.labels = heaviestData.labels.slice(hStart, hEnd);
  chartVolumeInst.data.datasets[0].data = heaviestData.data.slice(hStart, hEnd);
  chartVolumeInst.update();
  var s2 = document.getElementById('chartSlider2');
  s2.min = 0; s2.max = Math.max(0, totalLabels2 - zoom2); s2.value = pan2;
}

function updateChart3() {
  if (!chartFreqInst) return;
  var freqData = buildFreqData(chartFilterEx);
  totalLabels3 = freqData.labels.length;
  zoom3 = Math.min(zoom3, totalLabels3);
  if (pan3 + zoom3 > totalLabels3) pan3 = Math.max(0, totalLabels3 - zoom3);
  var fStart = pan3;
  var fEnd = Math.min(pan3 + zoom3, totalLabels3);
  chartFreqInst.data.labels = freqData.labels.slice(fStart, fEnd);
  chartFreqInst.data.datasets[0].data = freqData.data.slice(fStart, fEnd);
  chartFreqInst.update();
  var s3 = document.getElementById('chartSlider3');
  s3.min = 0; s3.max = Math.max(0, totalLabels3 - zoom3); s3.value = pan3;
}


// Update chart filter only (no chart re-render)
function renderChartFilter() {
  var exHtml = '<span class="preset-chip ' + (chartFilterEx==='all'?'selected':'') + '" data-filter="all" onclick="chartFilterEx=this.getAttribute(\x27data-filter\x27);chartExpandedCat=null;renderCharts();">\u5168\u90e8</span>';
  var cats = Object.keys(exerciseCategories);
  cats.forEach(function(cat) {
    var isExpanded = chartExpandedCat === cat;
    exHtml += '<span class="preset-chip' + (isExpanded ? ' selected' : '') + '" onclick="chartExpandedCat=chartExpandedCat===\x27' + cat + '\x27?null:\x27' + cat + '\x27;renderChartFilter();">' + cat + (isExpanded ? ' \u25bc' : ' \u25b6') + '</span>';
    if (isExpanded) {
      var exs = exerciseCategories[cat];
      exs.forEach(function(ex) {
        exHtml += '<span class="preset-chip sub-chip ' + (chartFilterEx===ex?'selected':'') + '" data-filter="' + ex + '" onclick="chartFilterEx=this.getAttribute(\x27data-filter\x27);renderCharts();">' + ex + '</span>';
      });
    }
  });
  document.getElementById('chartFilter').innerHTML = exHtml;
}
function destroyCharts() {
  if (chartWeightInst) { chartWeightInst.destroy(); chartWeightInst = null; }
  if (chartVolumeInst) { chartVolumeInst.destroy(); chartVolumeInst = null; }
  if (chartFreqInst) { chartFreqInst.destroy(); chartFreqInst = null; }
}

// Build per-set data: { labels: [dates], datasets: [{set index, color, data}] }
function buildSetData(filter) {
  var filtered = filter === 'all' ? workouts.slice() : workouts.filter(function(w) { return w.exercise === filter; });
  filtered.sort(function(a,b) { return a.date.localeCompare(b.date); });

  var dates = [];
  var seenDates = {};
  filtered.forEach(function(w) {
    if (!seenDates[w.date]) { seenDates[w.date] = true; dates.push(w.date); }
  });

  // For each set index (0=1st set, 1=2nd set, etc.), build data array aligned with dates
  var maxSetIdx = 0;
  filtered.forEach(function(w) { if (w.sets.length > maxSetIdx) maxSetIdx = w.sets.length; });

  var datasets = [];
  for (var si = 0; si < maxSetIdx; si++) {
    var data = dates.map(function(d) {
      var dayWorkouts = filtered.filter(function(w) { return w.date === d; });
      // For a given day, take the first workout's si-th set weight
      for (var j = 0; j < dayWorkouts.length; j++) {
        if (dayWorkouts[j].sets.length > si) return dayWorkouts[j].sets[si].weight;
      }
      return null;
    });
    datasets.push({
      setIndex: si,
      label: '\u7b2c' + (si+1) + '\u7ec4',
      data: data,
      borderColor: RAINBOW[si % RAINBOW.length],
      backgroundColor: 'transparent',
      tension: 0.2,
      pointRadius: 2,
      borderWidth: 2,
      spanGaps: false
    });
  }
  return { labels: dates, datasets: datasets };
}

// Heaviest set per day
function buildHeaviestData(filter) {
  var filtered = filter === 'all' ? workouts.slice() : workouts.filter(function(w) { return w.exercise === filter; });
  filtered.sort(function(a,b) { return a.date.localeCompare(b.date); });

  var dates = [];
  var seenDates = {};
  filtered.forEach(function(w) {
    if (!seenDates[w.date]) { seenDates[w.date] = true; dates.push(w.date); }
  });

  var data = dates.map(function(d) {
    var dayWorkouts = filtered.filter(function(w) { return w.date === d; });
    var maxW = 0;
    dayWorkouts.forEach(function(w) {
      w.sets.forEach(function(s) { if (s.weight > maxW) maxW = s.weight; });
    });
    return maxW || null;
  });

  return { labels: dates, data: data };
}

// Frequency
function buildFreqData(filter) {
  var filtered = filter === 'all' ? workouts.slice() : workouts.filter(function(w) { return w.exercise === filter; });
  var freqMap = {};
  filtered.forEach(function(w) { freqMap[w.date] = (freqMap[w.date]||0)+1; });
  var labels = Object.keys(freqMap).sort();
  var data = labels.map(function(d) { return freqMap[d]; });
  return { labels: labels, data: data };
}

// ========== CHART OPTIONS ==========
  // Global plugin: draws border labels and colored grid lines for all charts
function chartOpts(showLegend, labels) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: !!showLegend, position: 'top', labels: { color: '#999', font: { size: 10 }, boxWidth: 12, padding: 8 } }
      },
      scales: {
        x: {
          ticks: {
            color: function(ctx) {
              if (!ctx.chart) return '#999';
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : 0;
              var dl = ctx.chart.data.labels;
              if (!dl || idx >= dl.length) return '#999';
              if (idx === 0) return '#e84393';
              var p0 = String(dl[Math.max(0,idx-1)]).split('-');
              var p1 = String(dl[idx]).split('-');
              if (p1.length < 3) return '#999';
              return (p0[0] !== p1[0] || p0[1] !== p1[1]) ? '#e84393' : '#999';
            },
            font: function(ctx) {
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : 0;
              if (!ctx.chart) return { size: 9 };
              var dl = ctx.chart.data.labels;
              if (!dl || idx >= dl.length) return { size: 9 };
              if (idx === 0) return { size: 9, weight: 'bold' };
              var p0 = String(dl[Math.max(0,idx-1)]).split('-');
              var p1 = String(dl[idx]).split('-');
              var isBnd = (p0[0] !== p1[0] || p0[1] !== p1[1]);
              return { size: 9, weight: isBnd ? 'bold' : 'normal' };
            },
            maxRotation: 35,
            autoSkip: true,
            callback: function(val, index, ticks) {
              var label = this.getLabelForValue(val);
              if (!label) return '';
              var p = label.split('-');
              if (p.length < 3) return label;
              var yr = p[0], mo = parseInt(p[1]), dy = parseInt(p[2]);
              var pY = '', pM = '';
              if (index > 0 && ticks[index-1]) {
                var pl = this.getLabelForValue(ticks[index-1].value);
                if (pl) { var pp = pl.split('-'); pY = pp[0]; pM = pp[1]; }
              }
              if (index === 0 || pY !== yr) return "'" + yr.slice(2) + '/' + mo + '/' + dy;
              if (pM !== p[1]) return mo + '/' + dy;
              return String(dy);
            }
          },
          grid: {
            color: function(ctx) {
              if (!ctx.chart) return '#2a2a2a';
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : -1;
              var dl = ctx.chart.data.labels;
              if (idx < 0 || !dl || idx >= dl.length) return '#2a2a2a';
              if (idx === 0) return '#e84393';
              var p0 = String(dl[idx-1]).split('-');
              var p1 = String(dl[idx]).split('-');
              if (p1.length < 3) return '#2a2a2a';
              return (p0[0] !== p1[0] || p0[1] !== p1[1]) ? '#e84393' : '#2a2a2a';
            },
            lineWidth: function(ctx) {
              if (!ctx.chart) return 1;
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : -1;
              var dl = ctx.chart.data.labels;
              if (idx < 0 || !dl || idx >= dl.length) return 1;
              if (idx === 0) return 2;
              var p0 = String(dl[idx-1]).split('-');
              var p1 = String(dl[idx]).split('-');
              return (p0[0] !== p1[0] || p0[1] !== p1[1]) ? 2 : 1;
            }
          }
        },
        y: { ticks: { color: '#999', font: { size: 10 } }, grid: { color: '#2a2a2a' }, beginAtZero: false, title: { display: false, text: 'kg', color: '#999' } }
      }
    };
  }


function renderCharts() {
  destroyCharts();
  if (typeof Chart === 'undefined') return;

  var setData = buildSetData(chartFilterEx);
  var heaviestData = buildHeaviestData(chartFilterEx);
  var freqData = buildFreqData(chartFilterEx);

  var hasData = setData.labels.length > 0;

  var containers = document.querySelectorAll('#panel-charts .chart-container canvas');
  containers.forEach(function(c) { c.style.display = hasData ? '' : 'none'; });

  if (!hasData) {
    document.getElementById('setTabs').innerHTML = '';
    return;
  }

// === WEIGHT CHART with set filter ===
  var datasetsToShow;
  if (setFilterMode === 'all') {
    datasetsToShow = setData.datasets;
  } else {
    var si = parseInt(setFilterMode);
    if (si >= 0 && si < setData.datasets.length) {
      datasetsToShow = [setData.datasets[si]];
    } else {
      datasetsToShow = [];
    }
  }

  totalLabels1 = setData.labels.length;
  var wStart = pan1;
  var wEnd = Math.min(pan1 + zoom1, setData.labels.length);
  var wLabels = setData.labels.slice(wStart, wEnd);
  var wDatasets = datasetsToShow.map(function(ds) {
    return {
      setIndex: ds.setIndex,
      label: ds.label,
      data: ds.data.slice(wStart, wEnd),
      borderColor: ds.borderColor,
      backgroundColor: ds.backgroundColor,
      tension: ds.tension,
      pointRadius: ds.pointRadius,
      borderWidth: ds.borderWidth,
      spanGaps: ds.spanGaps
    };
  });

  chartWeightInst = new Chart(document.getElementById('chartWeight').getContext('2d'), {
    type: 'line',
    data: { labels: wLabels, datasets: wDatasets },
    options: chartOpts(setFilterMode === 'all' && wDatasets.length > 1, wLabels)
  });

  // === HEAVIEST SET CHART ===
  totalLabels2 = heaviestData.labels.length;
  var hStart = pan2;
  var hEnd = Math.min(pan2 + zoom2, heaviestData.labels.length);
  var hLabels = heaviestData.labels.slice(hStart, hEnd);
  var hData = heaviestData.data.slice(hStart, hEnd);

  chartVolumeInst = new Chart(document.getElementById('chartVolume').getContext('2d'), {
    type: 'line',
    data: { labels: hLabels, datasets: [{ data: hData, borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#ff6b35', borderWidth: 2 }] },
    options: chartOpts(false, hLabels)
  });

  // === FREQUENCY CHART ===
  var freqOpts = chartOpts(false, fLabels);
  freqOpts.scales.y.beginAtZero = true;
  freqOpts.scales.y.ticks = { stepSize: 1, color: '#999' };
  freqOpts.scales.y.title = { display: true, text: '\u6b21', color: '#999' };
  totalLabels3 = freqData.labels.length;
  var fStart = pan3;
  var fEnd = Math.min(pan3 + zoom3, freqData.labels.length);
  var fLabels = freqData.labels.slice(fStart, fEnd);
  var fData = freqData.data.slice(fStart, fEnd);

  chartFreqInst = new Chart(document.getElementById('chartFreq').getContext('2d'), {
    type: 'bar',
    data: { labels: fLabels, datasets: [{ data: fData, backgroundColor: 'rgba(241,196,15,0.6)', borderColor: '#f1c40f', borderWidth: 1, borderRadius: 4 }] },
    options: freqOpts
  });

  // === SYNC SLIDER ===
  syncSliders();
  attachWheelListeners();
  attachPinchListeners();
    // === RENDER FILTERS ===
  renderChartFilter();
// Set filter tabs
  var stHtml = '<span class="preset-chip ' + (setFilterMode==='all'?'selected':'') + '" onclick="setFilterMode=\'all\';renderCharts();">\u5168\u90e8\u7ec4</span>';
  for (var si = 0; si < setData.datasets.length; si++) {
    stHtml += '<span class="preset-chip ' + (setFilterMode===String(si)?'selected':'') + '" onclick="setFilterMode=\'' + si + '\';renderCharts();">' + setData.datasets[si].label + '</span>';
  }
  document.getElementById('setTabs').innerHTML = stHtml;
}

// ========== HISTORY ==========
function renderHistory() {
  var search = (document.getElementById('historySearch').value || '').toLowerCase();
  var filtered = workouts.filter(function(w) { return !search || w.exercise.toLowerCase().indexOf(search) >= 0 || w.date.indexOf(search) >= 0; });
  filtered.sort(function(a,b) { return b.date.localeCompare(a.date); });

  var el = document.getElementById('historyList');
  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128236;</div><p>\u6682\u65e0\u8bad\u7ec3\u8bb0\u5f55</p></div>';
    return;
  }

  // Group by year, then by month
  var years = {};
  filtered.forEach(function(w) {
    var yKey = w.date.substring(0, 4);
    var mKey = w.date.substring(0, 7);
    if (!years[yKey]) years[yKey] = {};
    if (!years[yKey][mKey]) years[yKey][mKey] = [];
    years[yKey][mKey].push(w);
  });

  var monthNames = ['1\u6708','2\u6708','3\u6708','4\u6708','5\u6708','6\u6708','7\u6708','8\u6708','9\u6708','10\u6708','11\u6708','12\u6708'];
  var yKeys = Object.keys(years).sort().reverse();
  var html = '';

  yKeys.forEach(function(yKey) {
    var months = years[yKey];
    var mKeys = Object.keys(months).sort().reverse();
    var yTotal = 0;
    mKeys.forEach(function(mKey) { yTotal += months[mKey].length; });

    var yearExpanded = localStorage.getItem(HISTORY_YEAR_KEY) !== 'false';
    html += '<div class="year-group">' +
      '<div class="year-header" onclick="toggleYear(this)" data-year="' + yKey + '">' +
        '<span class="year-toggle">' + (yearExpanded ? '\u25bc' : '\u25b6') + '</span>' +
        '<span class="year-label">' + yKey + '\u5e74</span>' +
        '<span class="year-count">' + yTotal + '\u6b21\u8bad\u7ec3</span>' +
      '</div>' +
      '<div class="year-body" data-year="' + yKey + '" style="display:' + (yearExpanded ? '' : 'none') + '">';

    mKeys.forEach(function(mKey) {
      var parts = mKey.split('-');
      var monthIdx = parseInt(parts[1]) - 1;
      var label = monthNames[monthIdx];
      var count = months[mKey].length;
      var totalSets = 0;
      months[mKey].forEach(function(w) { totalSets += w.sets.length; });

      var monthExpanded = localStorage.getItem(HISTORY_MONTH_KEY) === 'true';
      html += '<div class="month-group">' +
        '<div class="month-header" onclick="toggleMonth(this)" data-month="' + mKey + '">' +
          '<span class="month-toggle">' + (monthExpanded ? '\u25bc' : '\u25b6') + '</span>' +
          '<span class="month-label">' + label + '</span>' +
          '<span class="month-count">' + count + '\u6b21\u8bad\u7ec3 \u00b7 ' + totalSets + '\u7ec4</span>' +
        '</div>' +
        '<div class="month-body" data-month="' + mKey + '" style="display:' + (monthExpanded ? '' : 'none') + '">';

      months[mKey].forEach(function(w) {
        var maxW = 0, totalV = 0;
        w.sets.forEach(function(s) { if (s.weight > maxW) maxW = s.weight; totalV += s.weight * s.reps; });
        html += '<div class="workout-item">' +
          '<div class="wo-date">' + w.date + '</div>' +
          '<div class="wo-exercise">' + w.exercise + '</div>' +
          '<div class="wo-sets">' + w.sets.length + '\u7ec4 | \u6700\u5927 ' + maxW + 'kg | \u603b\u91cf ' + totalV + 'kg</div>' +
          '<div class="wo-sets">' + w.sets.map(function(s,i) { return '#' + (i+1) + ': ' + s.weight + 'kg \u00d7 ' + s.reps + '\u6b21'; }).join(' | ') + '</div>' +
          '<div class="wo-actions">' +
            '<button class="btn btn-outline btn-sm" type="button" data-edit="' + w.id + '" onclick="openEditModal(this.getAttribute(\x27data-edit\x27))">\u7f16\u8f91</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-del="' + w.id + '" onclick="deleteWorkout(this.getAttribute(\x27data-del\x27))">\u5220\u9664</button>' +
          '</div></div>';
      });

      html += '</div></div>';
    });

    html += '</div></div>';
  });

  el.innerHTML = html;
}function toggleYear(header) {
  var yKey = header.getAttribute('data-year');
  var body = document.querySelector('.year-body[data-year="' + yKey + '"]');
  var toggle = header.querySelector('.year-toggle');
  if (body.style.display === 'none') {
    body.style.display = '';
    toggle.textContent = '\u25bc';
  } else {
    body.style.display = 'none';
    toggle.textContent = '\u25b6';
  }
}

function toggleMonth(header) {
  var mKey = header.getAttribute('data-month');
  var body = document.querySelector('.month-body[data-month="' + mKey + '"]');
  var toggle = header.querySelector('.month-toggle');
  if (body.style.display === 'none') {
    body.style.display = '';
    toggle.textContent = '\u25bc';
  } else {
    body.style.display = 'none';
    toggle.textContent = '\u25b6';
  }
}

// ========== EDIT / DELETE ==========
function openEditModal(id) {
  var found = null;
  workouts.forEach(function(w) { if (w.id === id) found = w; });
  if (!found) return;
  document.getElementById('editId').value = found.id;
  document.getElementById('editDate').value = found.date;
  document.getElementById('editExercise').value = found.exercise;
  var container = document.getElementById('editSetsContainer');
  container.innerHTML = '';
  var inc = getIncrement();
  found.sets.forEach(function(s, i) {
    var div = document.createElement('div');
    div.className = 'set-row';
    div.innerHTML =
      '<span class="set-num">#' + (i+1) + '</span>' +
      '<div class="set-input-wrap" style="flex:1"><input type="number" value="' + s.weight + '" step="0.5" min="0" class="set-weight"><span class="set-unit">kg</span></div>' +
      '<div class="wadj-stack"><button class="btn-wadj-up" type="button" onclick="adjWeight(this,1)">\u25b2</button><button class="btn-wadj-down" type="button" onclick="adjWeight(this,-1)">\u25bc</button></div>' +
      '<span class="set-label" style="margin:0 2px">\u00d7</span>' +
      '<div class="set-input-wrap" style="flex:0.8"><input type="number" value="' + s.reps + '" step="1" min="0" class="set-reps"><span class="set-unit">\u6b21</span></div>' +
      '<div class="rep-menu-wrap"><button class="btn-rep-menu" type="button" onclick="toggleRepMenu(this)" title="\u5feb\u6377\u6b21\u6570">\u2261</button><div class="rep-menu-drop"><span class="rep-chip" onclick="setRep(this,4)">4</span><span class="rep-chip" onclick="setRep(this,8)">8</span><span class="rep-chip" onclick="setRep(this,12)">12</span></div></div>' +
    '<div class="radj-stack"><button class="btn-radj-up" type="button" onclick="adjRep(this,1)">\u25b2</button><button class="btn-radj-down" type="button" onclick="adjRep(this,-1)">\u25bc</button></div>' +
      '<button class="btn btn-danger btn-sm btn-icon" type="button" onclick="this.closest(\x27.set-row\x27).remove();renumberSets(\x27editSetsContainer\x27)">x</button>';
    container.appendChild(div);
  });
  document.getElementById('editModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
function addEditSet() {
  var container = document.getElementById('editSetsContainer');
  var idx = container.children.length + 1;
  var inc = getIncrement();
  var lastWeight = '';
  var lastReps = '';
  var rows = container.querySelectorAll('.set-row');
  if (rows.length > 0) {
    var lastW = rows[rows.length-1].querySelector('.set-weight');
    var lastR = rows[rows.length-1].querySelector('.set-reps');
    lastWeight = lastW ? (lastW.value || '') : '';
    lastReps = lastR ? (lastR.value || '') : '';
  }
  var div = document.createElement('div');
  div.className = 'set-row';
  div.innerHTML =
    '<span class="set-num">#' + idx + '</span>' +
    '<div class="set-input-wrap" style="flex:1"><input type="number" placeholder="0" step="0.5" min="0" class="set-weight" value="' + lastWeight + '"><span class="set-unit">kg</span></div>' +
    '<div class="wadj-stack"><button class="btn-wadj-up" type="button" onclick="adjWeight(this,1)">\u25b2</button><button class="btn-wadj-down" type="button" onclick="adjWeight(this,-1)">\u25bc</button></div>' +
    '<span class="set-label" style="margin:0 2px">\u00d7</span>' +
    '<div class="set-input-wrap" style="flex:0.8"><input type="number" placeholder="0" step="1" min="0" class="set-reps" value="' + lastReps + '"><span class="set-unit">\u6b21</span></div>' +
    '<div class="rep-menu-wrap"><button class="btn-rep-menu" type="button" onclick="toggleRepMenu(this)" title="\u5feb\u6377\u6b21\u6570">\u2261</button><div class="rep-menu-drop"><span class="rep-chip" onclick="setRep(this,4)">4</span><span class="rep-chip" onclick="setRep(this,8)">8</span><span class="rep-chip" onclick="setRep(this,12)">12</span></div></div>' +
    '<div class="radj-stack"><button class="btn-radj-up" type="button" onclick="adjRep(this,1)">\u25b2</button><button class="btn-radj-down" type="button" onclick="adjRep(this,-1)">\u25bc</button></div>' +
    '<button class="btn btn-danger btn-sm btn-icon" type="button" onclick="this.closest(\x27.set-row\x27).remove();renumberSets(\x27editSetsContainer\x27)">x</button>';
  container.appendChild(div);
}
function saveEdit() {
  var id = document.getElementById('editId').value;
  var found = null;
  workouts.forEach(function(w) { if (w.id === id) found = w; });
  if (!found) return;
  var exercise = document.getElementById('editExercise').value.trim();
  if (!exercise) { showToast('\u8bf7\u8f93\u5165\u8bad\u7ec3\u9879\u76ee'); return; }
  var sets = getSetsFromContainer('editSetsContainer');
  if (sets.length === 0) { showToast('\u8bf7\u81f3\u5c11\u6dfb\u52a0\u4e00\u7ec4'); return; }
  found.date = document.getElementById('editDate').value;
  found.exercise = exercise;
  found.sets = sets;
  saveData();
  console.log('Saved workout, date is now: ' + document.getElementById('recDate').value);
  closeEditModal();
  showToast('\u5df2\u66f4\u65b0');
  refreshAll();
}
function deleteEdit() {
  if (!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u8bb0\u5f55\uff1f')) return;
  var id = document.getElementById('editId').value;
  workouts = workouts.filter(function(w) { return w.id !== id; });
  saveData();
  console.log('Saved workout, date is now: ' + document.getElementById('recDate').value);
  closeEditModal();
  showToast('\u5df2\u5220\u9664');
  refreshAll();
}
function deleteWorkout(id) {
  if (!confirm('\u786e\u5b9a\u5220\u9664\uff1f')) return;
  workouts = workouts.filter(function(w) { return w.id !== id; });
  saveData();
  console.log('Saved workout, date is now: ' + document.getElementById('recDate').value);
  showToast('\u5df2\u5220\u9664');
  refreshAll();
}
function refreshAll() {
  if (currentTab === 'history') renderHistory();
  if (currentTab === 'record') renderStats();
  if (currentTab === 'charts') renderCharts();
}

// ========== DEBUG DATA GENERATOR ==========
function generateDebugData() {
  // Backup user data
  localStorage.setItem('fitlog_user_backup', JSON.stringify(workouts));
  localStorage.setItem('fitlog_freq_backup', JSON.stringify(exerciseFreq));
  localStorage.setItem('fitlog_debug_mode', '1');
  
  workouts = [];
  exerciseFreq = {};
  var startDate = new Date(2004, 4, 2); // May 2, 2004
  var endDate = new Date(2007, 4, 2);   // May 2, 2007
  var weights = [];
  for (var w = 10; w <= 200; w += 10) weights.push(w);
  var wi = 0;
  var d = new Date(startDate);
  while (d < endDate) {
    var dateStr = d.toISOString().split('T')[0];
    var kg = weights[wi % weights.length];
    workouts.push({
      id: 'dbg' + dateStr,
      date: dateStr,
      exercise: '\u5e73\u677f\u5367\u63a8',
      sets: [
        { weight: kg, reps: 8 },
        { weight: kg, reps: 8 },
        { weight: kg, reps: 6 }
      ]
    });
    trackExercise('\u5e73\u677f\u5367\u63a8');
    wi++;
    d.setDate(d.getDate() + 1);
  }
  saveData();
  saveFreq();
  showToast('\u5df2\u751f\u6210 ' + workouts.length + ' \u6761\u8c03\u8bd5\u8bb0\u5f55');
  renderSettingsPage();
  switchTab('record');
  renderStats();
  renderPresets();
}

function exitDebugMode() {
  localStorage.removeItem('fitlog_debug_mode');
  var backup = localStorage.getItem('fitlog_user_backup');
  workouts = backup ? JSON.parse(backup) : []; saveData();
  var freqBackup = localStorage.getItem('fitlog_freq_backup');
  exerciseFreq = freqBackup ? JSON.parse(freqBackup) : {}; saveFreq();
  localStorage.removeItem('fitlog_user_backup');
  localStorage.removeItem('fitlog_freq_backup');
  showToast('\u5df2\u9000\u51fa\u8c03\u8bd5\uff0c\u6062\u590d\u7528\u6237\u6570\u636e');
  renderSettingsPage();
  switchTab('record');
  renderStats();
  renderPresets();
  renderCharts();
  renderHistory();
}

function isDebugMode() {
  return localStorage.getItem('fitlog_debug_mode') === '1';
}


// ========== FULLSCREEN GALLERY ==========
var gallerySlide = 0;
var galleryCharts = [null, null, null];
var gZoom = [30, 30, 30];
var gPan = [0, 0, 0];
var gTotalLabels = [0, 0, 0];

function openGallery() {
  gallerySlide = 0;
  gZoom[0] = zoom1; gZoom[1] = zoom2; gZoom[2] = zoom3;
  gPan[0] = pan1; gPan[1] = pan2; gPan[2] = pan3;
  var el = document.getElementById('chartGallery');
  el.classList.add('open');
  updateGalleryDots();
  updateGallerySlide();
  renderAllGalleryCharts();
  attachGallerySwipe();
  // Lock landscape directly (works in PWA/standalone mode)
  var locked = false;
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').then(function() { locked = true; }).catch(function(){});
    }
  } catch(e) {}
  // Fallback: CSS rotate if orientation lock fails
  setTimeout(function() {
    if (!locked && !document.fullscreenElement) {
      el.classList.add('forced-landscape');
    }
  }, 500);
}

function closeGallery() {
  var el = document.getElementById('chartGallery');
  el.classList.remove('open');
  el.classList.remove('forced-landscape');
  galleryCharts.forEach(function(c, i) { if (c) { c.destroy(); galleryCharts[i] = null; } });
  try {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  } catch(e) {}
  renderCharts();
}

var galleryTitles = ['重量趋势', '当日最重组', '训练频次'];

function updateGalleryDots() {
  var dots = '';
  for (var i = 0; i < 3; i++) {
    dots += '<span class="gallery-dot' + (i === gallerySlide ? ' active' : '') + '"></span>';
  }
  document.getElementById('galleryDots').innerHTML = dots;
  document.getElementById('galleryTitle').textContent = galleryTitles[gallerySlide];
}

function updateGallerySlide() {
  var slides = document.getElementById('gallerySlides');
  slides.style.transform = 'translateX(-' + (gallerySlide * 100) + '%)';
  slides.style.transition = 'transform 0.3s ease';
  updateGalleryDots();
}

function goToGallerySlide(n) {
  if (n < 0 || n > 2) return;
  gallerySlide = n;
  updateGallerySlide();
  renderGalleryChart(n + 1);
}

function renderAllGalleryCharts() {
  for (var i = 1; i <= 3; i++) renderGalleryChart(i);
}

function renderGalleryChart(n) {
  var idx = n - 1;
  if (galleryCharts[idx]) galleryCharts[idx].destroy();
  
  var setData = buildSetData(chartFilterEx);
  var heaviestData = buildHeaviestData(chartFilterEx);
  var freqData = buildFreqData(chartFilterEx);
  
  var canvasId = 'galleryChart' + n;
  var sliderId = 'gallerySlider' + n;
  var labels, datasets, label;
  
  if (n === 1) {
    // Weight chart with set filter
    var datasetsToShow;
    if (setFilterMode === 'all') {
      datasetsToShow = setData.datasets;
    } else {
      var si = parseInt(setFilterMode);
      datasetsToShow = (si >= 0 && si < setData.datasets.length) ? [setData.datasets[si]] : [];
    }
    labels = setData.labels;
    datasets = datasetsToShow;
    gTotalLabels[idx] = labels.length;
    
    // Render set tabs in gallery
    var stHtml = '<span class="preset-chip ' + (setFilterMode==='all'?'selected':'') + '" onclick="setFilterMode=\'all\';renderAllGalleryCharts();">全部组</span>';
    if (setData.datasets) {
      setData.datasets.forEach(function(ds, si) {
        stHtml += '<span class="preset-chip ' + (setFilterMode===String(si)?'selected':'') + '" onclick="setFilterMode=\'' + si + '\';renderAllGalleryCharts();">' + ds.label + '</span>';
      });
    }
    document.getElementById('gallerySetTabs').innerHTML = stHtml;
    label = '重量 (kg)';
  } else if (n === 2) {
    labels = heaviestData.labels;
    datasets = heaviestData.datasets;
    gTotalLabels[idx] = labels.length;
    label = '最重 (kg)';
  } else {
    labels = freqData.labels;
    datasets = freqData.datasets;
    gTotalLabels[idx] = labels.length;
    label = '训练次数';
  }
  
  if (!labels || labels.length === 0) return;
  
  var zoom = gZoom[idx];
  var pan = gPan[idx];
  zoom = Math.min(zoom, gTotalLabels[idx]);
  if (pan + zoom > gTotalLabels[idx]) pan = Math.max(0, gTotalLabels[idx] - zoom);
  gZoom[idx] = zoom;
  gPan[idx] = pan;
  
  var end = Math.min(pan + zoom, labels.length);
  var slicedLabels = labels.slice(pan, end);
  var slicedDatasets = datasets.map(function(ds) {
    return Object.assign({}, ds, { data: ds.data.slice(pan, end) });
  });
  
  var ctx = document.getElementById(canvasId).getContext('2d');
  galleryCharts[idx] = new Chart(ctx, {
    type: 'line',
    data: { labels: slicedLabels, datasets: slicedDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: n === 1, labels: { color: '#999', usePointStyle: true, boxWidth: 8, padding: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#1a1a1a', titleColor: '#fff', bodyColor: '#ccc', borderColor: '#333', borderWidth: 1 }
      },
      scales: {
        x: {
          ticks: {
            color: function(ctx) {
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : 0;
              var dl = ctx.chart.data.labels;
              if (!dl || idx >= dl.length) return '#999';
              if (idx === 0) return '#e84393';
              var p0 = String(dl[Math.max(0,idx-1)]).split('-');
              var p1 = String(dl[idx]).split('-');
              return (p0[0] !== p1[0] || p0[1] !== p1[1]) ? '#e84393' : '#999';
            },
            font: function(ctx) {
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : 0;
              var dl = ctx.chart.data.labels;
              if (!dl || idx >= dl.length) return { size: 10 };
              if (idx === 0) return { size: 10, weight: 'bold' };
              var p0 = String(dl[Math.max(0,idx-1)]).split('-');
              var p1 = String(dl[idx]).split('-');
              return { size: 10, weight: (p0[0] !== p1[0] || p0[1] !== p1[1]) ? 'bold' : 'normal' };
            },
            maxRotation: 35,
            autoSkip: true,
            callback: function(val, index, ticks) {
              var label = this.getLabelForValue(val);
              if (!label) return '';
              var p = label.split('-');
              if (p.length < 3) return label;
              var yr = p[0], mo = parseInt(p[1]), dy = parseInt(p[2]);
              var pY = '', pM = '';
              if (index > 0 && ticks[index-1]) {
                var pl = this.getLabelForValue(ticks[index-1].value);
                if (pl) { var pp = pl.split('-'); pY = pp[0]; pM = pp[1]; }
              }
              if (index === 0 || pY !== yr) return "'" + yr.slice(2) + '/' + mo + '/' + dy;
              if (pM !== p[1]) return mo + '/' + dy;
              return String(dy);
            }
          },
          grid: {
            color: function(ctx) {
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : -1;
              var dl = ctx.chart.data.labels;
              if (idx < 0 || !dl || idx >= dl.length) return '#2a2a2a';
              if (idx === 0) return '#e84393';
              var p0 = String(dl[idx-1]).split('-');
              var p1 = String(dl[idx]).split('-');
              return (p0[0] !== p1[0] || p0[1] !== p1[1]) ? '#e84393' : '#2a2a2a';
            },
            lineWidth: function(ctx) {
              var idx = typeof ctx.index !== 'undefined' ? ctx.index : -1;
              var dl = ctx.chart.data.labels;
              if (idx < 0 || !dl || idx >= dl.length) return 1;
              if (idx === 0) return 2;
              var p0 = String(dl[idx-1]).split('-');
              var p1 = String(dl[idx]).split('-');
              return (p0[0] !== p1[0] || p0[1] !== p1[1]) ? 2 : 1;
            }
          }
        },
        y: { ticks: { color: '#999', font: { size: 11 } }, grid: { color: '#2a2a2a' }, beginAtZero: false, title: { display: true, text: label, color: '#999' } }
      }
    }
  });
  
  // Update slider
  var sl = document.getElementById(sliderId);
  sl.min = 0;
  sl.max = Math.max(0, gTotalLabels[idx] - zoom);
  sl.value = pan;
  
  // Attach pinch zoom to gallery canvas
  attachGalleryPinch(n);
  attachGalleryWheel(n);
}

function attachGalleryPinch(n) {
  var canvas = document.getElementById('galleryChart' + n);
  if (!canvas || typeof Hammer === 'undefined') return;
  try {
    var mc = new Hammer.Manager(canvas, { touchAction: 'none' });
    mc.add(new Hammer.Pinch());
    var idx = n - 1;
    var lastScale = 1;
    var startZoom = gZoom[idx];
    mc.on('pinchstart', function(e) {
      startZoom = gZoom[idx];
      lastScale = e.scale;
    });
    mc.on('pinchmove', function(e) {
      var delta = Math.round((lastScale - e.scale) * 10);
      if (delta !== 0) {
        var newZoom = Math.max(1, Math.min(90, startZoom + delta));
        lastScale = e.scale;
        if (newZoom !== gZoom[idx]) {
          gZoom[idx] = newZoom;
          renderGalleryChart(n);
        }
      }
    });
  } catch(e) { console.log('Gallery pinch error:', e); }
}

function attachGalleryWheel(n) {
  var canvas = document.getElementById('galleryChart' + n);
  if (!canvas) return;
  var idx = n - 1;
  canvas.onwheel = function(e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? 2 : -2;
    gZoom[idx] = Math.max(1, Math.min(90, gZoom[idx] + delta));
    renderGalleryChart(n);
  };
}

function onGallerySlider(n) {
  var idx = n - 1;
  var sl = document.getElementById('gallerySlider' + n);
  gPan[idx] = parseInt(sl.value);
  renderGalleryChart(n);
}

function attachGallerySwipe() {
  var slides = document.getElementById('gallerySlides');
  if (typeof Hammer === 'undefined') return;
  try {
    var mc = new Hammer.Manager(slides, { touchAction: 'none' });
    var pan = new Hammer.Pan({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 15 });
    var pinch = new Hammer.Pinch();
    mc.add([pan, pinch]);
    pan.recognizeWith(pinch);
    var panDeltaX = 0;
    mc.on('panstart', function() { panDeltaX = 0; });
    mc.on('panmove', function(e) { panDeltaX = e.deltaX; });
    mc.on('panend', function() {
      if (panDeltaX < -60) goToGallerySlide(gallerySlide + 1);
      else if (panDeltaX > 60) goToGallerySlide(gallerySlide - 1);
    });
    var psZoom = 1, psLast = 1;
    mc.on('pinchstart', function(e) { psZoom = gZoom[gallerySlide]; psLast = e.scale; });
    mc.on('pinchmove', function(e) {
      var d = Math.round((psLast - e.scale) * 10);
      if (d !== 0) { var nz = Math.max(1, Math.min(90, psZoom + d)); psLast = e.scale; if (nz !== gZoom[gallerySlide]) { gZoom[gallerySlide] = nz; renderGalleryChart(gallerySlide + 1); } }
    });
  } catch(e) { console.log('Gallery swipe error:', e); }
}

// ========== STARTUP ==========
loadTheme();
init();
