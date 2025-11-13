document.addEventListener("DOMContentLoaded", () => {
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
});

let storyData = {
    "Sprint Board Feature": {
        todo: [
            { title: "Design wireframe", badge: "medium", due: "Feb 22", assignee: "Grace Ito" }
        ],
        progress: [
            { title: "Backend linking", badge: "hard", due: "Feb 24", assignee: "Lucas Nguyen" }
        ],
        done: [
            { title: "Setup repo", badge: "easy", due: "Completed", assignee: "Jordan Patel" }
        ]
    },
    "Implement form validation": { todo: [], progress: [], done: [] },
    "Story Point 3": { todo: [], progress: [], done: [] },
    "Story Point 4": { todo: [], progress: [], done: [] }
};

document.querySelectorAll('.task-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {

        const column = btn.closest('.task-column');
        const list = column.querySelector('.task-list');
        const activeStory = document.querySelector(".story-item.active").textContent.trim();

        let group = "";
        if (column.classList.contains("todo-col")) group = "todo";
        if (column.classList.contains("progress-col")) group = "progress";
        if (column.classList.contains("done-col")) group = "done";

        const taskObj = { title: "New Task", badge: "medium", due: "TBD", assignee: "None" };
        storyData[activeStory][group].push(taskObj);

        const newCard = createTaskCard(taskObj, activeStory, group);
        list.appendChild(newCard);
        activateDragAndDrop();
        newCard.querySelector('.task-title').focus();
    });
});

const storyList = document.querySelector('.story-list');
const storyAddBtn = document.querySelector('.story-add-btn');

storyAddBtn.addEventListener('click', () => {
    const number = storyList.querySelectorAll('.story-item').length + 1;
    const name = `Story Point ${number}`;

    const newStory = document.createElement('div');
    newStory.classList.add('story-item');
    newStory.textContent = name;

    storyList.insertBefore(newStory, storyAddBtn);
    document.querySelectorAll('.story-item').forEach(s => s.classList.remove('active'));
    newStory.classList.add('active');

    storyData[name] = { todo: [], progress: [], done: [] };

    renderStory(name);
    attachStoryItemEvents();
    enableStoryRename(newStory);
});

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
        const activeStory = document.querySelector(".story-item.active").textContent.trim();
        const taskObj = getTaskDataFromCard(draggedCard);
        const oldTitle = draggedCard.dataset.originalTitle;

        removeTaskFromData(activeStory, oldTitle);

        let group = "";
        if (column.classList.contains("todo-col")) group = "todo";
        if (column.classList.contains("progress-col")) group = "progress";
        if (column.classList.contains("done-col")) {
            group = "done";
            taskObj.due = "Completed";
            draggedCard.querySelector(".task-due").textContent = "Due: Completed";
        }

        draggedCard.dataset.originalTitle = taskObj.title;
        addTaskToData(activeStory, group, taskObj);

        list.appendChild(draggedCard);
        activateDragAndDrop();
        enableTaskAutoSave(draggedCard, activeStory, group);
    });
});

function createTaskCard(task, storyName, group) {
    const card = document.createElement("div");
    card.classList.add("task-card");
    card.setAttribute("draggable", "true");
    card.dataset.originalTitle = task.title;

    card.innerHTML = `
        <div class="task-title" contenteditable="true">${task.title}</div>
        <div class="task-meta">
            <span class="task-badge ${task.badge}" contenteditable="true">${task.badge}</span>
            <span class="task-due" contenteditable="true">Due: ${task.due}</span>
            <span class="task-assignee" contenteditable="true">Assigned to: ${task.assignee}</span>
        </div>
    `;

    enableTaskAutoSave(card, storyName, group);
    return card;
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
            }
        });
    });
}

function renderStory(storyName) {
    const data = storyData[storyName];

    const todo = document.querySelector(".todo-col .task-list");
    const prog = document.querySelector(".progress-col .task-list");
    const done = document.querySelector(".done-col .task-list");

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
            }

            item.removeAttribute("contenteditable");
            item.removeEventListener("blur", onBlur);
        });
    });
}


attachStoryItemEvents();
renderStory("Sprint Board Feature");

function removeTaskFromData(storyName, title) {
    ["todo", "progress", "done"].forEach(g => {
        storyData[storyName][g] = storyData[storyName][g].filter(t => t.title !== title);
    });
}

function addTaskToData(storyName, group, task) {
    storyData[storyName][group].push(task);
}

function getTaskDataFromCard(card) {
    return {
        title: card.querySelector(".task-title").textContent.trim(),
        badge: card.querySelector(".task-badge").textContent.trim(),
        due: card.querySelector(".task-due").textContent.replace("Due:", "").trim(),
        assignee: card.querySelector(".task-assignee").textContent.replace("Assigned to:", "").trim()
    };
}

document.getElementById('backDashboard').addEventListener('click', function(e) {
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