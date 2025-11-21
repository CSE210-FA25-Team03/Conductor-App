
    // Get tabs
    const staffTab = document.getElementById("staffTab");
    const studentsTab = document.getElementById("studentsTab");

    // Get content areas
    const staffView = document.getElementById("staffView");
    const studentsView = document.getElementById("studentsView");

    // STAFF TAB CLICK
    staffTab.addEventListener("click", () => {
        staffTab.classList.add("active");
        studentsTab.classList.remove("active");

        staffView.classList.add("active");
        studentsView.classList.remove("active");
    });

    // STUDENTS TAB CLICK
    studentsTab.addEventListener("click", () => {
        studentsTab.classList.add("active");
        staffTab.classList.remove("active");

        studentsView.classList.add("active");
        staffView.classList.remove("active");
    });


    const searchInput = document.getElementById("studentSearchInput");
const teamLeadToggle = document.getElementById("teamLeadToggle");
const rows = document.querySelectorAll(".student-row");

function updateFilter() {
    const query = searchInput.value.toLowerCase();
    const onlyLeads = teamLeadToggle.checked;

    rows.forEach(row => {
        const name = row.dataset.name.toLowerCase();
        const group = row.dataset.group;
        const isLead = row.dataset.teamlead === "true";

        let matches = 
            name.includes(query) ||
            group.includes(query);

        if (onlyLeads && !isLead) matches = false;

        row.style.display = matches ? "block" : "none";
    });
}

searchInput.addEventListener("input", updateFilter);
teamLeadToggle.addEventListener("change", updateFilter);