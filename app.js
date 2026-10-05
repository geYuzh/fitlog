
// ========== DATA STORE ==========
var STORAGE_KEY = 'fitlog_workouts';
var CATEGORY_KEY = 'fitlog_categories';
var FREQ_KEY = 'fitlog_freq';
var INCREMENT_KEY = 'fitlog_increment';
var DEFAULT_CAT_KEY = 'fitlog_default_categories';
var HISTORY_YEAR_KEY = 'fitlog_history_year_expand';
var HISTORY_MONTH_KEY = 'fitlog_history_month_expand';
var workouts = [];
var recordUnit = 'kg';
var LB_TO_KG = 0.45359237;
function cleanWeight(value) { return Number(value.toFixed(8)); }
function weightToKg(value, unit) { return cleanWeight(unit === 'lb' ? value * LB_TO_KG : value); }
function weightFromKg(value, unit) { return unit === 'lb' ? value / LB_TO_KG : value; }
function inputWeightKg(input, unit) {
  return input.dataset.unitValue === input.value ? Number(input.dataset.kg) : weightToKg(Number(input.value), unit);
}
function displayInputWeight(input, kg, unit) {
  input.value = String(Number(weightFromKg(kg, unit).toFixed(6)));
  input.dataset.kg = String(cleanWeight(kg));
  input.dataset.unitValue = input.value;
}
function setRecordUnit(unit) {
  if (unit !== 'kg' && unit !== 'lb') return;
  if (unit !== recordUnit) {
    document.querySelectorAll('#setsContainer .set-weight').forEach(function(input) {
      if (input.value !== '') {
        displayInputWeight(input, inputWeightKg(input, recordUnit), unit);
      }
    });
  }
  recordUnit = unit;
  localStorage.setItem('fitlog_record_unit', unit);
  document.querySelectorAll('#setsContainer .set-weight + .set-unit').forEach(function(label) { label.textContent = unit; });
  document.getElementById('unitKg').setAttribute('aria-pressed', String(unit === 'kg'));
  document.getElementById('unitLb').setAttribute('aria-pressed', String(unit === 'lb'));
}

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
  if (!exerciseCategories || typeof exerciseCategories !== 'object' || Array.isArray(exerciseCategories)) {
    exerciseCategories = JSON.parse(JSON.stringify(defaultCategories));
  } else {
    // Saved categories are authoritative, including deletions and renames.
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
  // Event delegation for export/import buttons (bypasses innerHTML onclick issues)
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (el.id === 'btnExportData' || (el.closest && el.closest('#btnExportData'))) {
      e.preventDefault(); e.stopPropagation();
      exportData();
      return;
    }
    if (el.id === 'btnImportData' || (el.closest && el.closest('#btnImportData'))) {
      e.preventDefault(); e.stopPropagation();
      importData();
      return;
    }
  }, true);

  loadData();
  setTodayDate();
  initRecordForm();
  setRecordUnit(localStorage.getItem('fitlog_record_unit') === 'lb' ? 'lb' : 'kg');
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
  document.getElementById('recDate').value = dateKey(new Date());
}
function formatDate(d) {
  var m = d.getMonth()+1, day = d.getDate();
  var w = ['\u65e5','\u4e00','\u4e8c','\u4e09','\u56db','\u4e94','\u516d'];
  return m + '\u6708' + day + '\u65e5 \u5468' + w[d.getDay()];
}
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

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
  var start = dateKey(monday), end = dateKey(now);
  return new Set(workouts.filter(function(w) { return w.date >= start && w.date <= end; }).map(function(w) { return w.date; })).size;
}

// ========== RECORD FORM ==========
function initRecordForm() {
  document.getElementById('setsContainer').innerHTML = '';
  addSet();
}
function renderPresets() {
  var el = document.getElementById('exercisePresets'); el.replaceChildren();
  var freq = getFrequent(8);
  freq.forEach(function(name) {
    var button = document.createElement('button'); button.type = 'button'; button.className = 'preset-chip';
    button.textContent = name; button.setAttribute('data-ex', name); button.onclick = function() { selectPreset(button); }; el.appendChild(button);
  });
  if (!freq.length) { var hint = document.createElement('span'); hint.className = 'unit-hint'; hint.textContent = '记录训练后这里会出现常用项目'; el.appendChild(hint); }
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
  div.querySelector('.set-weight + .set-unit').textContent = recordUnit;
  if (lastW && lastWeight !== '') displayInputWeight(div.querySelector('.set-weight'), inputWeightKg(lastW, recordUnit), recordUnit);
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
  var unit = row.closest('#setsContainer') ? recordUnit : 'kg';
  var kg = inputWeightKg(input, unit);
  displayInputWeight(input, Math.max(0, cleanWeight(kg + getIncrement() * sign)), unit);
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
    if (containerId === 'setsContainer') {
      var input = row.querySelector('.set-weight');
      w = cleanWeight(inputWeightKg(input, recordUnit));
    }
    if (Number.isFinite(w) && w >= 0 && Number.isInteger(r) && r > 0) sets.push({ weight: w, reps: r });
  });
  return sets;
}

function saveWorkout() {
  var dateInput = document.getElementById('recDate');
  var date = dateInput.value;
  var exercise = document.getElementById('recExercise').value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('请选择训练日期'); return; }
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
var historyLabelScope = 'all';
function labelDialog(options) {
  return new Promise(function(resolve) {
    var previousFocus = document.activeElement;
    var overlay = document.createElement('div'); overlay.className = 'modal-overlay label-dialog-overlay';
    var dialog = document.createElement('div'); dialog.className = 'modal-sheet';
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'labelDialogTitle'); dialog.setAttribute('aria-describedby', 'labelDialogMessage');
    var title = document.createElement('h2'); title.id = 'labelDialogTitle'; title.className = 'card-title'; title.textContent = options.title;
    var message = document.createElement('p'); message.id = 'labelDialogMessage'; message.className = 'label-dialog-message'; message.textContent = options.message;
    dialog.append(title, message);
    var input;
    if (options.value !== undefined) {
      var group = document.createElement('div'); group.className = 'form-group';
      var label = document.createElement('label'); label.htmlFor = 'labelDialogInput'; label.textContent = '新名称';
      input = document.createElement('input'); input.id = 'labelDialogInput'; input.type = 'text'; input.value = options.value;
      group.append(label, input); dialog.appendChild(group);
    }
    var actions = document.createElement('div'); actions.className = 'label-dialog-actions';
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn-outline'; cancel.textContent = '取消';
    var accept = document.createElement('button'); accept.type = 'button'; accept.className = 'btn ' + (options.danger ? 'btn-danger' : 'btn-primary'); accept.textContent = options.accept || '保存名称';
    actions.append(cancel, accept); dialog.appendChild(actions); overlay.appendChild(dialog);
    var background = Array.from(document.body.children).filter(function(el) { return !el.inert; });
    background.forEach(function(el) { el.inert = true; });
    document.body.appendChild(overlay);
    function finish(value) {
      overlay.remove(); background.forEach(function(el) { el.inert = false; });
      if (previousFocus && previousFocus.isConnected) previousFocus.focus(); resolve(value);
    }
    cancel.onclick = function() { finish(null); };
    accept.onclick = function() { if (input && !input.value.trim()) { input.focus(); return; } finish(input ? input.value.trim() : true); };
    overlay.onclick = function(e) { if (e.target === overlay) finish(null); };
    dialog.onkeydown = function(e) {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      if (e.key === 'Enter' && e.target === input) { e.preventDefault(); accept.click(); }
      if (e.key === 'Tab') {
        var first = input || cancel, last = accept;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    (input || cancel).focus(); if (input) input.select();
  });
}
function isUnlabelled(workout) { return !getAllExercises().includes(workout.exercise); }
function escapeText(value) { return String(value).replace(/[&<>"']/g, function(c) { return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
function showUnlabelledRecords() { historyLabelScope = 'unlabelled'; switchTab('history'); }
function renderCategorySettings(panel) {
  panel.replaceChildren();
  function node(tag, className, text) { var el = document.createElement(tag); el.className = className || ''; if (text !== undefined) el.textContent = text; return el; }
  function button(text, action, danger) { var el = node('button', 'btn btn-sm ' + (danger ? 'btn-danger' : 'btn-outline'), text); el.type = 'button'; el.onclick = action; return el; }
  var back = button('‹ 返回设置', renderSettingsPage); panel.appendChild(back);
  var card = node('div', 'card'); card.appendChild(node('div', 'card-title', '管理训练项目标识')); panel.appendChild(card);
  Object.keys(exerciseCategories).forEach(function(cat) {
    var section = node('div', 'settings-cat');
    var header = node('div', 'settings-cat-header');
    var toggle = button((expandedCategories[cat] ? '▼ ' : '▶ ') + cat + ' (' + exerciseCategories[cat].length + ')', function() { expandedCategories[cat] = !expandedCategories[cat]; openSetting('categories'); });
    header.append(toggle, button('改名', function() { renameCategory(cat); }), button('删除分类', function() { deleteCategory(cat); }, true)); section.appendChild(header);
    if (expandedCategories[cat]) {
      exerciseCategories[cat].forEach(function(ex) {
        var row = node('div', 'settings-ex-row');
        var name = node('span', '', ex); var actions = node('div', 'label-actions');
        actions.append(button('改名', function() { renameExercise(cat, ex); }), button('删除', function() { deleteExercise(cat, ex); }, true));
        row.append(name, actions); section.appendChild(row);
      });
      var row = node('div', 'label-add-row'); var input = node('input'); input.id = 'newEx-' + cat; input.placeholder = '添加项目名称'; input.setAttribute('aria-label', cat + '新项目名称');
      row.append(input, button('+ 添加', function() { addExercise(cat); })); section.appendChild(row);
    }
    card.appendChild(section);
  });
  var newRow = node('div', 'label-add-row'); var newInput = node('input'); newInput.id = 'newCatName'; newInput.placeholder = '新分类名称'; newInput.setAttribute('aria-label', '新分类名称'); newRow.append(newInput, button('+ 新建分类', addCategory)); card.appendChild(newRow);
  var detached = workouts.filter(isUnlabelled); var area = node('div', 'card');
  area.appendChild(node('div', 'card-title', '无标识区 · ' + detached.length + ' 条记录'));
  area.appendChild(node('p', 'unit-hint', '记录保留原项目名称、日期和组数。重新添加同名项目标识后，会自动重新归类。'));
  var names = Array.from(new Set(detached.map(function(w) { return w.exercise; })));
  names.forEach(function(name) { area.appendChild(node('div', 'settings-ex-row', name + ' · ' + detached.filter(function(w) { return w.exercise === name; }).length + ' 条')); });
  area.appendChild(button('查看无标识记录', showUnlabelledRecords)); panel.appendChild(area);
  var actions = node('div', 'label-actions'); actions.append(button('恢复默认分类', resetCategories), button('设为默认分类', setAsDefault)); panel.appendChild(actions);
}

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
    renderCategorySettings(panel);
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
  else if (name === 'increment') { renderIncrementSetting(panel); }
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

  else if (name === 'transfer') {
    console.log('OPEN SETTING: transfer');

    var html = '<div class="settings-back" onclick="renderSettingsPage()">\u2039 \u8fd4\u56de\u8bbe\u7f6e</div>';
    html += '<div class="card"><div class="card-title">\u5bfc\u51fa / \u5bfc\u5165\u6570\u636e</div>';
    html += '<p style="font-size:13px;color:var(--text2);margin-bottom:20px">\u5c06\u6240\u6709\u8bad\u7ec3\u8bb0\u5f55\u3001\u5206\u7c7b\u8bbe\u7f6e\u5bfc\u51fa\u4e3a JSON \u6587\u4ef6\uff0c\u53ef\u5728\u65b0\u8bbe\u5907\u4e0a\u5bfc\u5165\u6062\u590d\u3002</p>';
    html += '<button class="btn btn-primary btn-block" type="button" id="btnExportData" onclick="exportData()" style="margin-bottom:12px">\u2b07 \u5bfc\u51fa\u5907\u4efd\u6587\u4ef6</button>';
    html += '<button class="btn btn-outline btn-block" type="button" id="btnImportData" onclick="importData()">\u2b06 \u4ece\u5907\u4efd\u6587\u4ef6\u5bfc\u5165</button>';
    if (window.Capacitor && window.Capacitor.getPlatform() === 'android') html += '<button class="btn btn-outline btn-block" type="button" onclick="exportData(\'share\')" style="margin-top:12px">分享备份 JSON 文件</button>';
    html += '<p style="font-size:11px;color:var(--text2);margin-top:16px">\u5bfc\u5165\u5c06\u66ff\u6362\u5f53\u524d\u6240\u6709\u8bb0\u5f55\uff0c\u5efa\u8bae\u5148\u5bfc\u51fa\u4e00\u4efd\u4ee5\u9632\u610f\u5916\u3002</p>';
    html += '</div>';
    panel.innerHTML = html;
    setTimeout(function() {
      var b = document.getElementById('btnExportData');
      if (b) { b.onclick = exportData; }
      var c = document.getElementById('btnImportData');
      if (c) { c.onclick = importData; }
    }, 50);
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
async function deleteCategory(cat) {
  var names = exerciseCategories[cat] || [];
  var detached = names.filter(function(name) { return !Object.keys(exerciseCategories).some(function(other) { return other !== cat && exerciseCategories[other].includes(name); }); });
  var count = workouts.filter(function(w) { return detached.includes(w.exercise); }).length;
  if (!await labelDialog({title: '删除分类标识', message: '删除分类“' + cat + '”？\n关联 ' + count + ' 条训练记录将进入无标识区，记录不会删除。仍属于其他分类的项目保持原归属。', accept: '确认删除标识', danger: true})) return;
  delete exerciseCategories[cat];
  saveCategories();
  afterLabelChange();
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
async function deleteExercise(cat, ex) {
  var count = workouts.filter(function(w) { return w.exercise === ex; }).length;
  if (!await labelDialog({title: '删除项目标识', message: '删除项目标识“' + ex + '”？\n关联 ' + count + ' 条训练记录将进入无标识区，日期、重量和次数都会保留。该标识将从所有分类中移除。', accept: '确认删除标识', danger: true})) return;
  Object.keys(exerciseCategories).forEach(function(key) { exerciseCategories[key] = exerciseCategories[key].filter(function(name) { return name !== ex; }); });
  delete exerciseFreq[ex]; saveFreq();
  saveCategories(); afterLabelChange();
}
async function renameExercise(cat, oldName) {
  var count = workouts.filter(function(w) { return w.exercise === oldName; }).length;
  var answer = await labelDialog({title: '更改项目标识名称', message: '关联 ' + count + ' 条训练记录将同步改名。', value: oldName});
  if (answer === null) return;
  var name = answer.trim();
  if (!name || name === oldName) return;
  if (getAllExercises().includes(name) || workouts.some(function(w) { return w.exercise === name; })) { showToast('该项目名称已存在，请使用其他名称'); return; }
  Object.keys(exerciseCategories).forEach(function(key) { exerciseCategories[key] = exerciseCategories[key].map(function(ex) { return ex === oldName ? name : ex; }); });
  workouts.forEach(function(w) { if (w.exercise === oldName) w.exercise = name; });
  if (exerciseFreq[oldName] !== undefined) { exerciseFreq[name] = exerciseFreq[oldName]; delete exerciseFreq[oldName]; }
  var input = document.getElementById('recExercise');
  if (input.value === oldName) input.value = name;
  if (chartFilterEx === oldName) chartFilterEx = name;
  saveData(); saveCategories(); saveFreq(); afterLabelChange(); showToast('项目标识及关联记录已改名');
}
async function renameCategory(cat) {
  var answer = await labelDialog({title: '更改分类标识名称', message: '分类内的项目与训练记录将同步归入新名称。', value: cat});
  if (answer === null) return;
  var name = answer.trim();
  if (!name || name === cat) return;
  if (Object.prototype.hasOwnProperty.call(exerciseCategories, name) || ['__proto__', 'constructor', 'prototype'].includes(name)) { showToast('该分类名称已存在或不可用'); return; }
  exerciseCategories[name] = exerciseCategories[cat]; delete exerciseCategories[cat];
  expandedCategories[name] = expandedCategories[cat]; delete expandedCategories[cat];
  if (chartExpandedCat === cat) chartExpandedCat = name;
  saveCategories(); afterLabelChange(); showToast('分类标识已改名');
}
function afterLabelChange() {
  renderPresets();
  _cacheSetData = null; _cacheHeaviestData = null;
  openSetting('categories');
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
var incrementUnit = 'kg';
var DEFAULT_WEIGHT_PRESETS = {kg: [0.5, 1, 2.5, 5, 7.5, 10, 15, 20, 25, 50], lb: [5, 7, 9, 25]};
function getWeightPresets(unit) {
  try {
    var values = JSON.parse(localStorage.getItem('fitlog_weight_presets_' + unit));
    if (Array.isArray(values) && values.length && values.every(function(v) { return Number.isFinite(v) && v > 0; })) return values;
  } catch (e) {}
  return DEFAULT_WEIGHT_PRESETS[unit].slice();
}
function renderIncrementSetting(panel) {
  incrementUnit = localStorage.getItem('fitlog_increment_unit') === 'lb' ? 'lb' : 'kg';
  panel.innerHTML = '<div class="settings-back" onclick="renderSettingsPage()">‹ 返回设置</div>' +
    '<div class="card"><div class="card-title">重量每次增加设置</div>' +
    '<p class="unit-hint">设置重量箭头每次增减的数值；切换单位会换算当前数值。</p>' +
    '<div class="unit-options" role="group" aria-label="重量增量单位"><button id="incKg" type="button" onclick="setIncrementUnit(\'kg\')">kg</button><button id="incLb" type="button" onclick="setIncrementUnit(\'lb\')">磅 lb</button></div>' +
    '<div class="form-group" style="margin-top:12px"><label for="incValue">每次增减重量</label><div style="display:flex;gap:8px;align-items:center"><input type="number" id="incValue" min="0.000001" step="any" style="min-width:0;flex:1"><span id="incUnitLabel"></span><button class="btn btn-primary" type="button" onclick="saveIncrement()">保存</button></div></div>' +
    '<div id="incrementPresets" class="presets"></div></div>' +
    '<div class="card"><div class="card-title">编辑快捷重量按钮</div><p class="unit-hint" id="presetEditorHint"></p>' +
    '<div class="form-group"><label for="weightPresetValues">快捷重量列表（用逗号或空格分隔）</label><input id="weightPresetValues" type="text" placeholder="例如：5, 7, 9, 25"></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" onclick="saveWeightPresets()">保存快捷按钮</button><button class="btn btn-outline" type="button" onclick="resetWeightPresets()">恢复默认</button></div></div>';
  displayInputWeight(document.getElementById('incValue'), getIncrement(), incrementUnit);
  updateIncrementUnitUI();
}
function setIncrementUnit(unit) {
  if (unit !== 'kg' && unit !== 'lb') return;
  var input = document.getElementById('incValue');
  if (unit !== incrementUnit && input.value !== '') displayInputWeight(input, inputWeightKg(input, incrementUnit), unit);
  incrementUnit = unit;
  localStorage.setItem('fitlog_increment_unit', unit);
  updateIncrementUnitUI();
}
function updateIncrementUnitUI() {
  document.getElementById('incKg').setAttribute('aria-pressed', String(incrementUnit === 'kg'));
  document.getElementById('incLb').setAttribute('aria-pressed', String(incrementUnit === 'lb'));
  document.getElementById('incUnitLabel').textContent = incrementUnit;
  var values = getWeightPresets(incrementUnit);
  document.getElementById('weightPresetValues').value = values.join(', ');
  document.getElementById('presetEditorHint').textContent = '当前编辑 ' + incrementUnit + ' 快捷按钮。kg 和 lb 分别保存，修改后请点击“保存快捷按钮”。';
  var container = document.getElementById('incrementPresets');
  container.replaceChildren();
  values.forEach(function(value) {
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'btn btn-outline btn-sm';
    button.textContent = value + ' ' + incrementUnit;
    button.onclick = function() { displayInputWeight(document.getElementById('incValue'), weightToKg(value, incrementUnit), incrementUnit); };
    container.appendChild(button);
  });
}
function parseWeightPresets(text) {
  var parts = text.trim().split(/[\s,，;；]+/);
  if (!text.trim() || parts.some(function(v) { return !/^\d+(\.\d+)?$/.test(v) || !Number.isFinite(Number(v)) || Number(v) <= 0; })) throw new Error('请输入大于 0 的重量，用逗号或空格分隔');
  return Array.from(new Set(parts.map(Number)));
}
function saveWeightPresets() {
  try {
    var values = parseWeightPresets(document.getElementById('weightPresetValues').value);
    localStorage.setItem('fitlog_weight_presets_' + incrementUnit, JSON.stringify(values));
    updateIncrementUnitUI(); showToast('快捷按钮已保存');
  } catch (e) { showToast(e.message); }
}
function resetWeightPresets() {
  localStorage.removeItem('fitlog_weight_presets_' + incrementUnit);
  updateIncrementUnitUI(); showToast('已恢复 ' + incrementUnit + ' 默认快捷按钮');
}
function saveIncrement() {
  var v = parseFloat(document.getElementById('incValue').value);
  if (!Number.isFinite(v) || v <= 0) { showToast('\u8bf7\u8f93\u5165\u6709\u6548\u6570\u503c'); return; }
  setIncrement(inputWeightKg(document.getElementById('incValue'), incrementUnit));
  showToast('已保存: ' + v + ' ' + incrementUnit);
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
  { id: 'monokai', name: 'Monokai', icon: '\ud83c\udfad', desc: '\u7ecf\u5178\u4ee3\u7801\u914d\u8272\uff0c\u6696\u68d5\u80cc\u666f + \u7eff\u9ec4\u9ad8\u4eae' },
  { id: 'nord', name: 'Nord \u5317\u6b27', icon: '\u2744', desc: '\u5317\u6b27\u6781\u5149\u98ce\uff0c\u84dd\u7070\u51b7\u8c03' },
  { id: 'dracula', name: 'Dracula', icon: '\ud83e\udddb', desc: '\u7d2b\u9ed1\u5fb7\u53e4\u62c9\uff0c\u65f6\u5c1a\u6697\u7d2b' },
  { id: 'github', name: 'GitHub \u6697', icon: '\ud83d\udcbb', desc: '\u6a21\u4eff GitHub \u6697\u8272\u6a21\u5f0f\uff0c\u84dd\u7070\u5185\u655b' },
  { id: 'ocean', name: '\u6d77\u6d0b\u84dd', icon: '\ud83c\udf0a', desc: '\u6e05\u723d\u84dd\u8c03\uff0c\u5b81\u9759\u4e13\u6ce8' },
  { id: 'forest', name: '\u68ee\u6797\u7eff', icon: '\ud83c\udf32', desc: '\u81ea\u7136\u7eff\u610f\uff0c\u6c89\u7a33\u8212\u7f13' },
  { id: 'sunset', name: '\u65e5\u843d\u6a59', icon: '\ud83c\udf07', desc: '\u6e29\u6696\u6a59\u8c03\uff0c\u6d3b\u529b\u5145\u6c9b' },
  { id: 'purple', name: '\u7d2b\u7f57\u5170', icon: '\ud83d\udc9c', desc: '\u7d2b\u8272\u9b45\u529b\uff0c\u4f18\u96c5\u65f6\u5c1a' },
  { id: 'midnight', name: '\u5348\u591c\u84dd', icon: '\ud83c\udf19', desc: '\u6df1\u84dd\u9ed1\u8272\uff0cOLED \u53cb\u597d\u7701\u7535' },
  { id: 'matcha', name: '\u62b9\u8336\u7eff', icon: '\ud83c\udf75', desc: '\u67d4\u548c\u7eff\u8336\u8272\uff0c\u6e29\u6696\u81ea\u7136' },
  { id: 'sakura', name: '\u6a31\u82b1\u7c89', icon: '\ud83c\udf38', desc: '\u6e29\u67d4\u7c89\u767d\u8c03\uff0c\u6d45\u8272\u5c0f\u6e05\u65b0' },
  { id: 'coffee', name: '\u5496\u5561\u68d5', icon: '\u2615', desc: '\u6696\u68d5\u8272\u7cfb\uff0c\u590d\u53e4\u4e66\u5377\u6c1b\u56f4' }
];

function setTheme(t, silent) {
  localStorage.setItem(THEME_KEY, t);
  // Remove all theme classes
  var themes = ['dark', 'light', 'monokai', 'nord', 'dracula', 'github', 'ocean', 'forest', 'sunset', 'purple', 'midnight', 'matcha', 'sakura', 'coffee'];
  themes.forEach(function(th) { document.body.classList.remove('theme-' + th); });
  // Add the selected theme class (dark is default, no class needed)
  if (t !== 'dark') {
    document.body.classList.add('theme-' + t);
  }
  if (!silent && currentSetting === 'theme') openSetting('theme');
}

// ========== EXPORT / IMPORT ==========
var exportBusy = false;
function nativeBackupPlugin() {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform() || cap.getPlatform() !== 'android') return null;
  if (!cap.isPluginAvailable('BackupFiles')) throw new Error('此安装包不支持原生保存，请更新安装包');
  return cap.registerPlugin('BackupFiles');
}
function buildBackup() {
  return {
    version: 1, exportedAt: new Date().toISOString(), workouts: workouts,
    exerciseCategories: exerciseCategories, defaultCategories: defaultCategories,
    exerciseFreq: exerciseFreq, increment: getIncrement(),
    weightPresets: {kg: getWeightPresets('kg'), lb: getWeightPresets('lb')},
    recordUnit: recordUnit, incrementUnit: localStorage.getItem('fitlog_increment_unit') === 'lb' ? 'lb' : 'kg'
  };
}
function backupFilename(now) {
  return 'FitLog_backup_' + dateKey(now) + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0') + '_' + String(now.getMilliseconds()).padStart(3, '0') + '.json';
}
async function exportData(mode) {
  if (exportBusy) return;
  exportBusy = true;
  var jsonStr, filename;
  try {
    jsonStr = JSON.stringify(buildBackup(), null, 2);
    filename = backupFilename(new Date());
    var native = nativeBackupPlugin();
    if (native) {
      if (mode === 'share') {
        await native.share({filename: filename, data: jsonStr});
        showToast('已打开系统分享窗口，请选择接收应用');
      } else {
        var saved = await native.save({filename: filename, data: jsonStr});
        if (saved.cancelled) { showToast('已取消保存，未导出备份'); return; }
        showToast('备份文件已保存');
        showExportModal(jsonStr, saved.filename || filename, {title: '备份文件已保存', message: '文件已写入你在系统保存窗口选择的位置。可在该文件夹找到以下 JSON 文件。', native: true, shareFilename: filename});
      }
    } else {
      var blob = new Blob([jsonStr], {type: 'application/json;charset=utf-8'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
      showExportModal(jsonStr, filename, {title: '已请求下载备份', message: '请查看浏览器下载列表，确认文件已保存。也可复制下方备份内容。'});
    }
  } catch (e) {
    showToast('导出未完成');
    showExportModal(jsonStr || '', filename || '', {title: '备份保存失败', message: e.message || String(e)});
  } finally { exportBusy = false; }
}
function showExportModal(jsonStr, filename, options) {
  options = options || {};
  var overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.style.zIndex = '300';
  var box = document.createElement('div'); box.className = 'modal-sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', options.title || '备份文件');
  var title = document.createElement('h2'); title.className = 'card-title'; title.textContent = options.title || '备份文件';
  var message = document.createElement('p'); message.className = 'unit-hint'; message.textContent = options.message || '';
  var name = document.createElement('p'); name.style.cssText = 'font-size:13px;overflow-wrap:anywhere;margin-bottom:12px'; name.textContent = filename;
  box.append(title, message, name);
  if (jsonStr && !options.native) {
    var text = document.createElement('textarea'); text.id = 'exportTextArea'; text.readOnly = true; text.value = jsonStr;
    text.setAttribute('aria-label', '备份 JSON 内容'); text.style.cssText = 'width:100%;height:180px;background:var(--surface2);color:var(--text);font:12px monospace'; box.appendChild(text);
  }
  var actions = document.createElement('div'); actions.className = 'label-dialog-actions';
  if (options.native) {
    var share = document.createElement('button'); share.type = 'button'; share.className = 'btn btn-primary'; share.textContent = '分享该备份';
    share.onclick = async function() { if (share.disabled) return; share.disabled = true; try { await nativeBackupPlugin().share({filename: options.shareFilename || filename, data: jsonStr}); showToast('已打开系统分享窗口'); } catch(e) { showToast('分享未完成：' + e.message); } finally { share.disabled = false; } }; actions.appendChild(share);
  } else if (jsonStr) {
    var copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn btn-outline'; copy.textContent = '复制内容';
    copy.onclick = async function() { try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(jsonStr); copy.textContent = '已复制'; } else { fallbackCopy(jsonStr, copy); } } catch(e) { fallbackCopy(jsonStr, copy); } }; actions.appendChild(copy);
  }
  var close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn-outline'; close.textContent = '关闭'; close.onclick = function() { overlay.remove(); };
  actions.appendChild(close); box.appendChild(actions); overlay.appendChild(box); document.body.appendChild(overlay);
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); }; close.focus();
}
function fallbackCopy(text, btn) {
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:-9999px";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand("copy"); btn.textContent = "已复制!"; } catch(e) { btn.textContent = "复制失败"; }
  document.body.removeChild(ta);
  setTimeout(function() { btn.textContent = "复制内容"; }, 1500);
}function validateBackup(data) {
  var ids = new Set();
  data.workouts.forEach(function(w) {
    if (!w || typeof w.id !== 'string' || !w.id || ids.has(w.id) ||
        typeof w.exercise !== 'string' || !w.exercise.trim() ||
        typeof w.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w.date) ||
        dateKey(new Date(w.date + 'T12:00:00')) !== w.date ||
        !Array.isArray(w.sets) || !w.sets.length || w.sets.some(function(set) {
          return !set || !Number.isFinite(set.weight) || set.weight < 0 || !Number.isInteger(set.reps) || set.reps <= 0;
        })) throw new Error('训练记录格式无效，原有数据未修改');
    ids.add(w.id);
  });
  ['exerciseCategories', 'defaultCategories'].forEach(function(key) {
    var map = data[key];
    if (map === undefined) return;
    if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).some(function(k) {
      return !Array.isArray(map[k]) || map[k].some(function(name) { return typeof name !== 'string' || !name.trim(); });
    })) throw new Error('分类格式无效');
  });
  if (data.exerciseFreq !== undefined && (!data.exerciseFreq || typeof data.exerciseFreq !== 'object' || Array.isArray(data.exerciseFreq) || Object.values(data.exerciseFreq).some(function(n) { return !Number.isInteger(n) || n < 0; }))) throw new Error('动作频次格式无效');
  if (data.increment !== undefined && (!Number.isFinite(data.increment) || data.increment <= 0)) throw new Error('重量增量无效');
  if (data.weightPresets !== undefined) {
    if (!data.weightPresets || ['kg', 'lb'].some(function(unit) { var values = data.weightPresets[unit]; return !Array.isArray(values) || !values.length || values.some(function(v) { return !Number.isFinite(v) || v <= 0; }); })) throw new Error('快捷重量列表无效');
  }
  ['recordUnit', 'incrementUnit'].forEach(function(key) { if (data[key] !== undefined && !['kg', 'lb'].includes(data[key])) throw new Error('重量单位无效'); });
}

function importData() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!data || !Array.isArray(data.workouts)) {
          alert('数据格式无效，请选择正确的备份文件');
          return;
        }
        validateBackup(data);
        var count = data.workouts.length;
        if (!confirm('将导入 ' + count + ' 条记录。当前记录将被替换，确定继续？')) return;
        workouts = data.workouts;
        saveData();
        if (data.exerciseCategories !== undefined) {
          exerciseCategories = data.exerciseCategories;
          saveCategories();
        }
        if (data.exerciseFreq) {
          exerciseFreq = data.exerciseFreq;
          saveFreq();
        }
        if (data.defaultCategories) {
          defaultCategories = data.defaultCategories;
          localStorage.setItem(DEFAULT_CAT_KEY, JSON.stringify(defaultCategories));
        }
        if (data.increment !== undefined) setIncrement(data.increment);
        if (data.weightPresets) ['kg', 'lb'].forEach(function(unit) { localStorage.setItem('fitlog_weight_presets_' + unit, JSON.stringify(data.weightPresets[unit])); });
        if (data.incrementUnit) localStorage.setItem('fitlog_increment_unit', data.incrementUnit);
        if (data.recordUnit) setRecordUnit(data.recordUnit);
        showToast('已导入 ' + count + ' 条记录');
        refreshAll();
        renderPresets();
      } catch(e) {
        alert('文件解析失败：' + e.message);
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  // input removed by onchange handler
}

// ========== CHARTS ==========
var chartWeightInst = null, chartVolumeInst = null;
var chartFilterEx = 'all';
var chartExpandedCat = null;
var _cacheSetData = null, _cacheHeaviestData = null;
var setFilterMode = 'all';
var _activeFilterMode = 'all'; // cached at chart creation, used by updateChart1

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


function onChartWheel(e, chartNum) {
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

// Attach wheel listeners to chart canvases
// Pinch zoom for touch devices
var pinchStates = { 1: { lastScale: 1, startZoom: 1 }, 2: { lastScale: 1, startZoom: 1 } };
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
  if (c1) c1.onwheel = function(e) { onChartWheel(e, 1); };
  if (c2) c2.onwheel = function(e) { onChartWheel(e, 2); };
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
  if (_activeFilterMode === 'all') {
    datasetsToShow = setData.datasets;
  } else {
    var si = parseInt(_activeFilterMode);
    datasetsToShow = (si >= 0 && si < setData.datasets.length) ? [setData.datasets[si]] : [];
  }
  chartWeightInst.data.labels = wLabels;
  chartWeightInst.data.datasets = datasetsToShow.map(function(ds) {
    return {
      label: ds.label,
      data: ds.data.slice(wStart, wEnd),
      exNames: ds.exNames ? ds.exNames.slice(wStart, wEnd) : null,
      reps: ds.reps ? ds.reps.slice(wStart, wEnd) : null,
      borderColor: ds.borderColor,
      backgroundColor: ds.backgroundColor,
      tension: ds.tension,
      pointRadius: ds.pointRadius,
      borderWidth: ds.borderWidth,
      spanGaps: ds.spanGaps
    };
  });
  chartWeightInst.options = chartOpts(_activeFilterMode === 'all' && datasetsToShow.length > 1, chartWeightInst.data.labels);
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
  var container = document.getElementById('chartFilter'); container.replaceChildren();
  function chip(name, action, selected, sub) {
    var button = document.createElement('button'); button.type = 'button';
    button.className = 'preset-chip' + (selected ? ' selected' : '') + (sub ? ' sub-chip' : '');
    button.textContent = name; button.onclick = action; container.appendChild(button);
  }
  chip('全部', function() { chartFilterEx = 'all'; chartExpandedCat = null; renderCharts(); }, chartFilterEx === 'all');
  chip('无标识区', function() { chartFilterEx = '__unlabelled__'; chartExpandedCat = null; renderCharts(); }, chartFilterEx === '__unlabelled__');
  var groups = Object.assign({}, exerciseCategories);
  var orphanNames = Array.from(new Set(workouts.filter(isUnlabelled).map(function(w) { return w.exercise; })));
  Object.keys(groups).forEach(function(cat) {
    chip(cat + (chartExpandedCat === cat ? ' ▼' : ' ▶'), function() { chartExpandedCat = chartExpandedCat === cat ? null : cat; renderChartFilter(); }, chartExpandedCat === cat);
    if (chartExpandedCat === cat) groups[cat].forEach(function(ex) { chip(ex, function() { chartFilterEx = ex; renderCharts(); }, chartFilterEx === ex, true); });
  });
  if (chartFilterEx === '__unlabelled__' || orphanNames.includes(chartFilterEx)) orphanNames.forEach(function(ex) { chip(ex, function() { chartFilterEx = ex; renderCharts(); }, chartFilterEx === ex, true); });
}
function chartWorkouts(filter) {
  return workouts.filter(function(w) { return filter === 'all' || (filter === '__unlabelled__' ? isUnlabelled(w) : w.exercise === filter); });
}
function destroyCharts() {
  if (chartWeightInst) { chartWeightInst.destroy(); chartWeightInst = null; }
  if (chartVolumeInst) { chartVolumeInst.destroy(); chartVolumeInst = null; }
}

// Build per-set data: { labels: [dates], datasets: [{set index, color, data}] }
function buildSetData(filter) {
  var filtered = chartWorkouts(filter);
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
    var exNames = dates.map(function(d) {
      var dayWorkouts = filtered.filter(function(w) { return w.date === d; });
      for (var j = 0; j < dayWorkouts.length; j++) {
        if (dayWorkouts[j].sets.length > si) return dayWorkouts[j].exercise;
      }
      return null;
    });
    var data = dates.map(function(d) {
      var dayWorkouts = filtered.filter(function(w) { return w.date === d; });
      // For a given day, take the first workout's si-th set weight
      for (var j = 0; j < dayWorkouts.length; j++) {
        if (dayWorkouts[j].sets.length > si) return dayWorkouts[j].sets[si].weight;
      }
      return null;
    });
    var reps = dates.map(function(d) {
      var dayWorkouts = filtered.filter(function(w) { return w.date === d; });
      for (var j = 0; j < dayWorkouts.length; j++) {
        if (dayWorkouts[j].sets.length > si) return dayWorkouts[j].sets[si].reps;
      }
      return null;
    });
    datasets.push({
      setIndex: si,
      label: '\u7b2c' + (si+1) + '\u7ec4',
      data: data,
      exNames: exNames,
      reps: reps,
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
  var filtered = chartWorkouts(filter);
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

  var exNames = dates.map(function(d) {
    var dayWorkouts = filtered.filter(function(w) { return w.date === d; });
    var maxW = 0, maxEx = '';
    dayWorkouts.forEach(function(w) {
      w.sets.forEach(function(s) { if (s.weight > maxW) { maxW = s.weight; maxEx = w.exercise; } });
    });
    return maxEx;
  });
  var reps = dates.map(function(d) {
    var dayWorkouts = filtered.filter(function(w) { return w.date === d; });
    var maxW = 0, maxReps = 0;
    dayWorkouts.forEach(function(w) {
      w.sets.forEach(function(s) { if (s.weight > maxW) { maxW = s.weight; maxReps = s.reps; } });
    });
    return maxReps || null;
  });
  return { labels: dates, data: data, exNames: exNames, reps: reps };
}



// ========== CHART OPTIONS ==========
  // Global plugin: draws border labels and colored grid lines for all charts
function chartOpts(showLegend, labels) {
    return {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: !!showLegend, position: 'top', labels: { color: '#999', font: { size: 10 }, boxWidth: 12, padding: 8 } },
        tooltip: {
          callbacks: {
            title: function(ctx) {
              if (!ctx.length) return '';
              return ctx[0].label || '';
            },
            label: function(ctx) {
              var exName = '';
              if (ctx.dataset.exNames && ctx.dataIndex < ctx.dataset.exNames.length) {
                exName = ctx.dataset.exNames[ctx.dataIndex] || '';
              }
              var setLabel = ctx.dataset.label || '';
              var weight = ctx.parsed.x;
              var reps = '';
              if (ctx.dataset.reps && ctx.dataIndex < ctx.dataset.reps.length) {
                reps = ctx.dataset.reps[ctx.dataIndex];
              }
              var parts = [];
              if (exName) parts.push(exName);
              if (setLabel) parts.push(setLabel);
              parts.push(Number(weight.toFixed(3)) + ' kg');
              if (reps !== null && reps !== undefined && reps !== '') parts.push(reps + ' reps');
              return parts.join(' · ');
            }
          }
        }
      },
      scales: {
x: { ticks: { color: '#999', font: { size: 10 } }, grid: { color: '#2a2a2a' }, beginAtZero: false, title: { display: true, text: '重量（kg）', color: '#999' } },
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
  _activeFilterMode = setFilterMode; // lock filter mode for this chart instance

  var hasData = setData.labels.length > 0;

  var containers = document.querySelectorAll('#panel-charts .chart-container canvas');
  containers.forEach(function(c) { c.style.display = hasData ? '' : 'none'; });

  if (!hasData) {
    document.getElementById('setTabs').innerHTML = '';
    renderChartFilter();
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
      exNames: ds.exNames ? ds.exNames.slice(wStart, wEnd) : null,
      reps: ds.reps ? ds.reps.slice(wStart, wEnd) : null,
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

  var hExNames = heaviestData.exNames ? heaviestData.exNames.slice(hStart, hEnd) : null;
  var hReps = heaviestData.reps ? heaviestData.reps.slice(hStart, hEnd) : null;
  chartVolumeInst = new Chart(document.getElementById('chartVolume').getContext('2d'), {
    type: 'line',
    data: { labels: hLabels, datasets: [{ data: hData, exNames: hExNames, reps: hReps, label: '当日最重组', borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#ff6b35', borderWidth: 2 }] },
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
  document.getElementById('historyAll').setAttribute('aria-pressed', String(historyLabelScope === 'all'));
  document.getElementById('historyUnlabelled').setAttribute('aria-pressed', String(historyLabelScope === 'unlabelled'));
  var filtered = workouts.filter(function(w) { return (historyLabelScope !== 'unlabelled' || isUnlabelled(w)) && (!search || w.exercise.toLowerCase().indexOf(search) >= 0 || w.date.indexOf(search) >= 0); });
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
          '<div class="wo-exercise">' + escapeText(w.exercise) + (isUnlabelled(w) ? ' · 无标识' : '') + '</div>' +
          '<div class="wo-sets">' + w.sets.length + '\u7ec4 | \u6700\u5927 ' + maxW + 'kg | \u603b\u91cf ' + totalV + 'kg</div>' +
          '<div class="wo-sets">' + w.sets.map(function(s,i) { return '#' + (i+1) + ': ' + Number(s.weight.toFixed(3)) + 'kg \u00d7 ' + s.reps + '\u6b21'; }).join(' | ') + '</div>' +
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
    html += '<div class=\"' + cls + '\" onclick=\"goToDay(\x27' + dateStr + '\x27)\">' + d;
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
    var dateStr = dateKey(d);
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
