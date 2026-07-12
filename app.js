
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
  '胸': ['自由卧推', '史密斯平板卧推', '上斜卧推', '下斜卧推', '绳索夹胸', '双杠臂屈伸', '器械平板卧推', '哑铃平板卧推', '蝴蝶机夹胸', '俯卧撑', '史密斯宽距卧推', '上斜哑铃推胸'],
  '背': ['高位下拉', '山羊挺身', '引体向上', '杠铃划船', '单臂哑铃划船', '坐姿划船', '面拉', '宽距引体', '窄距引体', '对握引体', 'T杠划船', '直臂下压', '单臂高位下拉', '鹦鹉螺', '大剪刀', 'T杠展背后束', '单臂前下拉'],
  '腿': ['深蹲', '硬拉', '腿举', '罗马尼亚硬拉', '坐姿腿弯举', '坐姿腿屈伸', '保加利亚分腿蹲', '臀推', '哈克机深蹲', '单腿硬拉', '史密斯深蹲', '躺腿弯举'],
  '肩': ['坐姿哑铃推肩', '侧平举', '前平举', '面拉', '阿诺德推举', '直立划船', '器械推肩', '实力举', '绳索侧平举', '反向飞鸟', '哑铃飞鸟', '反向蝴蝶机', '器械侧平举'],
  '手臂': ['二头弯举', '三头下压', '杠铃弯举', '锤式弯举', '绳索下压', '窄距卧推', '牧师凳弯举', '正握弯举', '器械二头弯举', '二十一响炮', '站立臂屈伸', '哑铃弯举', '臂屈伸', '三头组合技'],
  '臀': ['臀推', '保加利亚分腿蹲', '跪羊提腿', '臀桥', '坐姿髋外展', '大腿内侧内收', '挺臀'],
  '核心/腹部': ['龙门架卷腹', '悬垂举腿', '卷腹机', '肩胛俯卧撑']
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
var chartWeightInst = null, chartVolumeInst = null;
var chartFilterEx = 'all';
var chartExpandedCat = null;
var _cacheSetData = null, _cacheHeaviestData = null;


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
  if (tab === 'calendar') renderCalendar();
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

function importHistoryData() {
  if (typeof IMPORT_DATA === 'undefined') {
    alert('历史数据文件未加载，请刷新页面后重试');
    return;
  }
  if (!confirm('将导入 " + IMPORT_DATA.length + " 条历史记录。\\n已有记录不会被删除，重复日期+项目会追加。\\n确定继续？')) return;
  var existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  var merged = existing.concat(IMPORT_DATA);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  workouts = merged;
  renderStats();
  renderPresets();
  updateCharts();
  alert('已导入 ' + IMPORT_DATA.length + ' 条记录！');
  renderSettingsPage();
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
  else if (name === 'importHistory') {
    var html = '<div class="settings-back" onclick="renderSettingsPage()">‹ 返回设置</div>';
    html += '<div class="card"><div class="card-title">导入历史数据</div>';
    html += '<p style="font-size:13px;color:var(--text2);margin-bottom:16px">将 2024~2026 年笔记记录（706条）导入到软件。已有记录不会被删除。</p>';
    html += '<button class="btn btn-primary btn-block" type="button" onclick="importHistoryData()">导入 706 条历史记录</button>';
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
var chartWeightInst = null, chartVolumeInst = null;
var chartFilterEx = 'all';
var chartExpandedCat = null;
var _cacheSetData = null, _cacheHeaviestData = null;
var setFilterMode = 'all'; // 'all' or set index 0,1,2...

var RAINBOW = [
  '#ff4444','#ff8c00','#ffd700','#2ecc71','#3498db','#8b5cf6','#e056a0',
  '#ff6b6b','#f0a500','#c9e265','#1abc9c','#5dade2','#af7ac5','#f06292'
];

var pan1 = 0, zoom1 = 30;
var pan2 = 0, zoom2 = 30;
var totalLabels1 = 0, totalLabels2 = 0;

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
}

function onSliderChange() { pan1 = parseInt(document.getElementById('chartSlider').value); updateChart1(); }
function onSliderChange2() { pan2 = parseInt(document.getElementById('chartSlider2').value); updateChart2(); }


// Attach wheel listeners to chart canvases
// Pinch zoom for touch devices
var pinchStates = { 1: { lastScale: 1, startZoom: 1 }, 2: { lastScale: 1, startZoom: 1 }, 3: { lastScale: 1, startZoom: 1 } };
function attachPinchListeners() {
  var ids = ['chartWeight', 'chartVolume'];
  ids.forEach(function(id, idx) {
    var cn = idx + 1;
    var canvas = document.getElementById(id);
    if (!canvas) return;
    if (typeof Hammer !== 'undefined') {
      var mc = new Hammer.Manager(canvas, { touchAction: "none" }); mc.add(new Hammer.Pinch());
      
      mc.on('pinchstart', function(e) {
        e.preventDefault();
        pinchStates[cn].startZoom = cn === 1 ? zoom1 : zoom2;
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
  if (!chartWeightInst || !_cacheSetData) return;
  var setData = _cacheSetData;
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
  chartWeightInst.update('none');
  var s1 = document.getElementById('chartSlider');
  s1.min = 0; s1.max = Math.max(0, totalLabels1 - zoom1); s1.value = pan1;
}

function updateChart2() {
  if (!chartVolumeInst || !_cacheHeaviestData) return;
  var heaviestData = _cacheHeaviestData;
  totalLabels2 = heaviestData.labels.length;
  zoom2 = Math.min(zoom2, totalLabels2);
  if (pan2 + zoom2 > totalLabels2) pan2 = Math.max(0, totalLabels2 - zoom2);
  var hStart = pan2;
  var hEnd = Math.min(pan2 + zoom2, totalLabels2);
  chartVolumeInst.data.labels = heaviestData.labels.slice(hStart, hEnd);
  chartVolumeInst.data.datasets[0].data = heaviestData.data.slice(hStart, hEnd);
  chartVolumeInst.update('none');
  var s2 = document.getElementById('chartSlider2');
  s2.min = 0; s2.max = Math.max(0, totalLabels2 - zoom2); s2.value = pan2;
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



// ========== CHART OPTIONS ==========
  // Global plugin: draws border labels and colored grid lines for all charts
function chartOpts(showLegend, labels) {
    return {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: !!showLegend, position: 'top', labels: { color: '#999', font: { size: 10 }, boxWidth: 12, padding: 8 } }
      },
      scales: {
x: { ticks: { color: '#999', font: { size: 10 } }, grid: { color: '#2a2a2a' }, beginAtZero: false, title: { display: false, text: '', color: '#999' } },
        y: {
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
              if (index === 0 || pY !== yr) return '' + yr.slice(2) + '/' + mo + '/' + dy;
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
        }
      }
    };
  }


function renderCharts() {
  destroyCharts();
  if (typeof Chart === 'undefined') return;

  var setData = buildSetData(chartFilterEx);
  var heaviestData = buildHeaviestData(chartFilterEx);
  _cacheSetData = setData;
  _cacheHeaviestData = heaviestData;

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


// ========== CALENDAR ==========
var calYear, calMonth;
function renderCalendar() {
  var now = new Date();
  if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  
  var trainDates = {};
  workouts.forEach(function(w) { trainDates[w.date] = true; });
  
  var monthLabel = calYear + '年 ' + (calMonth + 1) + '月';
  document.getElementById('calMonthLabel').textContent = monthLabel;
  
  // Count training days this month
  var trainCount = 0;
  Object.keys(trainDates).forEach(function(d) {
    var parts = d.split('-');
    if (parseInt(parts[0]) === calYear && parseInt(parts[1]) === calMonth + 1) trainCount++;
  });
  document.getElementById('calTrainDays').textContent = '本月训练 ' + trainCount + ' 天';
  
  // Build grid
  var firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  
  var dayHeaders = ['日','一','二','三','四','五','六'];
  var html = '';
  dayHeaders.forEach(function(d) {
    html += '<div class="cal-day-header">' + d + '</div>';
  });
  
  // Empty cells before first day
  for (var i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }
  
  var today = dateKey(now);
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var isTrain = trainDates[dateStr];
    var isToday = dateStr === today;
    var cls = 'cal-day' + (isToday ? ' today' : '');
    html += '<div class="' + cls + '" onclick="goToDay('' + dateStr + '')">' + d;
    if (isTrain) html += '<span class="cal-dot"></span>';
    html += '</div>';
  }
  
  document.getElementById('calendarGrid').innerHTML = html;
}
function calendarPrevMonth() {
  if (calMonth === 0) { calYear--; calMonth = 11; }
  else calMonth--;
  renderCalendar();
}
function calendarNextMonth() {
  if (calMonth === 11) { calYear++; calMonth = 0; }
  else calMonth++;
  renderCalendar();
}
function goToDay(dateStr) {
  // Switch to history and filter by that date
  switchTab('history');
  setTimeout(function() {
    document.getElementById('histSearch').value = dateStr;
    renderHistory();
  }, 100);
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



// ========== STARTUP ==========
loadTheme();
init();
