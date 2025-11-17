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

    // GitHub Config Modal
    const modal = document.getElementById('githubConfigModal');
    const configBtn = document.getElementById('githubConfigBtn');
    const syncBtn = document.getElementById('githubSyncBtn');
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancelGitHubConfig');
    const saveBtn = document.getElementById('saveGitHubConfig');
    const testBtn = document.getElementById('testGitHubConnection');
    const statusDiv = document.getElementById('githubConfigStatus');

    // Debug: Check if elements are found
    console.log('GitHub modal elements:', {
        modal: !!modal,
        configBtn: !!configBtn,
        syncBtn: !!syncBtn,
        testBtn: !!testBtn,
        statusDiv: !!statusDiv
    });

    // Open modal
    if (configBtn) {
        configBtn.addEventListener('click', async () => {
            modal.style.display = 'block';
            const config = await loadGitHubConfig();
            document.getElementById('githubOwner').value = config.owner || '';
            document.getElementById('githubRepo').value = config.repo || '';
            document.getElementById('githubToken').value = '';
            statusDiv.className = 'status-message';
            statusDiv.style.display = 'none';
        });
    }

    // Close modal
    function closeModal() {
        modal.style.display = 'none';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save configuration
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const owner = document.getElementById('githubOwner').value.trim();
            const repo = document.getElementById('githubRepo').value.trim();
            const token = document.getElementById('githubToken').value.trim();

            if (!owner || !repo) {
                statusDiv.className = 'status-message error';
                statusDiv.textContent = 'Please enter both owner and repository name';
                statusDiv.style.display = 'block';
                return;
            }

            try {
                await saveGitHubConfig(owner, repo, token);
                statusDiv.className = 'status-message success';
                statusDiv.textContent = 'Configuration saved successfully!';
                statusDiv.style.display = 'block';
            } catch (error) {
                statusDiv.className = 'status-message error';
                statusDiv.textContent = `Error: ${error.message}`;
                statusDiv.style.display = 'block';
            }
        });
    }

    // Test connection
    if (testBtn) {
        console.log('Test button found, attaching click handler');
        testBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                console.log('Test connection button clicked');
                
                if (!statusDiv) {
                    console.error('Status div not found!');
                    alert('Error: Status div not found. Please refresh the page.');
                    return;
                }
                
                const ownerInput = document.getElementById('githubOwner');
                const repoInput = document.getElementById('githubRepo');
                const tokenInput = document.getElementById('githubToken');
                
                if (!ownerInput || !repoInput) {
                    console.error('Form inputs not found!');
                    alert('Error: Form inputs not found. Please refresh the page.');
                    return;
                }
                
                const owner = ownerInput.value.trim();
                const repo = repoInput.value.trim();
                const token = tokenInput ? tokenInput.value.trim() : '';

                console.log('Form values:', { owner, repo, token: token ? '***' : '' });

                if (!owner || !repo) {
                    statusDiv.className = 'status-message error';
                    statusDiv.textContent = 'Please enter both owner and repository name';
                    statusDiv.style.display = 'block';
                    return;
                }

                // Save config first
                console.log('Saving GitHub config...');
                try {
                    await saveGitHubConfig(owner, repo, token);
                    console.log('Config saved');
                } catch (saveError) {
                    console.error('Error saving config:', saveError);
                    statusDiv.className = 'status-message error';
                    statusDiv.textContent = `Error saving config: ${saveError.message}`;
                    statusDiv.style.display = 'block';
                    return;
                }

                statusDiv.className = 'status-message';
                statusDiv.textContent = 'Testing connection...';
                statusDiv.style.display = 'block';

                console.log('Testing GitHub connection...');
                const result = await testGitHubConnection(owner, repo, token);
                console.log('Test result:', result);
                
                if (result && result.success) {
                    statusDiv.className = 'status-message success';
                    statusDiv.textContent = `Connection successful! Found ${result.count} issues.`;
                } else {
                    statusDiv.className = 'status-message error';
                    statusDiv.textContent = `Connection failed: ${result ? result.message : 'Unknown error'}`;
                }
                statusDiv.style.display = 'block';
            } catch (error) {
                console.error('Error in test connection:', error);
                if (statusDiv) {
                    statusDiv.className = 'status-message error';
                    statusDiv.textContent = `Error: ${error.message || 'Unknown error occurred'}`;
                    statusDiv.style.display = 'block';
                } else {
                    alert(`Error: ${error.message || 'Unknown error occurred'}`);
                }
            }
        });
    } else {
        console.error('Test button not found! Button ID: testGitHubConnection');
    }

    // Sync button
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            if (confirm('This will sync GitHub issues into your task tracker. Continue?')) {
                syncBtn.disabled = true;
                syncBtn.textContent = 'Syncing...';
                try {
                    await syncGitHubIssues();
                } finally {
                    syncBtn.disabled = false;
                    syncBtn.textContent = '🔄 Sync GitHub';
                }
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

// GitHub Integration Functions
async function loadGitHubConfig() {
    try {
        const response = await fetch('/api/github/config');
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('Error loading GitHub config:', error);
        return { owner: '', repo: '' };
    }
}

async function saveGitHubConfig(owner, repo, token) {
    try {
        console.log('Sending POST to /api/github/config with:', { owner, repo, token: token ? '***' : '' });
        const response = await fetch('/api/github/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ owner, repo, token })
        });
        
        console.log('Response status:', response.status, response.statusText);
        console.log('Response headers:', response.headers.get('content-type'));
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response received:', text.substring(0, 200));
            throw new Error(`Server returned ${response.status}: Expected JSON but got ${contentType || 'unknown'}`);
        }
        
        const result = await response.json();
        console.log('Config save result:', result);
        return result;
    } catch (error) {
        console.error('Error saving GitHub config:', error);
        throw error;
    }
}

async function syncGitHubIssues() {
    try {
        const response = await fetch('/api/github/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to sync GitHub issues');
        }
        
        const result = await response.json();
        
        // Reload tasks after sync
        await loadTasks();
        
        // Reinitialize story items to include the new GitHub story
        initializeStoryItems();
        attachStoryItemEvents();
        
        // Switch to the GitHub story if it exists
        const stories = document.querySelectorAll('.story-item');
        let githubStoryFound = false;
        stories.forEach(story => {
            if (story.textContent.includes('GitHub:')) {
                story.click();
                githubStoryFound = true;
            }
        });
        
        if (!githubStoryFound && stories.length > 0) {
            // If no GitHub story found, just render the first story
            stories[0].click();
        }
        
        alert(`Successfully synced ${result.synced} issues from GitHub!`);
    } catch (error) {
        console.error('Error syncing GitHub issues:', error);
        alert(`Error syncing GitHub issues: ${error.message}`);
    }
}

async function testGitHubConnection(owner, repo, token) {
    try {
        console.log('Fetching GitHub issues from API...');
        const response = await fetch('/api/github/issues');
        console.log('Response status:', response.status, response.statusText);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            // Handle error response
            const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
            console.error('GitHub API error:', errorMessage);
            return { success: false, message: errorMessage };
        }
        
        return { success: true, count: data.count || 0 };
    } catch (error) {
        console.error('Error in testGitHubConnection:', error);
        return { 
            success: false, 
            message: error.message || 'Failed to connect to GitHub API. Check console for details.' 
        };
    }
}
