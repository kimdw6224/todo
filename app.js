/**
 * To-Do — Production PWA
 * Android-focused To-Do List App
 * 
 * Features:
 *  - Add / Edit / Delete / Complete tasks
 *  - Priority, Category, Reminder per task
 *  - Custom reminder interval (user-defined)
 *  - Browser Notification API with vibration
 *  - Offline-ready (Service Worker)
 *  - LocalStorage persistence
 *  - Splash screen, greeting, progress bar
 *  - Delete confirmation dialog
 */

'use strict';

// ===========================
// State
// ===========================
const STATE_KEY = 'mytasks-v2';

let tasks = [];
let currentFilter = 'all';
let selectedPriority = 'medium';
let selectedReminder = 0;
let isCustomReminder = false;
let editingTaskId = null;
let deletingTaskId = null;
let deletingElement = null;
let reminderTimers = {};

// ===========================
// DOM
// ===========================
const $ = (id) => document.getElementById(id);

const els = {
    greetingText: $('greeting-text'),
    taskList: $('task-list'),
    emptyState: $('empty-state'),
    addTaskBtn: $('add-task-btn'),
    modalOverlay: $('modal-overlay'),
    modalCloseBtn: $('modal-close-btn'),
    modalTitle: $('modal-title'),
    taskForm: $('task-form'),
    taskInput: $('task-input'),
    charCount: $('char-count'),
    taskCategory: $('task-category'),
    prioritySelector: $('priority-selector'),
    reminderSelector: $('reminder-selector'),
    customReminderWrapper: $('custom-reminder-wrapper'),
    customReminderInput: $('custom-reminder-input'),
    filterTabs: $('filter-tabs'),
    statTotal: $('stat-total'),
    statDone: $('stat-done'),
    progressFill: $('progress-fill'),
    submitTaskBtn: $('submit-task-btn'),
    toastContainer: $('toast-container'),
    clearDoneBtn: $('clear-done-btn'),
    themeToggleBtn: $('theme-toggle-btn'),
    themeIconSun: $('theme-icon-sun'),
    themeIconMoon: $('theme-icon-moon'),
    confirmOverlay: $('confirm-overlay'),
    confirmBody: $('confirm-body'),
    confirmCancel: $('confirm-cancel'),
    confirmDelete: $('confirm-delete'),
    countAll: $('count-all'),
    countActive: $('count-active'),
    countCompleted: $('count-completed'),
};

// ===========================
// Init
// ===========================
function init() {
    initTheme();
    loadTasks();
    updateGreeting();
    renderTasks();
    updateStats();
    bindEvents();
    requestNotificationPermission();
    restoreReminders();
    registerServiceWorker();
}

// ===========================
// Theme
// ===========================
const THEME_KEY = 'mytasks-theme';

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'light') {
        els.themeIconSun.style.display = '';
        els.themeIconMoon.style.display = 'none';
    } else {
        els.themeIconSun.style.display = 'none';
        els.themeIconMoon.style.display = '';
    }
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f5f5f5' : '#000000';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ===========================
// Service Worker
// ===========================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => { });
    }
}

// ===========================
// Greeting
// ===========================
function updateGreeting() {
    const hour = new Date().getHours();
    let msg;
    if (hour < 6) msg = '좋은 새벽이에요 🌙';
    else if (hour < 12) msg = '좋은 아침이에요 ☀️';
    else if (hour < 18) msg = '좋은 오후에요 🌤️';
    else msg = '좋은 저녁이에요 🌙';
    els.greetingText.textContent = msg;
}

// ===========================
// Notification
// ===========================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function canNotify() {
    return 'Notification' in window && Notification.permission === 'granted';
}

// ===========================
// Events
// ===========================
function bindEvents() {
    els.addTaskBtn.addEventListener('click', () => openModal());
    els.modalCloseBtn.addEventListener('click', closeModal);
    els.modalOverlay.addEventListener('click', (e) => {
        if (e.target === els.modalOverlay) closeModal();
    });

    // Theme toggle
    els.themeToggleBtn.addEventListener('click', toggleTheme);

    // Char count
    els.taskInput.addEventListener('input', () => {
        els.charCount.textContent = els.taskInput.value.length;
    });

    // Priority
    els.prioritySelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.priority-btn');
        if (!btn) return;
        els.prioritySelector.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPriority = btn.dataset.priority;
    });

    // Reminder
    els.reminderSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.reminder-btn');
        if (!btn) return;
        els.reminderSelector.querySelectorAll('.reminder-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.reminder;
        if (val === 'custom') {
            isCustomReminder = true;
            els.customReminderWrapper.style.display = 'flex';
            els.customReminderInput.focus();
            selectedReminder = parseInt(els.customReminderInput.value, 10) || 0;
        } else {
            isCustomReminder = false;
            els.customReminderWrapper.style.display = 'none';
            els.customReminderInput.value = '';
            selectedReminder = parseInt(val, 10);
        }
    });

    els.customReminderInput.addEventListener('input', () => {
        const v = parseInt(els.customReminderInput.value, 10);
        selectedReminder = (v > 0 && v <= 1440) ? v : 0;
    });

    // Submit
    els.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        editingTaskId ? saveEditedTask() : addTask();
    });

    // Filters
    els.filterTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        els.filterTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderTasks();
    });

    // Task actions
    els.taskList.addEventListener('click', (e) => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        const id = taskItem.dataset.id;

        if (e.target.closest('.task-checkbox')) toggleTask(id);
        else if (e.target.closest('.delete-btn')) showDeleteConfirm(id, taskItem);
        else if (e.target.closest('.reminder-toggle-btn')) toggleReminder(id);
        else if (e.target.closest('.edit-btn')) openEditModal(id);
    });

    // Clear done
    els.clearDoneBtn.addEventListener('click', clearCompletedTasks);

    // Delete confirm
    els.confirmCancel.addEventListener('click', hideDeleteConfirm);
    els.confirmDelete.addEventListener('click', () => {
        if (deletingTaskId && deletingElement) {
            deleteTask(deletingTaskId, deletingElement);
        }
        hideDeleteConfirm();
    });
    els.confirmOverlay.addEventListener('click', (e) => {
        if (e.target === els.confirmOverlay) hideDeleteConfirm();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (els.confirmOverlay.classList.contains('active')) hideDeleteConfirm();
            else closeModal();
        }
    });
}

// ===========================
// Modal
// ===========================
function openModal(taskToEdit = null) {
    editingTaskId = null;
    els.modalOverlay.classList.add('active');

    if (taskToEdit) {
        editingTaskId = taskToEdit.id;
        els.modalTitle.textContent = '할 일 수정';
        els.submitTaskBtn.textContent = '저장하기';
        els.taskInput.value = taskToEdit.text;
        els.charCount.textContent = taskToEdit.text.length;
        els.taskCategory.value = taskToEdit.category;
        selectedPriority = taskToEdit.priority;
        els.prioritySelector.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
        els.prioritySelector.querySelector(`[data-priority="${taskToEdit.priority}"]`).classList.add('active');
        selectedReminder = taskToEdit.reminderMinutes;
        setReminderUI(taskToEdit.reminderMinutes);
    } else {
        els.modalTitle.textContent = '새로운 할 일';
        els.submitTaskBtn.textContent = '추가하기';
        els.taskInput.value = '';
        els.charCount.textContent = '0';
        els.taskCategory.value = 'none';
        selectedPriority = 'medium';
        selectedReminder = 0;
        isCustomReminder = false;
        els.prioritySelector.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
        els.prioritySelector.querySelector('[data-priority="medium"]').classList.add('active');
        setReminderUI(0);
    }

    setTimeout(() => els.taskInput.focus(), 400);
}

function openEditModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) openModal(task);
}

function setReminderUI(minutes) {
    const presets = [0, 5, 10, 15, 30, 60];
    els.reminderSelector.querySelectorAll('.reminder-btn').forEach(b => b.classList.remove('active'));

    if (presets.includes(minutes)) {
        isCustomReminder = false;
        els.customReminderWrapper.style.display = 'none';
        els.customReminderInput.value = '';
        const btn = els.reminderSelector.querySelector(`[data-reminder="${minutes}"]`);
        if (btn) btn.classList.add('active');
    } else if (minutes > 0) {
        isCustomReminder = true;
        els.customReminderWrapper.style.display = 'flex';
        els.customReminderInput.value = minutes;
        const btn = els.reminderSelector.querySelector('[data-reminder="custom"]');
        if (btn) btn.classList.add('active');
    } else {
        isCustomReminder = false;
        els.customReminderWrapper.style.display = 'none';
        els.customReminderInput.value = '';
        els.reminderSelector.querySelector('[data-reminder="0"]').classList.add('active');
    }
}

function closeModal() {
    els.modalOverlay.classList.remove('active');
    editingTaskId = null;
}

// ===========================
// Delete Confirmation
// ===========================
function showDeleteConfirm(id, element) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    deletingTaskId = id;
    deletingElement = element;
    els.confirmBody.textContent = `"${task.text}"`;
    els.confirmOverlay.classList.add('active');
}

function hideDeleteConfirm() {
    els.confirmOverlay.classList.remove('active');
    deletingTaskId = null;
    deletingElement = null;
}

// ===========================
// CRUD
// ===========================
function addTask() {
    const text = els.taskInput.value.trim();
    if (!text) return;

    if (isCustomReminder) selectedReminder = parseInt(els.customReminderInput.value, 10) || 0;

    const task = {
        id: genId(),
        text,
        priority: selectedPriority,
        category: els.taskCategory.value,
        reminderMinutes: selectedReminder,
        reminderActive: selectedReminder > 0,
        completed: false,
        createdAt: Date.now(),
    };

    tasks.unshift(task);
    save();
    renderTasks();
    updateStats();
    closeModal();

    if (task.reminderActive) {
        startReminder(task);
        showToast('알림 설정됨', `${fmtReminder(task.reminderMinutes)}마다 알림`);
    }
}

function saveEditedTask() {
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;

    const text = els.taskInput.value.trim();
    if (!text) return;

    if (isCustomReminder) selectedReminder = parseInt(els.customReminderInput.value, 10) || 0;

    const oldMin = task.reminderMinutes;
    task.text = text;
    task.priority = selectedPriority;
    task.category = els.taskCategory.value;
    task.reminderMinutes = selectedReminder;

    if (task.reminderMinutes !== oldMin) {
        stopReminder(task.id);
        task.reminderActive = task.reminderMinutes > 0;
        if (task.reminderActive && !task.completed) {
            startReminder(task);
            showToast('알림 변경됨', `${fmtReminder(task.reminderMinutes)}마다 알림`);
        }
    }

    save();
    renderTasks();
    updateStats();
    closeModal();
    showToast('수정 완료', '할 일이 수정되었습니다');
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    if (task.completed && reminderTimers[id]) {
        stopReminder(id);
        task.reminderActive = false;
    }
    save();
    renderTasks();
    updateStats();
}

function deleteTask(id, element) {
    stopReminder(id);
    element.classList.add('removing');
    element.addEventListener('animationend', () => {
        tasks = tasks.filter(t => t.id !== id);
        save();
        renderTasks();
        updateStats();
    });
}

function clearCompletedTasks() {
    const doneCount = tasks.filter(t => t.completed).length;
    if (doneCount === 0) {
        showToast('완료된 항목 없음', '정리할 항목이 없습니다');
        return;
    }
    tasks.filter(t => t.completed).forEach(t => stopReminder(t.id));
    tasks = tasks.filter(t => !t.completed);
    save();
    renderTasks();
    updateStats();
    showToast('정리 완료', `${doneCount}개 항목을 삭제했습니다`);
}

function toggleReminder(id) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.completed) return;

    if (task.reminderMinutes === 0) {
        showToast('알림 미설정', '수정 버튼을 눌러 알림을 설정하세요');
        return;
    }

    task.reminderActive = !task.reminderActive;
    if (task.reminderActive) {
        startReminder(task);
        showToast('알림 켜짐', `${fmtReminder(task.reminderMinutes)}마다 알림`);
    } else {
        stopReminder(id);
        showToast('알림 꺼짐', '알림이 중지되었습니다');
    }
    save();
    renderTasks();
}

// ===========================
// Reminder System
// ===========================
function startReminder(task) {
    stopReminder(task.id);
    const ms = task.reminderMinutes * 60 * 1000;
    reminderTimers[task.id] = setInterval(() => {
        sendNotification(task);
        showToast('⏰ 할 일 알림', task.text);
    }, ms);
}

function stopReminder(id) {
    if (reminderTimers[id]) { clearInterval(reminderTimers[id]); delete reminderTimers[id]; }
}

function restoreReminders() {
    tasks.forEach(t => {
        if (t.reminderActive && !t.completed && t.reminderMinutes > 0) startReminder(t);
    });
}

function sendNotification(task) {
    if (!canNotify()) return;
    const pLabel = { low: '낮음', medium: '보통', high: '높음' };
    new Notification('📋 To-Do', {
        body: `${task.text}\n우선순위: ${pLabel[task.priority] || task.priority}`,
        tag: `task-${task.id}`,
        renotify: true,
        vibrate: [200, 100, 200],
        badge: '/icons/icon-96.png',
    });
}

// ===========================
// Toast
// ===========================
function showToast(title, body) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 01-3.46 0"></path>
        </svg>
        <div class="toast-content">
            <div class="toast-title">${esc(title)}</div>
            <div class="toast-body">${esc(body)}</div>
        </div>
        <button class="toast-close" aria-label="닫기">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>`;
    t.querySelector('.toast-close').addEventListener('click', () => dismissToast(t));
    els.toastContainer.appendChild(t);
    setTimeout(() => dismissToast(t), 3500);
}

function dismissToast(t) {
    if (!t.parentNode) return;
    t.classList.add('removing');
    t.addEventListener('animationend', () => t.remove());
}

// ===========================
// Rendering
// ===========================
function renderTasks() {
    const filtered = getFiltered();
    if (filtered.length === 0) {
        els.taskList.innerHTML = '';
        els.emptyState.classList.remove('hidden');
        updateEmptyMsg();
        return;
    }
    els.emptyState.classList.add('hidden');
    els.taskList.innerHTML = filtered.map(createTaskHTML).join('');
}

function createTaskHTML(task) {
    const cat = task.category !== 'none'
        ? `<span class="task-category-badge">${getCatLabel(task.category)}</span>` : '';

    const rem = task.reminderMinutes > 0
        ? `<span class="task-reminder-badge ${task.reminderActive ? 'active-reminder' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>${fmtReminder(task.reminderMinutes)}</span>` : '';

    const bellFill = task.reminderActive ? 'currentColor' : 'none';
    const bellClass = task.reminderActive && !task.completed ? 'active-bell' : '';

    return `
    <li class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}" data-priority="${task.priority}">
        <div class="task-checkbox ${task.completed ? 'checked' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        </div>
        <div class="task-content">
            <span class="task-text">${esc(task.text)}</span>
            ${(cat || rem) ? `<div class="task-meta">${cat}${rem}</div>` : ''}
        </div>
        <div class="task-actions">
            <button class="edit-btn" aria-label="수정">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </button>
            <button class="reminder-toggle-btn ${bellClass}" aria-label="알림">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${bellFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
            </button>
            <button class="delete-btn" aria-label="삭제">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
            </button>
        </div>
    </li>`;
}

function updateEmptyMsg() {
    const t = els.emptyState.querySelector('.empty-title');
    const s = els.emptyState.querySelector('.empty-subtitle');
    switch (currentFilter) {
        case 'active':
            t.textContent = '진행중인 할 일이 없어요';
            s.textContent = '모든 할 일을 완료했네요! 🎉';
            break;
        case 'completed':
            t.textContent = '완료된 할 일이 없어요';
            s.textContent = '할 일을 완료하면 여기에 나타납니다';
            break;
        default:
            t.textContent = '할 일이 없습니다';
            s.textContent = '+ 버튼을 눌러 새로운 할 일을 추가하세요';
    }
}

function updateStats() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const active = total - done;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    els.statTotal.textContent = `${total}개 할 일`;
    els.statDone.textContent = `${done}개 완료`;
    els.progressFill.style.width = `${pct}%`;

    els.countAll.textContent = total;
    els.countActive.textContent = active;
    els.countCompleted.textContent = done;
}

// ===========================
// Filtering
// ===========================
function getFiltered() {
    switch (currentFilter) {
        case 'active': return tasks.filter(t => !t.completed);
        case 'completed': return tasks.filter(t => t.completed);
        default: return [...tasks];
    }
}

// ===========================
// Persistence
// ===========================
function save() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(tasks)); } catch (e) { }
}

function loadTasks() {
    try {
        const d = localStorage.getItem(STATE_KEY);
        tasks = d ? JSON.parse(d) : [];
        tasks.forEach(t => {
            if (t.reminderMinutes === undefined) t.reminderMinutes = 0;
            if (t.reminderActive === undefined) t.reminderActive = false;
        });
    } catch (e) { tasks = []; }
}

// ===========================
// Utilities
// ===========================
function genId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 8); }

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function getCatLabel(c) {
    return { work: '💼 업무', personal: '👤 개인', shopping: '🛒 쇼핑', health: '💪 건강' }[c] || c;
}

function fmtReminder(m) {
    if (m >= 60) { const h = m / 60; return h === Math.floor(h) ? `${h}시간` : `${m}분`; }
    return `${m}분`;
}

// ===========================
// Start
// ===========================
document.addEventListener('DOMContentLoaded', init);
