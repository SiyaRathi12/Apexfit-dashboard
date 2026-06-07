/* ==========================================================================
   Javascript Logic - ApexFit
   ========================================================================== */

// --- STATE MANAGEMENT ---
const DEFAULT_STATE = {
  goals: {
    steps: 10000,
    water: 2000,
    calories: 500,
    workoutsWeekly: 5
  },
  logs: {
    steps: [],     // { id: String, date: String, value: Number }
    water: [],     // { id: String, date: String, time: String, value: Number }
    workouts: []   // { id: String, date: String, time: String, type: String, duration: Number, calories: Number, notes: String }
  }
};

// Retrieve initial state from localStorage or fallback to defaults
function getInitialState() {
  try {
    const savedData = localStorage.getItem('fitness_tracker_data');
    if (savedData) {
      return JSON.parse(savedData);
    }
  } catch (error) {
    console.error("Failed to parse fitness tracker data from localStorage:", error);
  }
  // Return deep clone of DEFAULT_STATE to prevent shared reference mutations
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let appState = getInitialState();

// Save state to local storage
function saveState() {
  try {
    localStorage.setItem('fitness_tracker_data', JSON.stringify(appState));
  } catch (error) {
    console.error("Failed to save fitness tracker data to localStorage:", error);
  }
}

// Ensure the loaded state has all required keys (for backward compatibility / fresh loads)
function sanitizeState() {
  if (!appState.goals) appState.goals = JSON.parse(JSON.stringify(DEFAULT_STATE.goals));
  if (!appState.logs) appState.logs = JSON.parse(JSON.stringify(DEFAULT_STATE.logs));
  if (!appState.logs.steps) appState.logs.steps = [];
  if (!appState.logs.water) appState.logs.water = [];
  if (!appState.logs.workouts) appState.logs.workouts = [];
  
  // Backwards compatibility check for water IDs, steps IDs, and workouts IDs
  appState.logs.water.forEach(item => { if (!item.id) item.id = 'wat_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(); });
  appState.logs.steps.forEach(item => { if (!item.id) item.id = 'st_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(); });
  appState.logs.workouts.forEach(item => { if (!item.id) item.id = 'wk_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(); });
  
  saveState();
}

// --- DATE HELPER FUNCTIONS ---
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPast7Days() {
  const list = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    list.push(getLocalDateString(d));
  }
  return list;
}

// Returns start and end of week (Sunday to Saturday) containing target date
function getWeekRange(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 is Sunday
  
  const start = new Date(dateObj);
  start.setDate(dateObj.getDate() - dayOfWeek);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  
  return {
    start: getLocalDateString(start),
    end: getLocalDateString(end)
  };
}

// --- APP NOTIFICATION (TOAST) ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'info') iconName = 'info';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span class="toast-text">${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Animate and remove
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// --- VIEW NAVIGATION CONTROLLER ---
const views = ['dashboard', 'analytics', 'goals', 'settings'];
function switchView(targetView) {
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const btn = document.getElementById(`btn-tab-${v}`);
    if (v === targetView) {
      el.classList.add('active');
      btn.classList.add('active');
    } else {
      el.classList.remove('active');
      btn.classList.remove('active');
    }
  });

  // Update header titles
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  
  if (targetView === 'dashboard') {
    pageTitle.textContent = "Dashboard";
    pageSubtitle.textContent = "Welcome back! Here's your fitness overview for today.";
    updateDashboard();
  } else if (targetView === 'analytics') {
    pageTitle.textContent = "Analytics";
    pageSubtitle.textContent = "Track your workout, steps, and water intake trends.";
    renderAnalyticsChart();
  } else if (targetView === 'goals') {
    pageTitle.textContent = "Set Goals";
    pageSubtitle.textContent = "Adjust your daily and weekly goals to stay challenged.";
    populateGoalFields();
  } else if (targetView === 'settings') {
    pageTitle.textContent = "Settings";
    pageSubtitle.textContent = "Backup, restore, and clear your workout tracking data.";
  }
}

// Add click listeners to sidebar/mobile menu buttons
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');
    switchView(target);
  });
});

// --- GOAL FIELDS INGESTION & SUBMISSION ---
function populateGoalFields() {
  document.getElementById('goal-input-steps').value = appState.goals.steps;
  document.getElementById('goal-input-water').value = appState.goals.water;
  document.getElementById('goal-input-calories').value = appState.goals.calories;
  document.getElementById('goal-input-workouts').value = appState.goals.workoutsWeekly;
}

document.getElementById('btn-save-goals').addEventListener('click', () => {
  const stepsVal = parseInt(document.getElementById('goal-input-steps').value);
  const waterVal = parseInt(document.getElementById('goal-input-water').value);
  const caloriesVal = parseInt(document.getElementById('goal-input-calories').value);
  const workoutsVal = parseInt(document.getElementById('goal-input-workouts').value);
  
  if (isNaN(stepsVal) || stepsVal <= 0 ||
      isNaN(waterVal) || waterVal <= 0 ||
      isNaN(caloriesVal) || caloriesVal <= 0 ||
      isNaN(workoutsVal) || workoutsVal <= 0) {
    showToast("Please enter positive, valid numerical goals.", "error");
    return;
  }
  
  appState.goals.steps = stepsVal;
  appState.goals.water = waterVal;
  appState.goals.calories = caloriesVal;
  appState.goals.workoutsWeekly = workoutsVal;
  
  saveState();
  showToast("Goals updated successfully!");
  updateDashboard();
});

// --- MODAL UTILITIES ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    
    // Set default dates inside inputs to viewed date
    const dateInputs = modal.querySelectorAll('input[type="date"]');
    const todayStr = activeDate;
    dateInputs.forEach(input => {
      if (!input.value) {
        input.value = todayStr;
      }
    });

    // Set time input to current time for workouts
    const timeInput = modal.querySelector('input[type="time"]');
    if (timeInput && !timeInput.value) {
      const now = new Date();
      timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// Bind standard close button elements inside modals
document.querySelectorAll('.btn-close-modal, .close-btn-element, #btn-cancel-reset').forEach(el => {
  el.addEventListener('click', (e) => {
    const parentModal = e.target.closest('.modal-overlay');
    if (parentModal) {
      closeModal(parentModal.id);
    }
  });
});

// Setup click action triggers for modals
document.getElementById('btn-log-steps').addEventListener('click', () => openModal('modal-log-steps'));
document.getElementById('btn-log-water-custom').addEventListener('click', () => openModal('modal-log-water'));
document.getElementById('btn-log-workout').addEventListener('click', () => openModal('modal-log-workout'));

// --- CRUD BUSINESS LOGIC FOR DATA LOGS ---

// Add steps
document.getElementById('form-log-steps').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('input-steps-date').value;
  const count = parseInt(document.getElementById('input-steps-count').value);
  
  if (!date || isNaN(count) || count <= 0) {
    showToast("Please enter a valid count.", "error");
    return;
  }
  
  // Check if steps for this date already exist; if so, we increment them.
  const existingIndex = appState.logs.steps.findIndex(s => s.date === date);
  if (existingIndex !== -1) {
    appState.logs.steps[existingIndex].value += count;
  } else {
    appState.logs.steps.push({
      id: 'st_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
      date: date,
      value: count
    });
  }
  
  saveState();
  closeModal('modal-log-steps');
  document.getElementById('form-log-steps').reset();
  showToast(`Logged ${count.toLocaleString()} steps.`);
  updateDashboard();
});

// Add water presets
document.querySelectorAll('.btn-quick-water').forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = parseInt(btn.getAttribute('data-amount'));
    const today = getLocalDateString();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    appState.logs.water.push({
      id: 'wat_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
      date: today,
      time: timeStr,
      value: amount
    });
    
    saveState();
    showToast(`Added ${amount}ml of water.`);
    
    // Trigger splash animations on hydration card
    const waterCard = document.querySelector('.water-card');
    if (waterCard) {
      waterCard.classList.remove('splash');
      void waterCard.offsetWidth; // Trigger reflow to restart keyframes
      waterCard.classList.add('splash');
      setTimeout(() => waterCard.classList.remove('splash'), 600);
    }
    
    updateDashboard();
  });
});

// Add custom water
document.getElementById('form-log-water').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('input-water-date').value;
  const amount = parseInt(document.getElementById('input-water-amount').value);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  if (!date || isNaN(amount) || amount <= 0) {
    showToast("Please enter a valid amount.", "error");
    return;
  }
  
  appState.logs.water.push({
    id: 'wat_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
    date: date,
    time: timeStr,
    value: amount
  });
  
  saveState();
  closeModal('modal-log-water');
  document.getElementById('form-log-water').reset();
  showToast(`Logged ${amount}ml water.`);
  
  // Trigger splash if logged for today
  if (date === getLocalDateString()) {
    const waterCard = document.querySelector('.water-card');
    if (waterCard) {
      waterCard.classList.remove('splash');
      void waterCard.offsetWidth;
      waterCard.classList.add('splash');
      setTimeout(() => waterCard.classList.remove('splash'), 600);
    }
  }
  
  updateDashboard();
});

// Add Workout session
document.getElementById('form-log-workout').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('input-workout-date').value;
  const time = document.getElementById('input-workout-time').value;
  const type = document.getElementById('input-workout-type').value;
  const duration = parseInt(document.getElementById('input-workout-duration').value);
  const calories = parseInt(document.getElementById('input-workout-calories').value);
  const notes = document.getElementById('input-workout-notes').value.trim();
  
  if (!date || !time || !type || isNaN(duration) || duration <= 0 || isNaN(calories) || calories <= 0) {
    showToast("Please fill all required workout fields.", "error");
    return;
  }
  
  appState.logs.workouts.push({
    id: 'wk_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
    date,
    time,
    type,
    duration,
    calories,
    notes: notes || ""
  });
  
  saveState();
  closeModal('modal-log-workout');
  document.getElementById('form-log-workout').reset();
  showToast(`Logged workout session: ${type}.`);
  updateDashboard();
});

// Delete Activity (with smooth animation collapse)
function deleteLogItem(id) {
  const deleteButton = document.querySelector(`.btn-delete-activity[data-id="${id}"]`);
  const activityItem = deleteButton ? deleteButton.closest('.activity-item') : null;
  
  const performActualDelete = () => {
    // Try Steps
    let index = appState.logs.steps.findIndex(i => i.id === id);
    if (index !== -1) {
      appState.logs.steps.splice(index, 1);
      saveState();
      showToast("Steps entry deleted.", "info");
      updateDashboard();
      return;
    }
    
    // Try Water
    index = appState.logs.water.findIndex(i => i.id === id);
    if (index !== -1) {
      appState.logs.water.splice(index, 1);
      saveState();
      showToast("Water entry deleted.", "info");
      updateDashboard();
      return;
    }
    
    // Try Workouts
    index = appState.logs.workouts.findIndex(i => i.id === id);
    if (index !== -1) {
      appState.logs.workouts.splice(index, 1);
      saveState();
      showToast("Workout session deleted.", "info");
      updateDashboard();
      return;
    }
  };

  if (activityItem) {
    activityItem.classList.add('removing');
    activityItem.addEventListener('animationend', () => {
      performActualDelete();
    });
  } else {
    performActualDelete();
  }
}

// --- STREAK CALCULATION LOGIC ---

// Helper to parse date string in local timezone to avoid UTC timezone offsets
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Calculate streak relative to the active date
function calculateStreak(datesWithGoalMet) {
  if (!datesWithGoalMet || datesWithGoalMet.length === 0) return 0;
  
  const metDatesSet = new Set(datesWithGoalMet);
  const anchorStr = activeDate;
  
  // Find yesterday's date relative to active date
  const yesterdayDate = parseLocalDate(anchorStr);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayDate);
  
  let startStr = "";
  if (metDatesSet.has(anchorStr)) {
    startStr = anchorStr;
  } else if (metDatesSet.has(yesterdayStr)) {
    startStr = yesterdayStr;
  } else {
    return 0;
  }
  
  let streak = 0;
  let checkDate = parseLocalDate(startStr);
  
  while (true) {
    const checkStr = getLocalDateString(checkDate);
    if (metDatesSet.has(checkStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

// Steps Goal Streak
function calculateStepsStreak() {
  const dailyStepsMap = {};
  appState.logs.steps.forEach(log => {
    if (!dailyStepsMap[log.date]) dailyStepsMap[log.date] = 0;
    dailyStepsMap[log.date] += log.value;
  });

  const datesWithGoalMet = Object.keys(dailyStepsMap).filter(date => {
    return dailyStepsMap[date] >= appState.goals.steps;
  });

  return calculateStreak(datesWithGoalMet);
}

// Water Goal Streak
function calculateWaterStreak() {
  const dailyWaterMap = {};
  appState.logs.water.forEach(log => {
    if (!dailyWaterMap[log.date]) dailyWaterMap[log.date] = 0;
    dailyWaterMap[log.date] += log.value;
  });

  const datesWithGoalMet = Object.keys(dailyWaterMap).filter(date => {
    return dailyWaterMap[date] >= appState.goals.water;
  });

  return calculateStreak(datesWithGoalMet);
}

// Workout streak: Consecutive days with at least one workout logged
function calculateWorkoutStreak() {
  const workoutDates = [...new Set(appState.logs.workouts.map(w => w.date))];
  return calculateStreak(workoutDates);
}

let activeDate = getLocalDateString();

// --- DASHBOARD RENDERING ---
function updateDashboard() {
  const today = activeDate;
  
  // Formats date badge
  document.getElementById('header-date').textContent = formatDisplayDate(today);

  // 1. Steps Calculation
  const todayStepsLogs = appState.logs.steps.filter(s => s.date === today);
  const stepsSum = todayStepsLogs.reduce((acc, curr) => acc + curr.value, 0);
  const stepsGoal = appState.goals.steps;
  const stepsPct = Math.min(Math.round((stepsSum / stepsGoal) * 100), 1000);
  
  document.getElementById('stats-steps-val').textContent = stepsSum.toLocaleString();
  document.getElementById('stats-steps-goal').textContent = `Goal: ${stepsGoal.toLocaleString()}`;
  document.getElementById('stats-steps-pct').textContent = `${stepsPct}%`;
  document.getElementById('stats-steps-cal').textContent = Math.round(stepsSum * 0.04).toLocaleString();
  
  // Set SVG steps ring
  const stepsCirc = 2 * Math.PI * 66; // 414.69
  const stepsOffset = stepsCirc - (Math.min(stepsPct, 100) / 100) * stepsCirc;
  document.getElementById('steps-ring').style.strokeDashoffset = stepsOffset;
  
  // Set goal met pulse glow animation
  const stepsContainer = document.querySelector('.steps-card .progress-ring-container');
  if (stepsPct >= 100) {
    stepsContainer.classList.add('goal-achieved');
  } else {
    stepsContainer.classList.remove('goal-achieved');
  }
  
  // 2. Water Calculation
  const todayWaterLogs = appState.logs.water.filter(w => w.date === today);
  const waterSum = todayWaterLogs.reduce((acc, curr) => acc + curr.value, 0);
  const waterGoal = appState.goals.water;
  const waterPct = Math.min(Math.round((waterSum / waterGoal) * 100), 1000);
  
  document.getElementById('stats-water-val').innerHTML = `${waterSum} <small class="text-unit">ml</small>`;
  document.getElementById('stats-water-goal').textContent = `Goal: ${waterGoal.toLocaleString()} ml`;
  
  // Set SVG water ring
  const waterCirc = 2 * Math.PI * 66;
  const waterOffset = waterCirc - (Math.min(waterPct, 100) / 100) * waterCirc;
  document.getElementById('water-ring').style.strokeDashoffset = waterOffset;
  
  // Set goal met pulse glow animation
  const waterContainer = document.querySelector('.water-card .progress-ring-container');
  if (waterPct >= 100) {
    waterContainer.classList.add('goal-achieved');
  } else {
    waterContainer.classList.remove('goal-achieved');
  }
  
  // 3. Active Calories (From Workouts today + Step Estimation)
  const todayWorkoutLogs = appState.logs.workouts.filter(w => w.date === today);
  const workoutCaloriesSum = todayWorkoutLogs.reduce((acc, curr) => acc + curr.calories, 0);
  const stepCalories = Math.round(stepsSum * 0.04);
  const totalCaloriesSum = workoutCaloriesSum + stepCalories;
  const caloriesGoal = appState.goals.calories;
  const caloriesPct = Math.min(Math.round((totalCaloriesSum / caloriesGoal) * 100), 100);
  
  document.getElementById('stats-calories-val').innerHTML = `${totalCaloriesSum} <small class="text-unit">kcal</small>`;
  document.getElementById('stats-calories-goal').textContent = `Goal: ${caloriesGoal} kcal`;
  document.getElementById('stats-calories-bar').style.width = `${caloriesPct}%`;
  document.getElementById('stats-calories-pct').textContent = `${caloriesPct}% of daily goal reached (${workoutCaloriesSum} from workouts, ${stepCalories} estimated steps)`;
  
  // 4. Weekly Workout Target
  const weekRange = getWeekRange(today);
  const weeklyWorkoutLogs = appState.logs.workouts.filter(w => w.date >= weekRange.start && w.date <= weekRange.end);
  const weeklyWorkoutsCount = weeklyWorkoutLogs.length;
  const workoutsGoal = appState.goals.workoutsWeekly;
  const workoutsPct = Math.min(Math.round((weeklyWorkoutsCount / workoutsGoal) * 100), 100);
  
  document.getElementById('stats-workouts-val').innerHTML = `${weeklyWorkoutsCount} <small class="text-unit">this week</small>`;
  document.getElementById('stats-workouts-goal').textContent = `Goal: ${workoutsGoal} workouts`;
  document.getElementById('stats-workouts-bar').style.width = `${workoutsPct}%`;
  document.getElementById('stats-workouts-pct').textContent = `${workoutsPct}% of weekly goal reached (${weekRange.start} to ${weekRange.end})`;
  
  // 5. Update Streaks Dashboard
  const stepStreakVal = calculateStepsStreak();
  const workoutStreakVal = calculateWorkoutStreak();
  const waterStreakVal = calculateWaterStreak();
  
  document.getElementById('streak-steps').textContent = `${stepStreakVal} Day${stepStreakVal !== 1 ? 's' : ''}`;
  document.getElementById('streak-workouts').textContent = `${workoutStreakVal} Day${workoutStreakVal !== 1 ? 's' : ''}`;
  document.getElementById('streak-water').textContent = `${waterStreakVal} Day${waterStreakVal !== 1 ? 's' : ''}`;

  // 6. Recent Activities Feed (Today's activities)
  renderRecentActivitiesFeed(today);
}

function renderRecentActivitiesFeed(targetDate) {
  const container = document.getElementById('activities-list');
  const countSpan = document.getElementById('activities-count');
  container.innerHTML = '';
  
  // Collect activities
  const stepLogs = appState.logs.steps.filter(s => s.date === targetDate);
  const waterLogs = appState.logs.water.filter(w => w.date === targetDate);
  const workoutLogs = appState.logs.workouts.filter(w => w.date === targetDate);
  
  const activities = [];
  
  if (stepLogs.length > 0) {
    const totalSteps = stepLogs.reduce((acc, curr) => acc + curr.value, 0);
    // Combine steps logs into single entry for display simplicity
    activities.push({
      id: stepLogs[0].id, // use first ID for deletion key
      type: 'steps',
      title: `${totalSteps.toLocaleString()} Steps logged`,
      subtext: `Active daily movement (~${Math.round(totalSteps * 0.04)} estimated kcal burned)`,
      time: 'Daily Total'
    });
  }
  
  waterLogs.forEach(w => {
    activities.push({
      id: w.id,
      type: 'water',
      title: `Drank ${w.value} ml`,
      subtext: `Hydrated at ${w.time}`,
      time: w.time
    });
  });
  
  workoutLogs.forEach(w => {
    activities.push({
      id: w.id,
      type: 'workout',
      title: `${w.type} Session`,
      subtext: `${w.duration} min • ${w.calories} kcal burned${w.notes ? ' • ' + w.notes : ''}`,
      time: w.time
    });
  });
  
  // Sort activities: workouts and water by time, steps can be grouped first
  activities.sort((a, b) => {
    if (a.time === 'Daily Total') return -1;
    if (b.time === 'Daily Total') return 1;
    return b.time.localeCompare(a.time); // descending time
  });
  
  countSpan.textContent = `${activities.length} logged activit${activities.length !== 1 ? 'ies' : 'y'} today`;
  
  if (activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-plus" class="empty-icon text-secondary"></i>
        <p>No activity logged yet today. Use the buttons above to log steps, water, or workouts!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  activities.forEach(act => {
    const div = document.createElement('div');
    div.className = 'activity-item';
    
    let iconName = 'footprints';
    let badgeClass = 'badge-steps';
    if (act.type === 'water') {
      iconName = 'droplet';
      badgeClass = 'badge-water';
    } else if (act.type === 'workout') {
      iconName = 'dumbbell';
      badgeClass = 'badge-workout';
    }
    
    div.innerHTML = `
      <div class="activity-meta">
        <div class="activity-icon-badge ${badgeClass}">
          <i data-lucide="${iconName}"></i>
        </div>
        <div class="activity-details">
          <span class="activity-title">${act.title}</span>
          <span class="activity-subtext">${act.subtext}</span>
        </div>
      </div>
      <button class="btn-delete-activity" data-id="${act.id}" title="Delete entry">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    
    container.appendChild(div);
  });
  
  lucide.createIcons();
  
  // Bind delete button listeners
  container.querySelectorAll('.btn-delete-activity').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      deleteLogItem(id);
    });
  });
}

// --- ANALYTICS CHARTS GENERATION ---
let myChartInstance = null;
let currentChartType = 'steps'; // 'steps' | 'water' | 'workouts'

function renderAnalyticsChart() {
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  const past7Days = getPast7Days();
  const displayLabels = past7Days.map(d => formatShortDate(d));
  
  // Destroy previous chart
  if (myChartInstance) {
    myChartInstance.destroy();
  }
  
  let chartDataValues = [];
  let goalValues = [];
  let chartLabel = '';
  let chartColor = '';
  let chartGlow = '';
  let yAxisLabel = '';
  
  if (currentChartType === 'steps') {
    chartLabel = 'Steps logged';
    chartColor = '#00f2fe';
    chartGlow = 'rgba(0, 242, 254, 0.2)';
    yAxisLabel = 'Steps';
    
    past7Days.forEach(date => {
      const logs = appState.logs.steps.filter(s => s.date === date);
      const sum = logs.reduce((acc, curr) => acc + curr.value, 0);
      chartDataValues.push(sum);
      goalValues.push(appState.goals.steps);
    });
    
    // Summary Card values updates
    const sumTotalSteps = chartDataValues.reduce((a,b)=>a+b, 0);
    const avgSteps = Math.round(sumTotalSteps / 7);
    document.getElementById('avg-steps-val').textContent = avgSteps.toLocaleString();
    document.getElementById('avg-steps-lbl').textContent = 'Daily steps average';
    
  } else if (currentChartType === 'water') {
    chartLabel = 'Water intake (ml)';
    chartColor = '#3b82f6';
    chartGlow = 'rgba(59, 130, 246, 0.2)';
    yAxisLabel = 'Volume (ml)';
    
    past7Days.forEach(date => {
      const logs = appState.logs.water.filter(w => w.date === date);
      const sum = logs.reduce((acc, curr) => acc + curr.value, 0);
      chartDataValues.push(sum);
      goalValues.push(appState.goals.water);
    });
    
    // Summary Card values updates
    const sumWaterMl = chartDataValues.reduce((a,b)=>a+b, 0);
    const totalWaterLiters = (sumWaterMl / 1000).toFixed(1);
    document.getElementById('avg-water-val').textContent = `${totalWaterLiters} Liters`;
    document.getElementById('avg-water-lbl').textContent = 'Total week consumption';
    
  } else if (currentChartType === 'workouts') {
    chartLabel = 'Active Calories (kcal)';
    chartColor = '#a855f7';
    chartGlow = 'rgba(168, 85, 247, 0.2)';
    yAxisLabel = 'Energy (kcal)';
    
    past7Days.forEach(date => {
      const wkLogs = appState.logs.workouts.filter(w => w.date === date);
      const workoutCalories = wkLogs.reduce((acc, curr) => acc + curr.calories, 0);
      const stepLogs = appState.logs.steps.filter(s => s.date === date);
      const stepsSum = stepLogs.reduce((acc, curr) => acc + curr.value, 0);
      const estStepCalories = Math.round(stepsSum * 0.04);
      
      chartDataValues.push(workoutCalories + estStepCalories);
      goalValues.push(appState.goals.calories);
    });
    
    // Summary Card values updates
    // Filter workouts in past 7 days specifically
    const weekWorkouts = appState.logs.workouts.filter(w => past7Days.includes(w.date));
    const totalWorkoutCalories = weekWorkouts.reduce((acc, curr) => acc + curr.calories, 0);
    document.getElementById('total-calories-val').textContent = `${totalWorkoutCalories.toLocaleString()} kcal`;
    document.getElementById('total-calories-lbl').textContent = `From ${weekWorkouts.length} workout sessions`;
  }
  
  // Custom font loading styles for Chart.js
  const chartFont = {
    family: 'Outfit',
    size: 12
  };
  
  myChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: chartLabel,
          data: chartDataValues,
          borderColor: chartColor,
          backgroundColor: chartGlow,
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointBackgroundColor: chartColor,
          pointBorderColor: '#070913',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Goal Target',
          data: goalValues,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: chartFont
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit', weight: 'bold' },
          bodyFont: { family: 'Outfit' },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          displayColors: true
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)'
          },
          ticks: {
            color: '#64748b',
            font: chartFont
          }
        },
        y: {
          title: {
            display: true,
            text: yAxisLabel,
            color: '#64748b',
            font: {
              family: 'Outfit',
              weight: 'bold'
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.04)'
          },
          ticks: {
            color: '#64748b',
            font: chartFont
          }
        }
      }
    }
  });
}

// Chart toggle buttons wiring
document.querySelectorAll('[data-chart-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-chart-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentChartType = btn.getAttribute('data-chart-type');
    
    const titleEl = document.getElementById('chart-display-title');
    const descEl = document.getElementById('chart-display-desc');
    
    if (currentChartType === 'steps') {
      titleEl.textContent = "Steps Weekly Analytics";
      descEl.textContent = "Daily step count trends compared to target goal.";
    } else if (currentChartType === 'water') {
      titleEl.textContent = "Water Hydration Analytics";
      descEl.textContent = "Daily liquid intake totals in milliliters compared to goal.";
    } else if (currentChartType === 'workouts') {
      titleEl.textContent = "Active Energy Burned";
      descEl.textContent = "Daily total calories burned (workouts + estimated steps activity) vs goal.";
    }
    
    renderAnalyticsChart();
  });
});

// --- SETTINGS - DATA BACKUP EXPORTS ---

// JSON Backup Exporter
document.getElementById('btn-export-json').addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const today = getLocalDateString();
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `apexfit_backup_${today}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("JSON Backup downloaded successfully!");
});

// CSV Exporter - Workouts list
document.getElementById('btn-export-csv-workouts').addEventListener('click', () => {
  if (appState.logs.workouts.length === 0) {
    showToast("No workout entries available to export.", "error");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID,Date,Time,Type,Duration (minutes),Calories (kcal),Notes\n";
  
  appState.logs.workouts.forEach(w => {
    // Escape quotes in notes
    const escapedNotes = w.notes ? `"${w.notes.replace(/"/g, '""')}"` : "";
    csvContent += `${w.id},${w.date},${w.time},${w.type},${w.duration},${w.calories},${escapedNotes}\n`;
  });
  
  const today = getLocalDateString();
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", encodeURI(csvContent));
  downloadAnchor.setAttribute("download", `apexfit_workouts_${today}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Workouts CSV sheet downloaded.");
});

// CSV Exporter - Daily Steps & Water
document.getElementById('btn-export-csv-daily').addEventListener('click', () => {
  // We collect all dates logged across both steps and water logs
  const datesSet = new Set();
  appState.logs.steps.forEach(s => datesSet.add(s.date));
  appState.logs.water.forEach(w => datesSet.add(w.date));
  
  if (datesSet.size === 0) {
    showToast("No steps or water records available to export.", "error");
    return;
  }
  
  const sortedDates = Array.from(datesSet).sort((a,b) => new Date(b) - new Date(a));
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Date,Total Steps,Steps Calorie Burn (Est),Total Water (ml),Workout Count,Workout Calories\n";
  
  sortedDates.forEach(date => {
    // Calc steps
    const stepLogs = appState.logs.steps.filter(s => s.date === date);
    const stepsSum = stepLogs.reduce((acc, curr) => acc + curr.value, 0);
    const estStepsCal = Math.round(stepsSum * 0.04);
    
    // Calc water
    const waterLogs = appState.logs.water.filter(w => w.date === date);
    const waterSum = waterLogs.reduce((acc, curr) => acc + curr.value, 0);
    
    // Calc workouts
    const workoutLogs = appState.logs.workouts.filter(w => w.date === date);
    const workoutCount = workoutLogs.length;
    const workoutCalSum = workoutLogs.reduce((acc, curr) => acc + curr.calories, 0);
    
    csvContent += `${date},${stepsSum},${estStepsCal},${waterSum},${workoutCount},${workoutCalSum}\n`;
  });
  
  const today = getLocalDateString();
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", encodeURI(csvContent));
  downloadAnchor.setAttribute("download", `apexfit_daily_summary_${today}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Daily Summary CSV sheet downloaded.");
});

// --- SETTINGS - BACKUP IMPORT CONTROLLER ---
const fileInput = document.getElementById('import-file-selector');
const filenameLabel = document.getElementById('import-filename-selected');

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    filenameLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        
        // Simple structural validation
        if (!parsedData.goals || !parsedData.logs) {
          throw new Error("Invalid structure. Missing required database schema.");
        }
        
        // Import confirmation
        if (confirm(`Valid backup file parsed. Proceeding will merge goals and logs. Continue?`)) {
          // Keep current state backup, then merge
          appState = parsedData;
          sanitizeState();
          showToast("Data restoration completed!", "success");
          updateDashboard();
          switchView('dashboard');
          
          // Clear inputs
          fileInput.value = '';
          filenameLabel.textContent = 'No backup file selected';
        }
      } catch (err) {
        showToast(`Import failed: ${err.message}`, "error");
        fileInput.value = '';
        filenameLabel.textContent = 'No backup file selected';
      }
    };
    reader.readAsText(file);
  }
});

// --- APP DATA RESET ---
document.getElementById('btn-reset-app').addEventListener('click', () => {
  openModal('modal-reset-app');
});

document.getElementById('btn-confirm-reset').addEventListener('click', () => {
  localStorage.removeItem('fitness_tracker_data');
  appState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  sanitizeState();
  closeModal('modal-reset-app');
  showToast("Application data reset successfully.", "info");
  
  // Hard reload to clean interface
  setTimeout(() => {
    window.location.reload();
  }, 1000);
});

// --- INITIALIZE APPLICATION STATE ---
document.addEventListener('DOMContentLoaded', () => {
  sanitizeState();
  
  // Set default view
  switchView('dashboard');
  
  // Add some mock data if state is empty so user gets a visual feel immediately!
  const stepsLoggedTotal = appState.logs.steps.length;
  const waterLoggedTotal = appState.logs.water.length;
  const workoutsLoggedTotal = appState.logs.workouts.length;
  
  if (stepsLoggedTotal === 0 && waterLoggedTotal === 0 && workoutsLoggedTotal === 0) {
    // Generate 7 days of realistic mock stats
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);
      
      // Seed steps
      // Give random steps between 6000 and 12000
      const steps = Math.floor(Math.random() * (12000 - 6000 + 1)) + 6000;
      appState.logs.steps.push({
        id: 'st_mock_' + i,
        date: dateStr,
        value: steps
      });
      
      // Seed water
      // Give random water between 1200 and 2400 ml, added in increments
      const dailyWaterTotal = Math.floor(Math.random() * (2400 - 1200 + 1)) + 1200;
      let added = 0;
      let chunkIdx = 0;
      while (added < dailyWaterTotal) {
        const increment = Math.min(250 * (Math.floor(Math.random() * 3) + 1), dailyWaterTotal - added);
        const hour = 8 + chunkIdx * 3;
        appState.logs.water.push({
          id: `wat_mock_${i}_${chunkIdx}`,
          date: dateStr,
          time: `${String(hour).padStart(2,'0')}:15`,
          value: increment
        });
        added += increment;
        chunkIdx++;
      }
      
      // Seed workouts (every other day)
      if (i % 2 === 0) {
        const types = ['Running', 'Strength', 'Cycling', 'Yoga'];
        const mockType = types[i % types.length];
        let duration = 30;
        let calories = 200;
        
        if (mockType === 'Running') { duration = 40; calories = 420; }
        else if (mockType === 'Strength') { duration = 50; calories = 350; }
        else if (mockType === 'Cycling') { duration = 45; calories = 300; }
        else if (mockType === 'Yoga') { duration = 30; calories = 120; }
        
        appState.logs.workouts.push({
          id: 'wk_mock_' + i,
          date: dateStr,
          time: '18:30',
          type: mockType,
          duration: duration,
          calories: calories,
          notes: "Mock data seed workout session."
        });
      }
    }
    saveState();
    updateDashboard();
    showToast("Seeded tracking logs for demo visualizer!");
  } else {
    updateDashboard();
  }
  
  // --- ADDITIONAL INTERACTIVE HANDLERS ---
  
  // Date badge selection listener
  const datePickerHidden = document.getElementById('date-picker-hidden');
  if (datePickerHidden) {
    // Synchronize selector input value with current local time initially
    datePickerHidden.value = activeDate;
    
    datePickerHidden.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected) {
        activeDate = selected;
        updateDashboard();
        showToast(`Switched view to ${formatDisplayDate(selected)}`, 'info');
      }
    });
  }
  
  // Quick Add Steps wire-up
  document.querySelectorAll('.btn-quick-steps').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent card click navigation
      const amount = parseInt(btn.getAttribute('data-amount'));
      const date = activeDate;
      
      const existingIndex = appState.logs.steps.findIndex(s => s.date === date);
      if (existingIndex !== -1) {
        appState.logs.steps[existingIndex].value += amount;
      } else {
        appState.logs.steps.push({
          id: 'st_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
          date: date,
          value: amount
        });
      }
      saveState();
      showToast(`Added ${amount.toLocaleString()} steps.`);
      
      // Trigger interactive steps card splash scale animation
      const stepsCard = document.querySelector('.steps-card');
      if (stepsCard) {
        stepsCard.classList.remove('splash');
        void stepsCard.offsetWidth; // force reflow
        stepsCard.classList.add('splash');
        setTimeout(() => stepsCard.classList.remove('splash'), 600);
      }
      
      updateDashboard();
    });
  });
  
  // Click on cards to navigate to Analytics tab with selected sub-datasets
  const stepsCard = document.querySelector('.steps-card');
  if (stepsCard) {
    stepsCard.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // ignore clicks on action buttons
      switchView('analytics');
      const tabBtn = document.querySelector('[data-chart-type="steps"]');
      if (tabBtn) tabBtn.click();
    });
  }
  
  const waterCard = document.querySelector('.water-card');
  if (waterCard) {
    waterCard.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      switchView('analytics');
      const tabBtn = document.querySelector('[data-chart-type="water"]');
      if (tabBtn) tabBtn.click();
    });
  }
  
  const calorieCard = document.querySelector('.calorie-card');
  if (calorieCard) {
    calorieCard.addEventListener('click', () => {
      switchView('analytics');
      const tabBtn = document.querySelector('[data-chart-type="workouts"]');
      if (tabBtn) tabBtn.click();
    });
  }
  
  const workoutsCard = document.querySelector('.workouts-card');
  if (workoutsCard) {
    workoutsCard.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      switchView('analytics');
      const tabBtn = document.querySelector('[data-chart-type="workouts"]');
      if (tabBtn) tabBtn.click();
    });
  }
});
