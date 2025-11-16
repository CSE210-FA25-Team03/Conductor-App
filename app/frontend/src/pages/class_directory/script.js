// Back Button
document.getElementById("backBtn").addEventListener("click", () => {
    alert("Going back to dashboard...");
});

// Add Instructor Button
document.getElementById("addInstructorBtn").addEventListener("click", () => {
    const name = document.getElementById("instructorName").value;
    if (!name) {
        alert("Please enter an Instructor name.");
        return;
    }
    alert("Instructor added: " + name);
});

// Add TA Button
document.getElementById("addTaBtn").addEventListener("click", () => {
    const name = document.getElementById("taName").value;
    if (!name) {
        alert("Please enter a TA name.");
        return;
    }
    alert("TA added: " + name);
});

// Add Tutor Button
document.getElementById("addTutorBtn").addEventListener("click", () => {
    const name = document.getElementById("taName").value;
    if (!name) {
        alert("Please enter a Tutor name.");
        return;
    }
    alert("Tutor added: " + name);
});

// Google Calendar Button
document.getElementById("addGoogleCalBtn").addEventListener("click", () => {
    alert("Google Calendar integration will be added.");
});
