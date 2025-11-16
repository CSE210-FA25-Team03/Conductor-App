// Global variables
let storyData = {};
let membersList = [];

// Initialize: Load tasks and members from API
document.addEventListener("DOMContentLoaded", async () => {
    const profileImg = document.getElementById('dashboardProfileImg');
    const dropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    if (profileImg && dropdown) {
        profileImg.addEventListener('mouseenter', () => dropdown.style.display = 'block');
        profileImg.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!dropdown.matches(':hover')) dropdown.style.display = 'none';
            }, 150);
        });

        dropdown.addEventListener('mouseenter', () => dropdown.style.display = 'block');
        dropdown.addEventListener('mouseleave', () => dropdown.style.display = 'none');
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/login';
        });
    }

    // Load members and tasks from API
    await loadMembers();
    await loadTasks();
    
    // Initialize story items from loaded data
    initializeStoryItems();
    attachStoryItemEvents();
    
    // Render the first story if available
    const firstStory = document.querySelector(".story-item.active");
    if (firstStory) {
        renderStory(firstStory.textContent.trim());
    }

    // Task add button handlers
    document.querySelectorAll('.task-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const column = btn.closest('.task-column');
            const list = column.querySelector('.task-list');
            const activeStory = document.querySelector(".story-item.active")?.textContent.trim();
            
            if (!activeStory) return;
            
            // Initialize story if it doesn't exist
            if (!storyData[activeStory]) {
                storyData[activeStory] = { todo: [], progress: [], done: [] };
            }

            let group = "";
            if (column.classList.contains("todo-col")) group = "todo";
            if (column.classList.contains("progress-col")) group = "progress";
            if (column.classList.contains("done-col")) group = "done";

            const taskObj = { title: "New Task", badge: "medium", due: "TBD", assignee: "None" };
            storyData[activeStory][group].push(taskObj);
            saveTasks();

            const newCard = createTaskCard(taskObj, activeStory, group);
            list.appendChild(newCard);
            activateDragAndDrop();
            newCard.querySelector('.task-title').focus();
        });
    });

    // Story add button
    const storyAddBtn = document.querySelector('.story-add-btn');
    if (storyAddBtn) {
        storyAddBtn.addEventListener('click', () => {
            const storyList = document.querySelector('.story-list');
            const number = storyList.querySelectorAll('.story-item').length + 1;
            const name = `Story Point ${number}`;

            const newStory = document.createElement('div');
            newStory.classList.add('story-item');
            newStory.textContent = name;

            storyList.insertBefore(newStory, storyAddBtn);
            document.querySelectorAll('.story-item').forEach(s => s.classList.remove('active'));
            newStory.classList.add('active');

            storyData[name] = { todo: [], progress: [], done: [] };
            saveTasks();

            renderStory(name);
            attachStoryItemEvents();
            enableStoryRename(newStory);
        });
    }

    // Back dashboard button
    const backBtn = document.getElementById('backDashboard');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();

            const role = localStorage.getItem('role');

            if (role === 'professor') {
                window.location.href = '/dashboards/professor.html';
            } else if (role === 'Teaching Assistant') {
                window.location.href = '/dashboards/ta.html';
            } else if (role === 'student') {
                window.location.href = '/dashboards/student.html';
            } else {
                window.location.href = '/dashboards/team_lead.html';
            }
        });
    }
});

// Load members from API
async function loadMembers() {
    try {
        const response = await fetch('/api/members');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        membersList = await response.json();
        console.log('Members loaded:', membersList.length, 'members');
        if (membersList.length === 0) {
            console.warn('Warning: No members found in API response');
        }
    } catch (error) {
        console.error('Error loading members:', error);
        membersList = [];
    }
}

// Load tasks from API
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        storyData = await response.json();
        
        // If no data, initialize with default structure
        if (!storyData || Object.keys(storyData).length === 0) {
            storyData = {
                "Sprint Board Feature": { todo: [], progress: [], done: [] },
                "Implement form validation": { todo: [], progress: [], done: [] }
            };
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        storyData = {
            "Sprint Board Feature": { todo: [], progress: [], done: [] },
            "Implement form validation": { todo: [], progress: [], done: [] }
        };
    }
}

// Save tasks to API
async function saveTasks() {
    try {
        await fetch('/api/tasks', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(storyData)
        });
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
}

// Initialize story items in the UI
function initializeStoryItems() {
    const storyList = document.querySelector('.story-list');
    const storyAddBtn = document.querySelector('.story-add-btn');
    
    // Clear existing story items (except the add button)
    const existingItems = storyList.querySelectorAll('.story-item');
    existingItems.forEach(item => item.remove());
    
    // Add story items from loaded data
    Object.keys(storyData).forEach((storyName, index) => {
        const storyItem = document.createElement('div');
        storyItem.classList.add('story-item');
        if (index === 0) {
            storyItem.classList.add('active');
        }
        storyItem.textContent = storyName;
        storyList.insertBefore(storyItem, storyAddBtn);
    });
}

let draggedCard = null;

function activateDragAndDrop() {
    document.querySelectorAll('.task-card').forEach(card => {
        if (card.dataset.dragReady === "true") return;
        card.dataset.dragReady = "true";
        card.setAttribute('draggable', true);

        card.addEventListener('dragstart', () => {
            draggedCard = card;
            card.style.opacity = "0.3";
        });

        card.addEventListener('dragend', () => {
            card.style.opacity = "1";
            draggedCard = null;
        });
    });
}

document.querySelectorAll('.task-column').forEach(column => {
    column.addEventListener('dragover', e => {
        e.preventDefault();
        column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
    });

    column.addEventListener('drop', () => {
        column.classList.remove('drag-over');
        if (!draggedCard) return;

        const list = column.querySelector('.task-list');
        const activeStory = document.querySelector(".story-item.active")?.textContent.trim();
        if (!activeStory) return;
        
        const taskObj = getTaskDataFromCard(draggedCard);
        const oldTitle = draggedCard.dataset.originalTitle;

        removeTaskFromData(activeStory, oldTitle);

        let group = "";
        if (column.classList.contains("todo-col")) group = "todo";
        if (column.classList.contains("progress-col")) group = "progress";
        if (column.classList.contains("done-col")) {
            group = "done";
            taskObj.due = "Completed";
            const dueElement = draggedCard.querySelector(".task-due");
            if (dueElement) {
                dueElement.textContent = "Due: Completed";
            }
        }

        draggedCard.dataset.originalTitle = taskObj.title;
        addTaskToData(activeStory, group, taskObj);
        saveTasks();

        list.appendChild(draggedCard);
        activateDragAndDrop();
        enableTaskAutoSave(draggedCard, activeStory, group);
        updateTaskBoldStyle(draggedCard, taskObj.assignee);
    });
});

function createTaskCard(task, storyName, group) {
    const card = document.createElement("div");
    card.classList.add("task-card");
    card.setAttribute("draggable", "true");
    card.dataset.originalTitle = task.title;

    // Build options HTML for members dropdown
    // Debug: Log if membersList is empty
    if (!membersList || membersList.length === 0) {
        console.warn('createTaskCard: membersList is empty or not loaded yet');
    }
    
    const memberOptions = membersList && membersList.length > 0 
        ? membersList.map(m => 
            `<option value="${m.name}" ${task.assignee === m.name ? 'selected' : ''}>${m.name}</option>`
        ).join('')
        : '';

    card.innerHTML = `
        <div class="task-title" contenteditable="true">${task.title}</div>
        <div class="task-meta">
            <span class="task-badge ${task.badge}" contenteditable="true">${task.badge}</span>
            <span class="task-due" contenteditable="true">Due: ${task.due}</span>
            <div class="task-assignee-wrapper">
                <span class="task-assignee-label">Assigned to:</span>
                <select class="task-assignee-select">
                    <option value="None" ${!task.assignee || task.assignee === "None" ? 'selected' : ''}>None</option>
                    ${memberOptions}
                </select>
            </div>
        </div>
    `;

    // Add event listener for assignee dropdown
    const assigneeSelectElement = card.querySelector('.task-assignee-select');
    assigneeSelectElement.addEventListener('change', () => {
        const updated = getTaskDataFromCard(card);
        const arr = storyData[storyName][group];
        const index = arr.findIndex(t => t.title === card.dataset.originalTitle);

        if (index !== -1) {
            arr[index] = updated;
            card.dataset.originalTitle = updated.title;
            saveTasks();
            updateTaskBoldStyle(card, updated.assignee);
        }
    });

    // Apply bold style if assigned
    updateTaskBoldStyle(card, task.assignee);

    enableTaskAutoSave(card, storyName, group);
    return card;
}

function updateTaskBoldStyle(card, assignee) {
    const titleElement = card.querySelector('.task-title');
    if (titleElement) {
        if (assignee && assignee !== "None") {
            titleElement.style.fontWeight = 'bold';
        } else {
            titleElement.style.fontWeight = 'normal';
        }
    }
}

function enableTaskAutoSave(card, storyName, group) {
    const fields = card.querySelectorAll("[contenteditable='true']");
    fields.forEach(field => {
        field.addEventListener("blur", () => {
            const updated = getTaskDataFromCard(card);
            const arr = storyData[storyName][group];
            const index = arr.findIndex(t => t.title === card.dataset.originalTitle);

            if (index !== -1) {
                arr[index] = updated;
                card.dataset.originalTitle = updated.title;
                saveTasks();
                updateTaskBoldStyle(card, updated.assignee);
            }
        });
    });
}

function renderStory(storyName) {
    if (!storyData[storyName]) {
        storyData[storyName] = { todo: [], progress: [], done: [] };
    }
    
    const data = storyData[storyName];

    const todo = document.querySelector(".todo-col .task-list");
    const prog = document.querySelector(".progress-col .task-list");
    const done = document.querySelector(".done-col .task-list");

    if (!todo || !prog || !done) return;

    todo.innerHTML = "";
    prog.innerHTML = "";
    done.innerHTML = "";

    data.todo.forEach(t => todo.appendChild(createTaskCard(t, storyName, "todo")));
    data.progress.forEach(t => prog.appendChild(createTaskCard(t, storyName, "progress")));
    data.done.forEach(t => done.appendChild(createTaskCard(t, storyName, "done")));

    activateDragAndDrop();
}

function attachStoryItemEvents() {
    document.querySelectorAll(".story-item").forEach(item => {
        item.onclick = () => {
            document.querySelectorAll(".story-item").forEach(s => s.classList.remove("active"));
            item.classList.add("active");
            renderStory(item.textContent.trim());
        };
        enableStoryRename(item);
    });
}

function enableStoryRename(item) {
    item.addEventListener("dblclick", () => {
        const oldName = item.textContent.trim();
        item.setAttribute("contenteditable", "true");
        item.focus();

        item.addEventListener("blur", function onBlur() {
            const newName = item.textContent.trim() || oldName;

            if (newName !== oldName) {
                storyData[newName] = storyData[oldName];
                delete storyData[oldName];
                saveTasks();
            }

            item.removeAttribute("contenteditable");
            item.removeEventListener("blur", onBlur);
        });
    });
}

function removeTaskFromData(storyName, title) {
    if (!storyData[storyName]) return;
    ["todo", "progress", "done"].forEach(g => {
        if (storyData[storyName][g]) {
            storyData[storyName][g] = storyData[storyName][g].filter(t => t.title !== title);
        }
    });
}

function addTaskToData(storyName, group, task) {
    if (!storyData[storyName]) {
        storyData[storyName] = { todo: [], progress: [], done: [] };
    }
    storyData[storyName][group].push(task);
}

function getTaskDataFromCard(card) {
    const assigneeSelect = card.querySelector('.task-assignee-select');
    const assignee = assigneeSelect ? assigneeSelect.value : "None";
    
    return {
        title: card.querySelector(".task-title").textContent.trim(),
        badge: card.querySelector(".task-badge").textContent.trim(),
        due: card.querySelector(".task-due").textContent.replace("Due:", "").trim(),
        assignee: assignee
    };
}
